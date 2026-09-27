import { THistoryEntry } from './history.types';
import { composeHistoryStateData } from './compose-history-state-data';
import { estimateBytes } from './estimate-bytes';

/*
    Goal: allow many undo steps, while not having a tab *always* use up a lot of memory.
    It would be good if on average it's in the lower hundreds of MB, because users might have
    multiple tabs open. Some actions can be very expensive though (e.g. rotating, flipping,
    resizing, importing project). Then you still want to allow some undo steps. So the idea is
    with expensive actions you are allowed to reach up to 1GB.

    The worst-case (memory wise) happens when the project at max size with max layers is
    rotated repeatedly, or the user continually imports a large project:
    max image size:      2048 x 2048
    max layers:          16
    1 layer @ 2048 x 2048 = 16,777,216 Bytes    = 16.78 MB    = 0.02 GB
    16 layer @ 2048 x 2048 = 268,435,456 Bytes  = 268.44 MB   = 0.27 GB for one undo step
 */

// up to this threshold, all entries will be kept
export const ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES = 200e6; // 200 MB
export const LARGE_ENTRY_BYTES = 10e6; // 10 MB
export const LARGE_ENTRY_MAX_AGE = 50;
/*
    Hard cap: all entries together can't exceed this.
    (2024-09) Low-end Chromebooks may only have 2GB of RAM. 5.64 GB would be too much.
    Going with 1 GB, which is 3.7 worst-case undo steps.
 */
export const TOTAL_THRESHOLD_BYTES = 1e9; // 1 GB

export function getTotalMemoryBytes(entries: THistoryEntry[]): number {
    return entries.reduce((sum, e) => sum + e.memoryEstimateBytes, 0);
}

export function trimOldestEntries(entries: THistoryEntry[]): THistoryEntry[] {
    entries = [...entries];
    const totalBytes = getTotalMemoryBytes(entries);

    if (totalBytes <= ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES) {
        // we always keep all below this threshold
        return entries;
    }

    const newestEntryIndex = entries.length - 1; // index of the newest entry

    // limit age of large entries
    // Otherwise they may stick around very long and drive up the average memory usage.
    let oldestIndex = 0;
    for (let i = 0; i <= newestEntryIndex; i++) {
        const age = newestEntryIndex - i;
        if (entries[i].memoryEstimateBytes > LARGE_ENTRY_BYTES && age > LARGE_ENTRY_MAX_AGE) {
            oldestIndex = i;
        }
    }

    // Regular entries together can't exceed ALWAYS_KEEP_THRESHOLD_BYTES.
    // Large entries not included in this.
    {
        let accumulatedBytes = 0;
        for (let i = newestEntryIndex; i >= 0; i--) {
            if (entries[i].memoryEstimateBytes > LARGE_ENTRY_BYTES) {
                continue;
            }
            accumulatedBytes += entries[i].memoryEstimateBytes;
            if (accumulatedBytes > ALWAYS_KEEP_TOTAL_THRESHOLD_BYTES) {
                oldestIndex = Math.max(oldestIndex, i);
                break;
            }
        }
    }

    // can't exceed TOTAL_THRESHOLD_BYTES
    {
        let accumulatedBytes = 0;
        for (let i = newestEntryIndex; i >= 0; i--) {
            accumulatedBytes += entries[i].memoryEstimateBytes;
            if (accumulatedBytes > TOTAL_THRESHOLD_BYTES) {
                oldestIndex = Math.max(oldestIndex, i);
                break;
            }
        }
    }

    // compose entries 0..oldestIndex into a single "oldest" entry
    while (oldestIndex > 0) {
        const composedData = composeHistoryStateData(
            entries.slice(0, oldestIndex + 1).map((item) => item.data),
            oldestIndex,
        );
        const memoryEstimateBytes = estimateBytes(composedData);
        entries = [
            {
                timestamp: entries[oldestIndex].timestamp,
                memoryEstimateBytes,
                description: 'oldest',
                data: composedData,
            },
            ...entries.slice(oldestIndex + 1),
        ];
        oldestIndex = 0;

        // Despite the earlier check the composed entry may still push the total over 1 GB.
        if (getTotalMemoryBytes(entries) > TOTAL_THRESHOLD_BYTES) {
            oldestIndex = 1;
        }
    }

    return entries;
}
