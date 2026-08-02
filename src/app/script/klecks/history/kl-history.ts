import { THistoryEntry, THistoryEntryData, THistoryEntryDataComposed } from './history.types';
import { composeHistoryStateData } from './compose-history-state-data';
import { estimateBytes } from './estimate-bytes';
import { entryCausesChange } from './entry-causes-change';
import { getTotalMemoryBytes, trimOldestEntries } from './trim-oldest-entries';
import { validateHistoryEntry } from './validate-history-entry';

/*
todo memory could be better limited.
When pushing, all entries and the new entry are in memory which already exceeds the limit.
You can potentially be 268.44 MB over the memory limit.
The new entry should only be created after freeing up some space in entries.
 */

// tied to indexed db. don't change.
export const HISTORY_TILE_SIZE = 256;

export type TKlHistoryListener = () => void;

export type TKlHistoryParams = {
    oldest: THistoryEntryDataComposed;
};

const HISTORY_DEBUGGING = false;

export class KlHistory {
    private entries: THistoryEntry[]; // diffs or what changed each step. 0 is oldest
    private index: number = 0; // current action the user is on.
    private composed: THistoryEntryDataComposed; // all diffs until current action combined

    private totalActions: number = 0;
    private changeCount: number = 0; // number keeps incrementing with each change (push, undo, redo)
    private pauseStack: number = 0; // how often paused without unpause. push does nothing when paused.
    private readonly listeners: TKlHistoryListener[] = []; // broadcasts on undo, redo, push

    private broadcast(): void {
        this.changeCount++;
        setTimeout(() => {
            for (let i = 0; i < this.listeners.length; i++) {
                this.listeners[i]();
            }
        });
    }

    private updateComposed(): void {
        this.composed = composeHistoryStateData(
            this.entries.slice(0, this.index + 1).map((item) => item.data),
        );
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TKlHistoryParams) {
        validateHistoryEntry(p.oldest, p.oldest.size);
        this.entries = [
            {
                timestamp: Date.now(),
                memoryEstimateBytes: estimateBytes(p.oldest),
                data: p.oldest,
            },
        ];
        this.composed = p.oldest;
        if (HISTORY_DEBUGGING) {
            (window as any).getHistoryEntries = () => this.entries;
        }
    }

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
     * listens to changes - on undo, redo, push
     */
    addListener(l: TKlHistoryListener): void {
        this.listeners.push(l);
    }

    // doesn't push if: paused or if entry is empty
    push(entryData: THistoryEntryData, replaceTop?: boolean): void {
        if (this.pauseStack > 0) {
            return;
        }
        if (Object.keys(entryData).length === 0) {
            // no change -> noop
            return;
        }
        validateHistoryEntry(entryData, this.composed.size);
        const entry: THistoryEntry = {
            timestamp: Date.now(),
            memoryEstimateBytes: estimateBytes(entryData),
            data: entryData,
        };

        if (replaceTop && this.index > 0) {
            this.index--;
            // remove current top
            while (this.index < this.entries.length - 1) {
                this.entries.pop();
            }
            // it's possible that new entry replacing top is same to composed history
            // e.g. toggle layer visibility twice
            const isDifferent = entryCausesChange(
                entryData,
                composeHistoryStateData(
                    this.entries.slice(0, this.index + 1).map((item) => item.data),
                ),
            );
            // only need to push if it's different
            isDifferent && this.entries.push(entry);
        } else {
            while (this.index < this.entries.length - 1) {
                this.entries.pop();
            }
            this.entries.push(entry);
        }

        this.entries = trimOldestEntries(this.entries);
        if (HISTORY_DEBUGGING) {
            const totalBytes = getTotalMemoryBytes(this.entries);
            console.log(
                `[KlHistory] pushed ${(entry.memoryEstimateBytes / 1e6).toFixed(1)} MB — total: ${(totalBytes / 1e6).toFixed(1)} MB (${this.entries.length} entries)`,
            );
        }
        this.totalActions++;
        this.index = this.entries.length - 1;
        this.updateComposed();
        this.broadcast();
    }

    increaseIndex(): THistoryEntry {
        if (this.canRedo()) {
            this.index++;
        }
        this.updateComposed();
        this.broadcast();
        return this.entries[this.index];
    }

    decreaseIndex(): THistoryEntry {
        if (this.canUndo()) {
            this.index--;
        }
        this.updateComposed();
        this.broadcast();
        return this.entries[this.index];
    }

    canUndo(): boolean {
        return this.index > 0;
    }

    canRedo(): boolean {
        return this.index < this.entries.length - 1;
    }

    getEntries(): THistoryEntry[] {
        return this.entries.slice(0, this.index + 1);
    }

    getComposed(): THistoryEntryDataComposed {
        return this.composed;
    }

    getChangeCount(): number {
        return this.changeCount;
    }

    getTotalIndex(): number {
        return this.totalActions;
    }

    isPaused(): boolean {
        return this.pauseStack > 0;
    }
}
