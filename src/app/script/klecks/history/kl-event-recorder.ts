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

/**
 * Records user events for later replay functionality
 */
export class KlEventRecorder {
    private projectId: string = '';
    private sequenceNumber: number = 0;
    private memoryEvents: TRecordedEvent[] = [];
    private enableMemoryStorage: boolean;
    private enableBrowserStorage: boolean;
    private lastTimestamp: number = 0; // ms since epoch
    private totalTimeTaken: number = 0; // ms taken drawing in this project
    private listeners: Array<TEventRecordedCallback> = [];
    private isPaused: boolean = false;
    private replayer: KlEventReplayer;

    constructor(projectId: string, config: TRecorderConfig) {
        this.projectId = projectId;
        this.enableMemoryStorage = config.enableMemoryStorage || false;
        this.enableBrowserStorage = config.enableBrowserStorage || false;
        if (config.onEvent) {
            this.listeners.push(config.onEvent);
        }

        this.replayer = new KlEventReplayer();

        // If enabled, load data from browser storage
        this.loadFromBrowserStorage();

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
        if (events) {
            this.saveToMemoryStorage(events);
            this.saveToBrowserStorage(events);
        }
    }

    loadFromBrowserStorage() {
        if (!this.enableBrowserStorage) {
            return;
        }

        try {
            const readEvents = localStorage.getItem(`kl-rec-${this.projectId}`);
            let parsed: TRecordedEvent[] = [];
            if (readEvents) {
                parsed = JSON.parse(readEvents) as TRecordedEvent[];
            }
            this.saveToMemoryStorage(parsed);
            return parsed;
        } catch (error) {
            console.error('%c[REC]', LOG_STYLE_RECORDER, 'Failed to load events from browser storage. Error:', error);
        }
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
     * Record an event with flexible data / parameters, needed to restore this action
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
            if (DEBUG_RECORDER) {
                console.log('%c[REC]', LOG_STYLE_RECORDER, 'Ignoring event - recording paused', event);
            }
            return;
        }

        if (DEBUG_RECORDER) {
            console.log('%c[REC]', LOG_STYLE_RECORDER, 'Recording event', event);
        }

        // Store (if enabled)
        this.saveToMemoryStorage([event]);
        this.saveToBrowserStorage([event]);

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
     * Get events from memory (always available if enabled)
     */
    getEvents(options: TGetEventsOptions = {}): TRecordedEvent[] {
        const events = this.enableMemoryStorage
            ? this.memoryEvents
            : this.enableBrowserStorage
                ? JSON.parse(localStorage.getItem(`kl-rec-${this.projectId}`) || '[]') as TRecordedEvent[]
                : [];

        const { fromSequence = 0, toSequence = Infinity, includeTypes } = options;
        return events
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
        console.log('%c[REC]', LOG_STYLE_RECORDER, 'Recording paused');
    }

    /**
     * Start or resume event recording
     */
    start() {
        this.isPaused = false;
        this.lastTimestamp = 0; // Reset timestamp to avoid time accumulation during pause
        console.log('%c[REC]', LOG_STYLE_RECORDER, 'Recording resumed');
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

    private saveToBrowserStorage(events: TRecordedEvent[] | null) {
        if (events === null) {
            localStorage.removeItem(`kl-rec-${this.projectId}`);
            return;
        }

        if (!this.enableBrowserStorage) {
            return;
        }

        try {
            let allEvents: TRecordedEvent[] = [];
            const lsEvents = localStorage.getItem(`kl-rec-${this.projectId}`);
            if (lsEvents) {
                allEvents = JSON.parse(lsEvents) as TRecordedEvent[];
            }
            allEvents.push(...events);
            localStorage.setItem(`kl-rec-${this.projectId}`, JSON.stringify(allEvents));
        } catch (error) {
            console.error('%c[REC]', LOG_STYLE_RECORDER, 'Failed to save events to browser storage. Error:', error);
        }
    }

    private saveToMemoryStorage(events: TRecordedEvent[] | null) {
        if (events === null) {
            this.memoryEvents = [];
            return;
        }

        if (!this.enableMemoryStorage) {
            return;
        }

        this.memoryEvents.push(...events);
    }

    clearEvents() {
        this.sequenceNumber = 0;
        this.totalTimeTaken = 0;
        this.lastTimestamp = 0;
    }

    /**
     * Set an event replayer to avoid recording events while replaying
     */
    getReplayer(): KlEventReplayer {
        return this.replayer;
    }

    /**
     * In a real world example, the recorder should not contain the events, but get it from a server.
     */
    async startReplayFromRecorderStorage(config: TReplayConfig = {}): Promise<TReplayStats> {
        return await this.replayer.startReplay(this.getEvents(), config);
    }
}
