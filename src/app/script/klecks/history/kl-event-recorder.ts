// Event types for more explicit type handling
import { KlChainRecorder } from './kl-chain-recorder';

export type TEventType = 'undo' | 'redo' |
    'draw' |
    'bucket' | 'text' |
    'f-flip' | 'l-select'
    ;

// New event structure with explicit type field and flexible data
export type TRecordedEvent = {
    projectId: string;
    sequenceNumber: number;
    timestamp: number;
    type: TEventType;
    data: any;
};

export type TEventRecordedCallback = (event: TRecordedEvent, totalTime: number) => void;

export type TRecorderConfig = {
    onEvent?: TEventRecordedCallback;
    enableMemoryStorage?: boolean; // Default: true
};

export type TGetEventsOptions = {
    fromSequence?: number;
    toSequence?: number;
    includeTypes?: TEventType[];
};

export type TSanitizedDrawEvent = string;

/**
 * when two events occur within this timespan, the actual time gets added to the "time taken" counter
 */
const TIMESPAN_ACCUMULATION_MS = 3000;

const DEBUG_RECORDER = true;

/**
 * Records user events for later replay functionality
 */
export class KlEventRecorder {
    private projectId: string = '';
    private sequenceNumber: number = 0;
    private memoryEvents: TRecordedEvent[] = [];
    private enableMemoryStorage: boolean;
    private lastTimestamp: number = 0; // ms since epoch
    private totalTimeTaken: number = 0; // ms taken drawing in this project
    private listeners: Array<TEventRecordedCallback> = [];
    private isPaused: boolean = false;

    constructor(projectId: string, config: TRecorderConfig) {
        this.projectId = projectId;
        this.enableMemoryStorage = config.enableMemoryStorage !== false; // Default to true
        if (config.onEvent) {
            this.listeners.push(config.onEvent);
        }

        if (DEBUG_RECORDER) {
            (window as any).getRecordedEvents = () => this.getEvents();
            (window as any).getTimeTaken = () => this.getTimeTaken();
        }
    }

    /**
     * Allow resuming a drawing. Provide these parameters, so that this class is in sync
     */
    load(sequenceNumber: number, totalTimeTaken: number, events?: TRecordedEvent[]) {
        this.sequenceNumber = sequenceNumber;
        this.totalTimeTaken = totalTimeTaken;
        if (events && this.enableMemoryStorage) {
            this.memoryEvents = events;
        }
    }

    /**
     * Create an instance of a chain-recorder to record brush events
     */
    createChainRecorder() {
        return new KlChainRecorder((drawEvents) => {
            // Line ended:
            this.record('draw', { events: drawEvents });
        });
    }

    /**
     * Record an event with flexible data / parameters, needed to restore this action
     */
    record(type: TEventType, data: any): void {
        const event: TRecordedEvent = {
            projectId: this.projectId,
            timestamp: Date.now(),
            type: type,
            data: { ...data },
            sequenceNumber: this.sequenceNumber++,
        };

        this.recordEventInternal(event);
    }

    /**
     * Record event using configured callback
     */
    private recordEventInternal(event: TRecordedEvent): void {
        // Don't record if paused
        if (this.isPaused) {
            if (DEBUG_RECORDER) {
                console.log('%c[REC]', 'color: orange;', 'Ignoring event - recording paused', event);
            }
            return;
        }

        if (DEBUG_RECORDER) {
            console.log('%c[REC]', 'color: orange;', 'Recording event', event);
        }

        // Store in memory if enabled
        if (this.enableMemoryStorage) {
            this.memoryEvents.push(event);
        }

        this.calculateTimeTaken();

        // Notify listeners
        for (const cb of this.listeners) {
            try {
                cb(event, this.totalTimeTaken);
            } catch (error) {
                console.error('%c[REC]', 'color: orange;', 'Failed to notify listeners. Error:', error);
            }
        }
    }

    /**
     * Get events from memory (always available if enabled)
     */
    getEvents(options: TGetEventsOptions = {}): TRecordedEvent[] {
        if (!this.enableMemoryStorage) {
            return [];
        }

        const { fromSequence = 0, toSequence = Infinity, includeTypes } = options;
        return this.memoryEvents
                   .filter(event =>
                       event.sequenceNumber >= fromSequence &&
                       event.sequenceNumber <= toSequence &&
                       (!includeTypes || includeTypes.includes(event.type))
                   )
                   .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
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
        this.memoryEvents = [];
        this.sequenceNumber = 0;
        this.lastTimestamp = 0;
        this.totalTimeTaken = 0;
    }

    /**
     * Pause event recording - events will be ignored until resumed
     */
    pause() {
        this.isPaused = true;
        console.log('%c[REC]', 'color: orange;', 'Recording paused');
    }

    /**
     * Resume event recording
     */
    resume() {
        this.isPaused = false;
        this.lastTimestamp = 0; // Reset timestamp to avoid time accumulation during pause
        console.log('%c[REC]', 'color: orange;', 'Recording resumed');
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
        this.listeners.push(callback);
    }

    /**
     * Unregister an event listener
     */
    unsubscribe(callback: TEventRecordedCallback) {
        this.listeners = this.listeners.filter((cb) => cb !== callback);
    }
}
