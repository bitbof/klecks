// Event types for more explicit type handling
import { TDrawDownEvent, TDrawEvent, TDrawLine, TDrawMoveEvent, TDrawUpEvent, } from '../kl-types';

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

export type TRecorderConfig = {
    onEvent?: (event: TRecordedEvent) => void;
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

const r0 = Math.round;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export class KlChainRecorder {
    private chainOut: ((event: TDrawEvent) => void) | undefined;
    private onLineEnded: ((drawEventCache: TSanitizedDrawEvent[]) => void) | undefined;
    private drawEventCache: TSanitizedDrawEvent[] = [];

    // ----------------------------------- public -----------------------------------
    constructor(onLineEnded?: (drawEventCache: TSanitizedDrawEvent[]) => void) {
        this.onLineEnded = onLineEnded;
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        const event2 = this.sanitizeEvent(event);
        if (event2) {
            this.drawEventCache.push(event2);
        }

        if (event.type == 'up') {
            // Line ended
            this.onLineEnded && this.onLineEnded(this.drawEventCache);
            this.drawEventCache = [];
        } else if (event.type == 'line') {
            // Simple line drawn
            this.onLineEnded && this.onLineEnded(this.drawEventCache);
            this.drawEventCache = [];
        }

        return event;
    }

    setChainOut(func: (event: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    sanitizeEvent(event: TDrawEvent): TSanitizedDrawEvent | null {
        // Some adjustments to save memory

        // Remove coalesced events because they only add minor details
        if ('isCoalesced' in event && event.isCoalesced) {
            return null;
        }

        if (event.type == 'down') {
            return (event.shiftIsPressed ? 'D' : 'd') +
                `${r0(event.x)}|${r0(event.y)}|${r3(event.pressure)}@${r3(event.scale)}`;
        }
        if (event.type == 'move') {
            return (event.shiftIsPressed ? 'M' : 'm') +
                `${r0(event.x)}|${r0(event.y)}|${r3(event.pressure)}@${r3(event.scale)}`;
        }
        if (event.type == 'up') {
            return (event.shiftIsPressed ? 'U' : 'u') +
                `@${r3(event.scale)}`;
        }
        if (event.type == 'line') {
            return 'L' +
                `${event.x0 !== null ? r0(event.x0) : 'x'}|${event.y0 !== null ? r0(event.y0) : 'x'}|${event.pressure0 !== null ? r3(event.pressure0) : 'x'}` +
                `-${r0(event.x1)}|${r0(event.y1)}|${r3(event.pressure1)}`;
        }

        // unknown event type
        return null;
    }

}


/**
 * Records user events for later replay functionality
 */
export class KlEventRecorder {
    private readonly config: TRecorderConfig;
    private projectId: string = '';
    private sequenceNumber: number = 0;
    private memoryEvents: TRecordedEvent[] = [];
    private enableMemoryStorage: boolean;
    private lastTimestamp: number = 0; // ms since epoch
    private totalTimeTaken: number = 0; // ms taken drawing in this project

    constructor(projectId: string, config: TRecorderConfig) {
        this.projectId = projectId;
        this.config = config;
        this.enableMemoryStorage = config.enableMemoryStorage !== false; // Default to true

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
        if (DEBUG_RECORDER) {
            console.log('%c[REC]', 'color: orange;', 'Recording event', event);
        }

        // Store in memory if enabled
        if (this.enableMemoryStorage) {
            this.memoryEvents.push(event);
        }

        // Call onEvent callback if provided
        if (this.config.onEvent) {
            try {
                this.config.onEvent(event);
            } catch (error) {
                console.error('%c[REC]', 'color: orange;', 'Failed to record event. Error in callback:', error);
            }
        }

        this.calculateTimeTaken();
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
}
