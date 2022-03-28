
export interface IHistoryEntry {
    tool: string[];
    action?: string;
    params?: any[];

    actions?: {
        action: string;
        params: any[];
    }[]
}

export interface IHistoryBroadcast {
    bufferUpdate: IHistoryEntry;
}

export type IHistoryListener = (p: IHistoryBroadcast | null) => void;

let historyInstance: boolean = false;

export interface KlHistoryInterface {
    pause (b: boolean): void;
    addListener (l: IHistoryListener): void;
    push (e: IHistoryEntry): void;
    undo (): (IHistoryEntry | null)[];
    redo (): (IHistoryEntry | null)[];
    getAll (): (IHistoryEntry | null)[];
    canRedo (): boolean;
    canUndo (): boolean;
    getState (): number;
    getActionNumber (): number;
}

export class DecoyKlHistory implements KlHistoryInterface {
    pause (b: boolean): void {}
    addListener (l: IHistoryListener): void {}
    push (e: IHistoryEntry): void {}
    undo (): (IHistoryEntry | null)[] { return []; }
    redo (): (IHistoryEntry | null)[] { return []; }
    getAll (): (IHistoryEntry | null)[] { return []; }
    canRedo (): boolean { return false; }
    canUndo (): boolean { return false; }
    getState (): number { return 0; }
    getActionNumber (): number { return 0; }
}

export class KlHistory implements KlHistoryInterface {

    private state: number; // on .push state increments by one
    private dataArr: (IHistoryEntry | null)[]; // null if beyond max undo to trigger garbage collection
    private listeners: IHistoryListener[];
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
        this.dataArr = [];
        this.listeners = [];
        this.pauseStack = 0;
        this.maxState = -1;
        this.actionNumber = -1;
    }

    /**
     * you need pause because there are sometimes actions that would cause other
     * undo steps
     * for example a filter that does something crazy with two layers and then merges them
     * you want that to be one undo step, and prevent merging from causing its undo step.
     * so while that filter is doing its magic you should pause possible undo steps that
     * that are caused by a part of its code(in this example: merging layers)
     *
     * @param b
     */
    pause (b: boolean): void {
        if (b === false) {
            this.pauseStack = Math.max(0, this.pauseStack - 1);
        } else {
            this.pauseStack++;
        }
    }

    addListener (l: IHistoryListener): void {
        this.listeners.push(l);
    }

    push (e: IHistoryEntry): void {
        if (this.pauseStack > 0) {
            return;
        }
        while (this.actionNumber < this.dataArr.length - 1) {
            this.dataArr.pop();
        }

        //taking care of actions that shouldn't cause a new undo step
        const top = this.dataArr[this.dataArr.length - 1];
        if (e.action === 'layerOpacity' && top && top.action === 'layerOpacity' && top.params[0] === e.params[0]) {
            this.dataArr[this.dataArr.length - 1] = e;
            this.state++; //still needs to increment because something changed
            return;
        }
        if (e.action === 'focusLayer' && top && top.action === 'focusLayer') {
            this.dataArr[this.dataArr.length - 1] = e;
            this.state++;
            return;
        }


        this.dataArr[this.dataArr.length] = e;
        this.actionNumber = this.dataArr.length - 1;
        const maxBefore = this.maxState;
        this.maxState = Math.max(this.maxState, this.actionNumber - this.max);
        if (maxBefore < this.maxState) {
            this.broadcast({bufferUpdate: this.dataArr[this.maxState]});
        } else {
            this.broadcast(null);
        }
        if (this.maxState >= 0) {
            this.dataArr[this.maxState] = null; //to free some memory...imported images take a lot of space
        }
    }

    undo (): (IHistoryEntry | null)[] {
        let result;
        if (this.canUndo()) {
            result = [];
            for (let i = this.maxState + 1; i < this.actionNumber; i++) {
                result.push(this.dataArr[i]);
            }
            this.actionNumber--;
            this.broadcast(null);
        }

        return result;
    }

    redo (): (IHistoryEntry | null)[] {
        const result = [];
        if (this.canRedo()) {
            this.actionNumber++;
            result.push(this.dataArr[this.actionNumber]);
            this.broadcast(null);
        }
        return result;
    }

    getAll (): (IHistoryEntry | null)[] {
        return [].concat(this.dataArr);
    }

    canRedo (): boolean {
        return this.actionNumber < this.dataArr.length - 1;
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
