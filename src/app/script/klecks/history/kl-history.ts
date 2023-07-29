

// --------- history entry types ------------------------------
import {throwIfNull} from '../../bb/base/base';

export interface IHistoryAction {
    action: string;
    params: any[];
}

export interface IHistoryEntry {
    tool: string[];
    action?: string;
    params?: any[];
    actions?: IHistoryAction[];
}

type THistoryActionParams<T> = T extends (...args: infer A) => void ? A : never;
export type THistoryActions<ToolName, T> = {
    [K in keyof T]: {
        tool: [ToolName];
        action: K;
        params: THistoryActionParams<T[K]>;
    }
}[keyof T];

export type THistoryInnerActions<T> = {
    [K in keyof T]: {
        action: K;
        params: THistoryActionParams<T[K]>;
    }
}[keyof T];

export type THistoryEntryG<Tool extends string[], Action extends string, Params extends unknown[]> = {
    tool: Tool;
    action: Action;
    params: Params;
}

export type TMiscImportImageHistoryEntry = THistoryEntryG<
    ['misc'],
    'importImage',
    [HTMLCanvasElement, string | undefined]>;

export type TMiscFocusLayerHistoryEntry = THistoryEntryG<
    ['misc'],
    'focusLayer',
    [number]>;

// --------- classes etc ------------------------------

export interface IHistoryBroadcast {
    bufferUpdate: IHistoryEntry;
}

let historyInstance: boolean = false;

export type IHistoryListener = (p: IHistoryBroadcast | null) => void;

export interface KlHistoryInterface {
    pause (b: boolean): void;
    addListener (l: IHistoryListener): void;
    push (e: IHistoryEntry): void;
    undo (): IHistoryEntry[];
    redo (): IHistoryEntry | undefined;
    getAll (): (IHistoryEntry | null)[];
    canRedo (): boolean;
    canUndo (): boolean;
    getState (): number;
    getActionNumber (): number;
}

export class DecoyKlHistory implements KlHistoryInterface {
    pause (): void {}
    addListener (): void {}
    push (): void {}
    undo (): IHistoryEntry[] { return []; }
    redo (): (IHistoryEntry | undefined) { return undefined; }
    getAll (): (IHistoryEntry | null)[] { return []; }
    canRedo (): boolean { return false; }
    canUndo (): boolean { return false; }
    getState (): number { return 0; }
    getActionNumber (): number { return 0; }
}

const DO_DELETE_OLD = true;

export class KlHistory implements KlHistoryInterface {

    private state: number; // on .push state increments by one
    private readonly entries: (IHistoryEntry | null)[]; // null if beyond max undo to trigger garbage collection
    private readonly listeners: IHistoryListener[];
    private pauseStack: number; // how often paused without unpause
    private readonly max: number = 20; // max number undo steps
    private maxState: number; // can't go backwards -> max state is the buffer image(klCanvas)
    private actionNumber: number; // current action the user is on. untouched document = -1 because dataArr.length is 0
    
    private broadcast (p: IHistoryBroadcast | null): void {
        setTimeout(() => {
            for (let i = 0; i < this.listeners.length; i++) {
                this.listeners[i](p);
            }
            this.state++;
        }, 1);
    }
    
    // ---- public ----
    
    constructor () {
        if (historyInstance) {
            throw new Error('klHistory already instantiated');
        }
        historyInstance = true;
        this.state = 0;
        this.entries = [];
        this.listeners = [];
        this.pauseStack = 0;
        this.maxState = -1;
        this.actionNumber = -1;
    }

    /**
     * Needed, because sometimes there are actions that would cause other undo steps.
     * For example a filter that does something with two layers and then merges them.
     * That should be a single undo step, and prevent merging from creating its own undo step.
     * Pause prevents creation of unintended undo steps.
     */
    pause (b: boolean): void {
        if (b) {
            this.pauseStack++;
        } else {
            this.pauseStack = Math.max(0, this.pauseStack - 1);
        }
    }

    addListener (l: IHistoryListener): void {
        this.listeners.push(l);
    }

    push (newEntry: IHistoryEntry): void {
        if (this.pauseStack > 0) {
            return;
        }
        while (this.actionNumber < this.entries.length - 1) {
            this.entries.pop();
        }

        //taking care of actions that shouldn't cause a new undo step
        const lastEntry = this.entries[this.entries.length - 1];
        // opacity
        if (
            lastEntry && newEntry.tool[0] === 'canvas' && lastEntry.tool[0] === 'canvas' &&
            newEntry.action === 'layerOpacity' && lastEntry.action === 'layerOpacity' &&
            lastEntry.params![0] === newEntry.params![0]
        ) {
            this.entries[this.entries.length - 1] = newEntry;
            this.state++; //still needs to increment because something changed
            return;
        }
        // layer visibility
        if (
            lastEntry && newEntry.tool[0] === 'canvas' && lastEntry.tool[0] === 'canvas' &&
            newEntry.action === 'setLayerIsVisible' && lastEntry.action === 'setLayerIsVisible' &&
            lastEntry.params![0] === newEntry.params![0] &&
            lastEntry.params![1] != newEntry.params![1]
        ) {
            // if last and current step toggle visibility -> that means it's the way it was before
            this.entries.pop();
            this.actionNumber--;
            this.state++; //still needs to increment because something changed
            this.broadcast(null);
            return;
        }
        // select layer
        if (newEntry.action === 'focusLayer' && lastEntry && lastEntry.action === 'focusLayer') {
            this.entries[this.entries.length - 1] = newEntry;
            this.state++;
            return;
        }

        this.entries[this.entries.length] = newEntry;
        this.actionNumber = this.entries.length - 1;
        const maxBefore = this.maxState;
        this.maxState = Math.max(this.maxState, this.actionNumber - this.max);
        if (maxBefore < this.maxState) {
            const item = this.entries[this.maxState];
            if (!item) {
                throw new Error('this.dataArr[this.maxState] null');
            }
            this.broadcast({bufferUpdate: item});
        } else {
            this.broadcast(null);
        }
        if (DO_DELETE_OLD && this.maxState >= 0) {
            this.entries[this.maxState] = null; //to free some memory...imported images take a lot of space
        }
    }

    /**
     * lowers action number, returns all entries that need to be executed
     * on trailing snapshot to represent the canvas one undo step back.
     * Empty array if it can't undo
     */
    undo (): IHistoryEntry[] {
        const result: IHistoryEntry[] = [];
        if (!this.canUndo()) {
            return result;
        }
        for (let i = this.maxState + 1; i < this.actionNumber; i++) {
            result.push(throwIfNull(this.entries[i]));
        }
        this.actionNumber--;
        this.broadcast(null);
        return result;
    }

    /**
     * raises action number, returns the action to be redone
     */
    redo (): (IHistoryEntry | undefined) {
        if (!this.canRedo()) {
            return undefined;
        }
        this.actionNumber++;
        this.broadcast(null);
        return throwIfNull(this.entries[this.actionNumber]);
    }

    getAll (): (IHistoryEntry | null)[] {
        return [...this.entries];
    }

    canRedo (): boolean {
        return this.actionNumber < this.entries.length - 1;
    }

    canUndo (): boolean {
        return this.actionNumber > this.maxState;
    }

    getState (): number {
        return this.state;
    }

    /**
     * actionNumber - number of undo-able actions a user has done (e.g. if drawn 5 lines total -> 5)
     */
    getActionNumber (): number {
        return (this.actionNumber + 1);
    }
    
}

export const klHistory = new KlHistory();
