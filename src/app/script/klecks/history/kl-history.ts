import { THistoryEntry, THistoryEntryData, THistoryEntryDataComposed } from './history.types';
import { composeHistoryStateData } from './compose-history-state-data';
import { estimateBytes } from './estimate-bytes';
import { entryCausesChange } from './entry-causes-change';

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
    // total number of non-free undo steps
    private readonly maxUndoSteps: number = 20;

    /*
    All entries together can't exceed this limit. Supersedes maxUndoSteps. Intended
    to ensure app stability.

    The worst-case (memory wise) happens when the project at max size with max layers is
    rotated repeatedly, or the user continually imports a large project.

    max image size:      2048 x 2048
    max layers:          16
    max history entries: 20 + 1 (+1 is the current state of KlCanvas)
          1 layer @ 2048 x 2048 = 16,777,216 Bytes    = 16.78 MB    = 0.02 GB
         16 layer @ 2048 x 2048 = 268,435,456 Bytes   = 268.44 MB   = 0.27 GB
    21 x 16 layer @ 2048 x 2048 = 5,637,144,576 Bytes = 5,637.14 MB = 5.64 GB

    (2024-09) Low-end Chromebooks may only have 2GB of RAM. 5.64 GB would be too much.
    Going with 1 GB, which is 3.7 worst-case undo steps.
     */
    private readonly totalThresholdBytes: number = 1e9;

    // up to a certain threshold an undo step counts as free, and doesn't get you closer to undo
    // step limit. E.g. renaming a layer has virtually no impact on memory or performance.
    private readonly isFreeThresholdBytes: number = 2048; // 2MB if there were 1000 steps like that

    private entries: THistoryEntry[]; // diffs or what changed each step. 0 is oldest
    private index: number = 0; // current action the user is on.
    private composed: THistoryEntryDataComposed; // all diffs until current action combined

    private indexOffset: number = 0; // for getting the total number of actions (beyond undo limit)
    private changeCount: number = 0; // number keeps incrementing with each change (push, undo, redo)
    private pauseStack: number = 0; // how often paused without unpause. push does nothing when paused.
    private readonly listeners: TKlHistoryListener[] = []; // broadcasts on undo, redo, push

    private broadcast(): void {
        this.changeCount++;
        setTimeout(() => {
            for (let i = 0; i < this.listeners.length; i++) {
                this.listeners[i]();
            }
        }, 1);
    }

    private updateComposed(): void {
        this.composed = composeHistoryStateData(
            this.entries.slice(0, this.index + 1).map((item) => item.data),
        );
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TKlHistoryParams) {
        this.entries = [
            {
                timestamp: new Date().getTime(),
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

    push(entryData: THistoryEntryData, replaceTop?: boolean): void {
        if (this.pauseStack > 0) {
            return;
        }
        const entry: THistoryEntry = {
            timestamp: new Date().getTime(),
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

        // determine oldest - consider maxUndoSteps, isFree, totalThresholdBytes
        let remainingSteps = this.maxUndoSteps;
        let oldestIndex = this.entries.length - 1;
        let remainingBytes = this.totalThresholdBytes - entry.memoryEstimateBytes;
        while (oldestIndex > 0 && remainingSteps >= 0) {
            oldestIndex--;
            const currentEntryBytes = this.entries[oldestIndex].memoryEstimateBytes;
            if (currentEntryBytes < this.isFreeThresholdBytes) {
                remainingBytes -= currentEntryBytes;
                continue;
            }
            if (remainingSteps === 0) {
                // already used up all steps
                oldestIndex++;
                break;
            }
            if (remainingBytes - currentEntryBytes < 0) {
                // used up all memory
                oldestIndex++;
                break;
            }
            remainingBytes -= currentEntryBytes;
            remainingSteps--;
        }
        // compose forward to the oldest index
        while (oldestIndex > 0) {
            const composedData = composeHistoryStateData(
                this.entries.slice(0, oldestIndex + 1).map((item) => item.data),
                oldestIndex,
            );
            const memoryEstimateBytes = estimateBytes(composedData);
            this.entries = [
                {
                    timestamp: this.entries[oldestIndex].timestamp,
                    memoryEstimateBytes,
                    description: 'oldest',
                    data: composedData,
                },
                ...this.entries.slice(oldestIndex + 1),
            ];

            this.indexOffset += oldestIndex;
            oldestIndex = 0;

            // despite the earlier check, it can still exceed the threshold
            if (
                this.entries.reduce((before, item) => before + item.memoryEstimateBytes, 0) >
                this.totalThresholdBytes
            ) {
                oldestIndex = 1;
            }
        }
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
        return this.indexOffset + this.index;
    }

    isPaused(): boolean {
        return this.pauseStack > 0;
    }
}
