import {
    DEBUG_REPLAYER,
    LOG_STYLE_REPLAYER,
    UNDO_IGNORED_EVENTS,
    TEventReplayingHandler,
    TEventType,
    TRecordedEvent,
    TReplayConfig,
    TReplayStats,
} from './kl-event-types';

/**
 * Replays recorded events with proper timing and undo/redo resolution
 */
export class KlEventReplayer {
    private eventHandlers: Map<TEventType, TEventReplayingHandler[]> = new Map();
    private isReplaying: boolean = false;
    private currentReplayAbortController: AbortController | null = null;
    private onFrame: ((currentIndex: number, totalEvents: number) => Promise<void>) | null = null;

    /**
     * Set a callback to be called on each frame (after event was invoked).
     * The last pass can be indicated with (currentIndex >= totalEvents).
     * currentIndex is not a frame-count, but an event count and will probably not be consecutive.
     */
    setOnFrameCallback(callback: ((currentIndex: number, totalEvents: number) => Promise<void>) | null): void {
        this.onFrame = callback;
    }

    /**
     * Register a handler for a specific event type
     * @param type The event type to handle
     * @param handler Function to execute when this event type is encountered
     */
    addReplayHandler(type: TEventType, handler: TEventReplayingHandler): void {
        if (!this.eventHandlers.has(type)) {
            this.eventHandlers.set(type, []);
        }

        this.eventHandlers.get(type)!.push(handler);
    }

    /**
     * Remove a handler for a specific event type
     * @param type The event type
     * @param handler The handler function to remove
     */
    removeReplayHandler(type: TEventType, handler: TEventReplayingHandler): void {
        const handlers = this.eventHandlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
                if (handlers.length === 0) {
                    this.eventHandlers.delete(type);
                }
            }
        }
    }

    /**
     * Start replaying a sequence of events
     * @param events Array of recorded events to replay
     * @param config Configuration options for replay behavior
     * @returns Promise that resolves when replay is complete with replay statistics
     */
    async startReplay(events: TRecordedEvent[], config: TReplayConfig = {}): Promise<TReplayStats> {
        if (this.isReplaying) {
            throw new Error('Replay is already in progress');
        }

        this.isReplaying = true;
        this.currentReplayAbortController = new AbortController();

        try {
            const startTime = performance.now();

            console.log('%c[REPLAY]', LOG_STYLE_REPLAYER, `Starting replay with ${events.length} events`);

            // Step 1: Validate and sort events by sequence number
            const sortedEvents = this.validateAndSortEvents(events);

            // Step 2: Process undo/redo events to get the final event list
            const processedEvents = this.resolveUndoRedoEvents(sortedEvents);

            if (processedEvents.length === 0) {
                return this.createStats(sortedEvents, processedEvents, 0, startTime, config.replayTimeInMs);
            }

            // Step 3: Calculate timing parameters
            const timingParams = this.calculateTimingParams(processedEvents.length, config);

            // Step 4: Execute replay with timing control
            await this.executeReplay(processedEvents, timingParams, this.currentReplayAbortController.signal, config.onFrame);

            const actualDuration = performance.now() - startTime;
            const stats = this.createStats(sortedEvents, processedEvents, actualDuration, startTime, config.replayTimeInMs);

            console.log('%c[REPLAY]', LOG_STYLE_REPLAYER, 'Replay completed:', stats);

            return stats;
        } finally {
            this.isReplaying = false;
            this.currentReplayAbortController = null;
        }
    }

    /**
     * Stop the current replay if one is in progress.
     * Would not recommend it.
     */
    stopReplay(): void {
        if (this.currentReplayAbortController) {
            this.currentReplayAbortController.abort();
            console.log('%c[REPLAY]', LOG_STYLE_REPLAYER, 'Replay stopped by user');
        }
    }

    /**
     * Check if a replay is currently in progress
     */
    isCurrentlyReplaying(): boolean {
        return this.isReplaying;
    }

    /**
     * Validate events are properly sequenced and sort them
     * @private
     */
    private validateAndSortEvents(events: TRecordedEvent[]): TRecordedEvent[] {
        if (events.length === 0) {
            return [];
        }

        // Sort by sequence number to ensure proper order
        return [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    }

    /**
     * Process undo/redo events to resolve them and return the final event list
     * @private
     */
    private resolveUndoRedoEvents(events: TRecordedEvent[]): TRecordedEvent[] {
        const finalEvents: TRecordedEvent[] = []; // All events except undo/redo
        const undoStack: TRecordedEvent[] = []; // Events that can be undone (excludes ignored types)
        const redoStack: TRecordedEvent[] = []; // Events that were undone and can be redone

        for (const event of events) {
            switch (event.type) {
                case 'undo':
                    this.processUndo(finalEvents, undoStack, redoStack);
                    break;
                case 'redo':
                    this.processRedo(finalEvents, undoStack, redoStack);
                    break;
                default:
                    // Regular event - add to final events
                    finalEvents.push(event);
                    // Add to undo stack only if it's not an ignored type
                    if (!UNDO_IGNORED_EVENTS.includes(event.type)) {
                        undoStack.push(event);
                    }
                    // Clear redo stack when new action is performed
                    redoStack.length = 0;
                    break;
            }
        }

        return finalEvents;
    }

    /**
     * Process an undo event by removing the most recent undoable event
     * @private
     */
    private processUndo(
        finalEvents: TRecordedEvent[],
        undoStack: TRecordedEvent[],
        redoStack: TRecordedEvent[]
    ): void {
        while (undoStack.length > 0) {
            const eventToUndo = undoStack.pop()!;

            // Remove from final events
            const index = finalEvents.lastIndexOf(eventToUndo);
            if (index > -1) {
                finalEvents.splice(index, 1);
                redoStack.push(eventToUndo);
                break; // Only undo one event
            }
        }
    }

    /**
     * Process a redo event by restoring the most recently undone event
     * @private
     */
    private processRedo(
        finalEvents: TRecordedEvent[],
        undoStack: TRecordedEvent[],
        redoStack: TRecordedEvent[]
    ): void {
        if (redoStack.length > 0) {
            const eventToRedo = redoStack.pop()!;

            // Add back to final events and undo stack
            finalEvents.push(eventToRedo);
            undoStack.push(eventToRedo);
        }
    }

    /**
     * Calculate timing parameters for replay based on configuration
     * @private
     */
    private calculateTimingParams(eventCount: number, config: TReplayConfig) {
        if (!config.replayTimeInMs || config.replayTimeInMs <= 0) {
            // Replay instantly
            if (DEBUG_REPLAYER) {
                console.log('%c[REPLAY]', LOG_STYLE_REPLAYER, `Timings: instant`);
            }
            return {
                frameTime: 0,
                eventsPerFrame: undefined
            };
        }

        const targetFps = Math.min(Math.max(1, config.targetFps || 25), 120); // limit 1-120 fps, default=25
        const replayTime = config.replayTimeInMs;

        // How many frames do we get:
        const totalFrameCount = Math.ceil((replayTime / 1000) * targetFps) + 1;
        const timePerFrame = 1000 / targetFps;
        const eventsPerFrame = Math.max(1, Math.ceil(eventCount / totalFrameCount));

        if (DEBUG_REPLAYER) {
            console.log('%c[REPLAY]', LOG_STYLE_REPLAYER, `Timings: targetFps=${targetFps}, replayTime=${replayTime}ms, totalFrames=${totalFrameCount}, eventsPerFrame=${eventsPerFrame}, timePerFrame=${timePerFrame.toFixed(2)}ms`);
        }

        return {
            frameTime: timePerFrame,
            eventsPerFrame
        };
    }

    /**
     * Execute the actual replay with timing control
     * @private
     */
    private async executeReplay(
        events: TRecordedEvent[],
        timingParams: ReturnType<typeof this.calculateTimingParams>,
        signal: AbortSignal,
        onFrame?: (currentIndex: number, totalEvents: number) => Promise<void>
    ): Promise<void> {
        const { frameTime, eventsPerFrame } = timingParams;
        let currentIndex = 0;
        let accumulatedDelay = 0;
        let eventsToProcess = eventsPerFrame ?? 20;

        while (currentIndex < events.length && !signal.aborted) {
            const frameStartTime = performance.now();

            // Process a batch of events for this frame
            const frameEvents = events.slice(currentIndex, currentIndex + eventsToProcess);

            // Execute all handlers for each event in this frame
            for (const event of frameEvents) {
                if (signal.aborted) break;

                await this.executeEventHandlers(event);
            }

            currentIndex += eventsToProcess;

            // Call frame callback
            if (onFrame) {
                await onFrame(currentIndex, events.length);
            }
            if (this.onFrame) {
                await this.onFrame(currentIndex, events.length);
            }

            if (frameTime <= 0) {
                // No animation
                continue;
            }

            if (currentIndex >= events.length || signal.aborted) {
                // Done or aborted
                break;
            }

            // Calculate timing for next frame
            let sleepTime = 0;
            const thisFrameRealDuration = performance.now() - frameStartTime;
            const thisFrameDelay = frameTime - thisFrameRealDuration; // positive=good

            // Calculate delay for next frame, compensating for any overrun
            const totalFrameDelay = -thisFrameDelay + accumulatedDelay;
            if (totalFrameDelay > 0) {
                // We're behind schedule
                // Try to keep up, sleep as little as possible
                sleepTime = 1;
                // And it's still getting worse:
                accumulatedDelay += -thisFrameDelay;

                if (DEBUG_REPLAYER) {
                    console.warn('%c[REPLAY]', LOG_STYLE_REPLAYER, `Trying to keep up. Overrun by ${-totalFrameDelay.toFixed(1)}ms, accumulated delay: ${accumulatedDelay.toFixed(1)}ms`);
                }
            } else {
                // Sleep till the next frame should happen
                // floor and "-10" is a precaution: Be faster early on, so that we have more time later
                sleepTime = Math.max(0, Math.floor(thisFrameDelay - 10));
                accumulatedDelay = 0;
            }

            if (sleepTime > 0) {
                // Wait for next frame
                await this.sleep(sleepTime);
            }
        }
    }

    private async executeEventHandlers(event: TRecordedEvent): Promise<void> {
        const handlers = this.eventHandlers.get(event.type);
        if (!handlers || handlers.length === 0) {
            if (DEBUG_REPLAYER) {
                console.warn('%c[REPLAY]', LOG_STYLE_REPLAYER, `No handlers registered for event type: ${event.type}`);
            }
            return;
        }

        // Execute all handlers for this event type
        for (const handler of handlers) {
            try {
                await handler(event);
            } catch (error) {
                console.error('%c[REPLAY]', LOG_STYLE_REPLAYER, `Error executing handler for event ${event.type}:`, error);
                // Continue with other handlers even if one fails
            }
        }
    }

    /**
     * Create replay statistics object
     * @private
     */
    private createStats(
        originalEvents: TRecordedEvent[],
        processedEvents: TRecordedEvent[],
        actualDuration: number,
        startTime: number,
        targetDuration?: number
    ): TReplayStats {
        return {
            totalEvents: originalEvents.length,
            processedEvents: processedEvents.length,
            skippedEvents: originalEvents.length - processedEvents.length,
            actualDuration,
            targetDuration,
            averageFps: processedEvents.length > 0 ? (processedEvents.length / actualDuration) * 1000 : 0
        };
    }

    /**
     * Sleep helper function
     * @private
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
