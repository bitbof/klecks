import { KlChainRecorder } from './kl-chain-recorder';
import { KlEventReplayer } from './kl-event-replayer';
import {
    DEBUG_RECORDER,
    LOG_STYLE_RECORDER,
    TIMESPAN_ACCUMULATION_MS,
    TEventRecordedCallback,
    TEventType,
    TGetEventsOptions,
    TRecordedEvent,
    TRecorderConfig,
    TReplayConfig,
    TReplayStats,
} from './kl-event-types';
import { IEventStorageProvider } from './kl-event-storage-provider';

/**
 * Records user events for later replay functionality
 */
export class KlEventRecorder {
    private projectId: string = '';
    private sequenceNumber: number = 0;
    private lastTimestamp: number = 0; // ms since epoch
    private totalTimeTaken: number = 0; // ms taken drawing in this project
    private listeners: Array<TEventRecordedCallback> = [];
    private isPaused: boolean = false;
    private replayer: KlEventReplayer;
    private storageProvider: IEventStorageProvider | undefined;
    private isStoringInProgress: boolean = false;

    constructor(projectId: string, config: TRecorderConfig, storageProvider?: IEventStorageProvider) {
        this.projectId = projectId;
        if (config.onEvent) {
            this.listeners.push(config.onEvent);
        }

        this.replayer = new KlEventReplayer();
        this.storageProvider = storageProvider;

        if (storageProvider) {
            // Register a listener to synchronously call the store function
            this.listeners.push(this.saveToStorage.bind(this));
        }
    }

    private saveToStorage(event: TRecordedEvent) {
        if (this.isStoringInProgress) {
            // Set timeout and try later
            // This ensures, that the storageProvider (which is an async function)
            // can finish before a new event occurs.
            setTimeout(() => this.saveToStorage(event), 50);
            return;
        }

        this.isStoringInProgress = true;
        this.storageProvider?.storeEvent(event)
            .catch(error => {
                console.error('%c[REC]', LOG_STYLE_RECORDER, 'Failed to store event. Error:', error);
            })
            .finally(() => {
                this.isStoringInProgress = false;
            });
    }

    /**
     * Create an instance of a chain-recorder to record brush events
     */
    createChainRecorder(getBrushData: () => any) {
        return new KlChainRecorder((drawEvents) => {
            // Line ended:
            this.record('draw', {
                events: drawEvents,
                brush: getBrushData()
            });
        });
    }

    /**
     * Record an event
     */
    record(type: TEventType, data: any): void {
        const event: TRecordedEvent = {
            projectId: this.projectId,
            timestamp: Date.now(),
            type: type,
            data: data,
            sequenceNumber: this.sequenceNumber++,
        };

        // Some user action is taking place, record the time!
        this.calculateTimeTaken();

        // Don't record if paused
        if (this.isPaused || this.replayer?.isCurrentlyReplaying()) {
            // if (DEBUG_RECORDER) {
            //     console.log('%c[REC]', LOG_STYLE_RECORDER, `Ignoring event (${type}) - recording paused`);
            // }
            return;
        }

        if (DEBUG_RECORDER) {
            console.log('%c[REC]', LOG_STYLE_RECORDER, 'Recording event', event);
        }

        // Notify listeners
        for (const cb of this.listeners) {
            try {
                cb(event, this.totalTimeTaken);
            } catch (error) {
                console.error('%c[REC]', LOG_STYLE_RECORDER, 'Failed to notify listeners. Error:', error);
            }
        }
    }



    /**
     * Gets the total time taken for all recorded events, aka the "total drawing time"
     * in ms
     */
    getTimeTaken(): number {
        return this.totalTimeTaken;
    }

    private calculateTimeTaken() {
        const now = Date.now();
        if (this.lastTimestamp && (now - this.lastTimestamp) <= TIMESPAN_ACCUMULATION_MS) {
            // Add the time since last event
            this.totalTimeTaken += (now - this.lastTimestamp);
        } else {
            // Just add 100ms
            this.totalTimeTaken += 100;
        }
        this.lastTimestamp = now;
    }

    /**
     * Cleanup
     */
    destroy() {
        this.sequenceNumber = 0;
        this.lastTimestamp = 0;
        this.totalTimeTaken = 0;
    }

    /**
     * Pause event recording - events will be ignored until resumed
     */
    pause() {
        this.isPaused = true;
        console.log('%c[REC]', LOG_STYLE_RECORDER, 'Recording paused');
    }

    /**
     * Start or resume event recording
     */
    start() {
        this.isPaused = false;
        this.lastTimestamp = 0; // Reset timestamp to avoid time accumulation during pause
        console.log('%c[REC]', LOG_STYLE_RECORDER, 'Recording started/resumed');
    }

    /**
     * Check if recording is currently paused
     */
    isRecordingPaused(): boolean {
        return this.isPaused;
    }

    /**
     * Register an event listener to be notified on new recorded events
     */
    subscribe(callback: TEventRecordedCallback) {
        if (this.listeners.includes(callback)) {
            return;
        }
        this.listeners.push(callback);
    }

    /**
     * Unregister an event listener
     */
    unsubscribe(callback: TEventRecordedCallback) {
        this.listeners = this.listeners.filter((cb) => cb !== callback);
    }

    /**
     * Set an event replayer to avoid recording events while replaying
     */
    getReplayer(): KlEventReplayer {
        return this.replayer;
    }

    /**
     * Loads events from the defined storageProvider.
     * Invokes an "instant replay" if no config-parameter is defined.
     */
    async loadFromStorage(config?: TReplayConfig): Promise<TReplayStats | 'empty-storage' | null> {
        const events = await this.storageProvider?.getEvents();
        if (!events) {
            console.warn('%c[REC]', LOG_STYLE_RECORDER, 'No storage provider defined. If you would like to replay events, use the eventReplayer.startReplay() method and provide your own data, or define your own IEventStorageProvider and pass it into the constructor of the KlEventRecorder.');
            return null;
        }

        if (events.length <= 1) {
            return 'empty-storage';
        }

        // Ensure correct order
        events.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

        this.lastTimestamp = 0;
        this.sequenceNumber = events.reduce((max, evnt) => evnt.sequenceNumber >= max ? evnt.sequenceNumber + 1 : max, 0);
        this.totalTimeTaken = events.length > 0 ? events.reduce((acc, evnt, index) => {
            // Recalculate the time drawn. The following code is semantically equivalent to calculateTimeTaken()
            if (index === 0) return acc;
            const prevEvent = events[index - 1];
            const timeDiff = evnt.timestamp - prevEvent.timestamp;
            if (timeDiff <= TIMESPAN_ACCUMULATION_MS) {
                return acc + timeDiff;
            }
            return acc + 100;
        }, 0) : 0;

        // Start the replaying
        const returnResult = await this.replayer.startReplay(events, config ?? {});
        console.log('%c[REC]', LOG_STYLE_RECORDER, `Loaded ${events.length} events from storage for project ${this.projectId}. Final SequenceNumber is ${this.sequenceNumber}`);
        return returnResult;
    }


    /**
     * Get events from storage provider with optional filtering
     */
    async getEvents(options?: TGetEventsOptions): Promise<TRecordedEvent[]> {
        const events = await this.storageProvider?.getEvents(options) ?? [];
        // Ensure correct order
        events.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        return events;
    }

    /**
     * Clear all events from storage
     */
    async clearEvents(): Promise<void> {
        await this.storageProvider?.clearEvents();
    }

    /**
     * Get the count of stored events
     */
    async getEventCount(): Promise<number> {
        return (await this.getEvents()).length;
    }

    /**
     * Check if any events exist in the storageProvider
     */
    async hasEvents(): Promise<boolean> {
        return await this.getEventCount() > 0;
    }

}
