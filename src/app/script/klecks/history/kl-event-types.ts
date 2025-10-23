/**
 * Configuration options for the event recorder
 */
export type TRecorderConfig = {
    /**
     * I would not recommend enabling the integrated memory storage because it can easily grow in size.
     * Rather, provide a callback (onEvent) and put the events somewhere else (server)
     */
    enableMemoryStorage?: boolean;
    /**
     * Enable saving events to browser local storage. Not recommended for larger projects.
     */
    enableBrowserStorage?: boolean;
    /**
     * Callback when a new event is received.
     */
    onEvent?: TEventRecordedCallback;
};

/**
 * Configuration options for replay behavior
 */
export type TReplayConfig = {
    /** Target frames per second for the replay animation */
    targetFps?: number;
    /** Total time in milliseconds for the complete replay */
    replayTimeInMs?: number;
    /** Callback called on each frame during replay */
    onFrame?: (currentIndex: number, totalEvents: number) => Promise<void>;
};

/**
 * All Event Types / Actions
 * Note: frequent words in high frequent actions like "canvas" or "layer"
 * are omitted to save in memory and bandwidth.
 */
export type TEventType =
    'undo' | 'redo' | 'draw' | 'reset' | 'resize' | 'resize-c' |
    'l-flip' | 'l-select' | 'l-fill' | 'l-add' | 'l-opac' | 'l-dupl' | 'l-rm' |
    'l-ren' | 'l-vis' | 'l-move' | 'l-merge' | 'l-merge-all' | 'l-erase' |
    'rotate' | 'flood-fill' | 'shape' | 'grad' | 'text' | 'set-mixmode' |
    'selection' | 'selection-transform' | 'selection-transform-clone' |
    'filter'
    ;

/**
 * Replay:
 * These events are ignored/skipped when calculating undo operations.
 * Note: undo will just "remove" the previous event from the whole list,
 * so an undone-event will never appear in the replay animation.
 * Event types defined here are "not undoable" so they will remain in the animation.
 * The undo-operation will affect the event prior to the ignored event (aka skip).
 */
export const UNDO_IGNORED_EVENTS: TEventType[] = ['l-select'];


/**
 * Event structure
 */
export type TRecordedEvent = {
    projectId: string;
    sequenceNumber: number;
    timestamp: number;
    type: TEventType;
    data: any;
};

/**
 * Parameter type for getEvents
 */
export type TGetEventsOptions = {
    fromSequence?: number;
    toSequence?: number;
    includeTypes?: TEventType[];
};

/**
 * Statistics about the replay process.
 * Return type of the replay() function
 */
export type TReplayStats = {
    totalEvents: number;
    processedEvents: number;
    skippedEvents: number;
    actualDuration: number;
    targetDuration?: number;
    averageFps: number;
};

/**
 * Events from the DrawChain are "compressed" into a small string (this type) to
 * save in memory and bandwidth.
 */
export type TSanitizedDrawEvent = string;

/**
 * Callback type for when an event is recorded.
 * Used for invoking third party systems like APIs
 */
export type TEventRecordedCallback = (event: TRecordedEvent, totalTime: number) => void;

/**
 * Event handler for replaying specific typed event.
 * These handlers should perform the actions required to draw/apply an event to a canvas,
 * aka the replay-action.
 */
export type TEventReplayingHandler = (event: TRecordedEvent) => void | Promise<void>;


/**
 * Recorder:
 * When two events occur within this timespan, the actual time gets added to the "time taken" counter
 */
export const TIMESPAN_ACCUMULATION_MS = 3000;


export const DEBUG_RECORDER = true;
export const DEBUG_REPLAYER = true;
export const LOG_STYLE_REPLAYER = 'color: #6AA6FF; font-weight: bold;';
export const LOG_STYLE_RECORDER = 'color: orange; font-weight: bold;';
