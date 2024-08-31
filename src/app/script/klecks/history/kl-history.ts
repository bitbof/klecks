// --------- history entry types ------------------------------
import { throwIfNull } from '../../bb/base/base';

export interface IHistoryInnerAction {
    action: string;
    params: any[];
}

export interface IHistoryEntry {
    tool: string[];
    action?: string;
    params?: any[];
    actions?: IHistoryInnerAction[];
    isFree?: boolean; // doesn't count towards undo limit
    isHidden?: boolean; // is free and not visible (merged with previous)
}

type THistoryActionParams<T> = T extends (...args: infer A) => void ? A : never;
export type THistoryActions<ToolName, T> = {
    [K in keyof T]: {
        tool: [ToolName];
        action: K;
        params: THistoryActionParams<T[K]>;
        isFree?: boolean; // doesn't count towards undo limit
        isHidden?: boolean; // is free and not visible (merged with previous)
    };
}[keyof T];

export type THistoryInnerActions<T> = {
    [K in keyof T]: {
        action: K;
        params: THistoryActionParams<T[K]>;
    };
}[keyof T];

export type THistoryEntryG<
    Tool extends string[],
    Action extends string,
    Params extends unknown[],
> = {
    tool: Tool;
    action: Action;
    params: Params;
};

export type TMiscImportImageHistoryEntry = THistoryEntryG<
    ['misc'],
    'importImage',
    [HTMLCanvasElement, string | undefined]
>;

export type TMiscFocusLayerHistoryEntry = THistoryEntryG<['misc'], 'focusLayer', [number]>;

// --------- classes etc ------------------------------

export interface IHistoryBroadcast {
    bufferUpdate: IHistoryEntry;
}

export type IHistoryListener = (p: IHistoryBroadcast | null) => void;

export type TBeforePushListener = (entry: IHistoryEntry) => void;

const DO_DELETE_OLD = true;

export class KlHistory {
    private changeCount: number = 0; // number keeps incrementing with each change (push, undo, redo)
    private readonly entries: (IHistoryEntry | null)[] = []; // null if beyond max undo to trigger garbage collection
    private readonly listeners: IHistoryListener[] = []; // broadcasts on undo, redo, push, if oldest state updates includes bufferUpdate
    private pauseStack: number = 0; // how often paused without unpause
    private readonly maxUndos: number = 20; // non-free, non-hidden
    private minIndex: number = -1; // can't undo that step. equals oldest project state
    private currentIndex: number = -1; // current action the user is on. untouched document = -1 because dataArr.length is 0
    private beforePushListeners: TBeforePushListener[] = [];

    private broadcast(p: IHistoryBroadcast | null): void {
        setTimeout(() => {
            for (let i = 0; i < this.listeners.length; i++) {
                this.listeners[i](p);
            }
            this.changeCount++;
        }, 1);
    }

    private emitBeforePush(entry: IHistoryEntry): void {
        this.beforePushListeners.forEach((listener) => listener(entry));
    }

    // ----------------------------------- public -----------------------------------

    constructor() {}

    /**
     * Needed, because sometimes there are actions that would cause other undo steps.
     * For example a filter that does something with two layers and then merges them.
     * That should be a single undo step, and prevent merging from creating its own undo step.
     * Pause prevents creation of unintended undo steps.
     */
    pause(b: boolean): void {
        if (b) {
            this.pauseStack++;
        } else {
            this.pauseStack = Math.max(0, this.pauseStack - 1);
        }
    }

    /**
     * listens to changes - on undo, redo, push: null
     * if oldest state updates: {bufferUpdate}
     * @param l
     */
    addListener(l: IHistoryListener): void {
        this.listeners.push(l);
    }

    /**
     * emits at the beginning of every call of push() (unless paused)
     */
    addBeforePushListener(listener: TBeforePushListener): void {
        if (this.beforePushListeners.includes(listener)) {
            return;
        }
        this.beforePushListeners.push(listener);
    }

    removeBeforePushListener(listenerToRemove: TBeforePushListener): void {
        for (let i = 0; i < this.beforePushListeners.length; i++) {
            const listener = this.beforePushListeners[i];
            if (listener === listenerToRemove) {
                this.beforePushListeners.splice(i, 1);
                return;
            }
        }
    }

    push(newEntry: IHistoryEntry): void {
        if (this.pauseStack > 0) {
            return;
        }
        this.emitBeforePush(newEntry);
        while (this.currentIndex < this.entries.length - 1) {
            this.entries.pop();
        }

        //taking care of actions that shouldn't cause a new undo step
        const lastEntry = this.entries[this.entries.length - 1];
        // opacity
        if (
            lastEntry &&
            newEntry.tool[0] === 'canvas' &&
            lastEntry.tool[0] === 'canvas' &&
            newEntry.action === 'layerOpacity' &&
            lastEntry.action === 'layerOpacity' &&
            lastEntry.params![0] === newEntry.params![0]
        ) {
            this.entries[this.entries.length - 1] = newEntry;
            this.changeCount++; //still needs to increment because something changed
            return;
        }
        // layer visibility
        if (
            lastEntry &&
            newEntry.tool[0] === 'canvas' &&
            lastEntry.tool[0] === 'canvas' &&
            newEntry.action === 'setLayerIsVisible' &&
            lastEntry.action === 'setLayerIsVisible' &&
            lastEntry.params![0] === newEntry.params![0] &&
            lastEntry.params![1] != newEntry.params![1]
        ) {
            // if last and current step toggle visibility -> that means it's the way it was before
            this.entries.pop();
            this.currentIndex--;
            this.changeCount++; //still needs to increment because something changed
            this.broadcast(null);
            return;
        }
        // select layer
        if (newEntry.action === 'focusLayer' && lastEntry && lastEntry.action === 'focusLayer') {
            this.entries[this.entries.length - 1] = newEntry;
            this.changeCount++;
            return;
        }

        this.entries[this.entries.length] = newEntry;
        this.currentIndex = this.entries.length - 1;

        if (newEntry.isFree || newEntry.isHidden) {
            this.broadcast(null);
            return;
        }

        const oldMinIndex = this.minIndex;
        {
            // determine max undo step. skip free steps.
            let nonFreeCount = 0;
            let newMinIndex = this.currentIndex;
            do {
                if (
                    !this.entries[newMinIndex - 1]?.isFree &&
                    !this.entries[newMinIndex - 1]?.isHidden
                ) {
                    nonFreeCount++;
                }
                newMinIndex--;
            } while (
                this.minIndex < newMinIndex &&
                nonFreeCount < this.maxUndos &&
                newMinIndex >= 0
            );

            this.minIndex = newMinIndex;
        }
        if (this.minIndex > oldMinIndex) {
            for (let i = oldMinIndex + 1; i <= this.minIndex; i++) {
                const item = this.entries[i];
                if (!item) {
                    throw new Error('this.dataArr[i] null');
                }
                this.broadcast({ bufferUpdate: item });
                if (DO_DELETE_OLD) {
                    // free memory. imported images take a lot of space
                    this.entries[i] = null;
                }
            }
        } else {
            this.broadcast(null);
        }
    }

    /**
     * returns all entries between oldest and including current index
     * on trailing snapshot to represent the canvas one undo step back.
     * Empty array if it can't undo
     */
    decreaseCurrentIndex(): IHistoryEntry[] {
        const result: IHistoryEntry[] = [];
        if (!this.canUndo()) {
            return result;
        }
        while (this.entries[this.currentIndex]?.isHidden && this.currentIndex > 0) {
            this.currentIndex--;
        }
        this.currentIndex--;

        for (let i = this.minIndex + 1; i <= this.currentIndex; i++) {
            result.push(throwIfNull(this.entries[i]));
        }
        this.broadcast(null);
        return result;
    }

    /**
     * returns the actions to be redone
     */
    increaseCurrentIndex(): IHistoryEntry[] {
        if (!this.canRedo()) {
            return [];
        }
        const result: IHistoryEntry[] = [];
        do {
            this.currentIndex++;
            result.push(throwIfNull(this.entries[this.currentIndex]));
        } while (this.entries[this.currentIndex + 1]?.isHidden);
        this.broadcast(null);
        return result;
    }

    getAll(): (IHistoryEntry | null)[] {
        return [...this.entries];
    }

    canRedo(): boolean {
        return this.currentIndex < this.entries.length - 1;
    }

    canUndo(): boolean {
        return this.currentIndex > this.minIndex;
    }

    getChangeCount(): number {
        return this.changeCount;
    }

    getCurrentIndex(): number {
        return this.currentIndex;
    }
}
