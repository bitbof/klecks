export type TTempHistoryEntry = {
    type: string;
    data: unknown;
};

export type TTempHistoryEventType = 'push' | 'decrease' | 'increase' | 'clear' | 'active';
export type TTempHistoryListener = (type: TTempHistoryEventType) => void;

/**
 * History of temporary actions that will either be committed (to KlHistory) or discarded.
 * E.g. transform via selection
 */
export class KlTempHistory {
    private entries: TTempHistoryEntry[] = [];
    private currentIndex: number = -1;
    private listeners: TTempHistoryListener[] = [];
    private isActive: boolean = false;

    private emit(type: TTempHistoryEventType) {
        this.listeners.forEach((item) => item(type));
    }

    // ----------------------------------- public -----------------------------------

    constructor() {}

    push(entry: TTempHistoryEntry): void {
        if (this.currentIndex < this.entries.length - 1) {
            this.entries.splice(this.currentIndex + 1);
        }
        this.entries.push(entry);
        this.currentIndex = this.entries.length - 1;
        setTimeout(() => this.emit('push'));
    }

    replaceTop(newEntry: TTempHistoryEntry): void {
        this.entries.splice(this.currentIndex);
        this.entries.push(newEntry);
        this.currentIndex = this.entries.length - 1;
        setTimeout(() => this.emit('push'));
    }

    canDecreaseIndex(): boolean {
        return this.currentIndex > -1;
    }

    canIncreaseIndex(): boolean {
        return this.currentIndex < this.entries.length - 1;
    }

    /** aka undo */
    decreaseIndex(): void {
        if (!this.canDecreaseIndex()) {
            return;
        }
        this.currentIndex--;
        setTimeout(() => this.emit('decrease'));
    }

    /** aka redo */
    increaseIndex(): void {
        if (!this.canIncreaseIndex()) {
            return;
        }
        this.currentIndex++;
        setTimeout(() => this.emit('increase'));
    }

    /**
     * all entries up to currentIndex
     */
    getEntries(): TTempHistoryEntry[] {
        return this.entries.slice(0, this.currentIndex + 1);
    }

    clear(): void {
        this.entries = [];
        this.currentIndex = -1;
        setTimeout(() => this.emit('clear'));
    }

    /**
     * emit when push, decrease, increase, clear, or toggle active
     */
    addListener(listener: TTempHistoryListener): void {
        if (this.listeners.includes(listener)) {
            return;
        }
        this.listeners.push(listener);
    }

    removeListener(listener: TTempHistoryListener): void {
        this.listeners.map((item, index) => {
            if (item === listener) {
                this.listeners.splice(index, 1);
            }
        });
    }

    setIsActive(isActive: boolean): void {
        if (this.isActive === isActive) {
            return;
        }
        this.isActive = isActive;
        this.emit('active');
    }

    getIsActive(): boolean {
        return this.isActive;
    }
}
