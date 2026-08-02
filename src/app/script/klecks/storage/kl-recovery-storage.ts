import {
    IMAGE_DATA_STORE,
    KL_INDEXED_DB,
    PROJECT_STORE,
    RECOVERY_STORE,
    type TKlIdbSchema,
} from './kl-indexed-db';
import type { IndexedDbTransaction } from '../../bb/base/indexed-db';
import { BB } from '../../bb/bb';
import { THistoryEntryDataComposed } from '../history/history.types';
import { createArray, fitInto, randomUuid } from '../../bb/base/base';
import {
    RECOVERY_AGE_LIMIT_MS,
    RECOVERY_MEMORY_LIMIT_BYTES,
    RECOVERY_THUMB_HEIGHT_PX,
    RECOVERY_THUMB_WIDTH_PX,
    TRecoveryMetaData,
} from './kl-recovery-manager';
import type { TIdb } from './kl-indexed-db.types';
import { getProjectImageDataIds } from './project-store';
import {
    deserializeRecoveryThumbnail,
    getRecoveryImageDataIds,
    serializeRecovery,
    TRecoveryBundle,
} from './kl-recovery-serialization';

type TRecoveryEntry = {
    id: string;
    recovery: TIdb['V2']['RecoveryStore']['Read'];
};

function genNewId(takenIds: number[]): number {
    const limit = 1000;
    const idSet = new Set(takenIds);
    const pool = createArray(limit, 0)
        .map((_, index) => index)
        .filter((id) => !idSet.has(id));
    const index = Math.floor(Math.random() * pool.length);
    if (pool[index] === undefined) {
        // just pick a larger number if nothing left. 1000, then 1001, then 1002, ...
        const largest = Math.max(...takenIds);
        return largest + 1;
    }
    return pool[index];
}

async function getRecoveryEntriesInTransaction(
    transaction: IndexedDbTransaction<TKlIdbSchema, typeof RECOVERY_STORE>,
): Promise<TRecoveryEntry[]> {
    const records = await transaction.getAllRecords(RECOVERY_STORE);
    return records.map(({ key, value }) => ({
        id: key,
        recovery: value,
    }));
}

async function removeOrphansInTransaction(
    transaction: IndexedDbTransaction<
        TKlIdbSchema,
        typeof IMAGE_DATA_STORE | typeof RECOVERY_STORE | typeof PROJECT_STORE
    >,
    // only the candidates will be removed that are actually orphans
    imageDataCandidateIds?: string[],
): Promise<void> {
    // get all image data ids
    const allIds = imageDataCandidateIds
        ? imageDataCandidateIds
        : await transaction.getAllKeys(IMAGE_DATA_STORE);
    if (allIds.length === 0) {
        return;
    }

    // determine which ids are used in recoveries
    const recoveries = await transaction.getAll(RECOVERY_STORE);
    const usedIds = recoveries.flatMap(getRecoveryImageDataIds);

    // determine which ids are used in browser storage
    const browserStorageRaw = await transaction.get(PROJECT_STORE, 1);
    if (browserStorageRaw) {
        usedIds.push(...getProjectImageDataIds(browserStorageRaw));
    }

    // remove unused ones
    const unusedIds = [...new Set(allIds).difference(new Set(usedIds))];
    await transaction.bulkRemove(IMAGE_DATA_STORE, unusedIds);
}

export async function removeOrphans(candidateIds?: string[]): Promise<void> {
    await KL_INDEXED_DB.runTransaction(
        [RECOVERY_STORE, IMAGE_DATA_STORE, PROJECT_STORE],
        'readwrite',
        (transaction) => removeOrphansInTransaction(transaction, candidateIds),
    );
}

export async function clearOldRecoveries(): Promise<void> {
    const oldestAllowedTimestamp = Date.now() - RECOVERY_AGE_LIMIT_MS;
    await KL_INDEXED_DB.runTransaction(
        [RECOVERY_STORE, IMAGE_DATA_STORE, PROJECT_STORE],
        'readwrite',
        async (transaction) => {
            const entries = await getRecoveryEntriesInTransaction(transaction);
            const expiredEntries = entries.filter(
                ({ recovery }) => recovery.timestamp < oldestAllowedTimestamp,
            );
            if (expiredEntries.length === 0) {
                return;
            }

            await transaction.bulkRemove(
                RECOVERY_STORE,
                expiredEntries.map(({ id }) => id),
            );
            await removeOrphansInTransaction(
                transaction,
                expiredEntries.flatMap(({ recovery }) => getRecoveryImageDataIds(recovery)),
            );
        },
    );
}

export async function getRecoveryOverview(excludedRecoveryIds: number[]): Promise<{
    // recoveries of currently not open tabs
    metas: TRecoveryMetaData[];
    // includes all recoveries
    totalMemoryUsedBytes: number;
}> {
    const excludedIdSet = new Set(excludedRecoveryIds.map((item) => item.toString()));
    const readResult = await KL_INDEXED_DB.runTransaction(
        [RECOVERY_STORE, IMAGE_DATA_STORE],
        'readonly',
        async (transaction) => {
            const entries = await getRecoveryEntriesInTransaction(transaction);
            const entriesWithThumbnail = entries.filter(({ id }) => !excludedIdSet.has(id));
            const thumbnailIds = entriesWithThumbnail.map(({ recovery }) => recovery.thumbnail);
            return {
                entries,
                entriesWithThumbnail,
                thumbnailDataById: await transaction.bulkGet(IMAGE_DATA_STORE, thumbnailIds),
            };
        },
    );

    const metas: TRecoveryMetaData[] = await Promise.all(
        readResult.entriesWithThumbnail.map(async ({ id, recovery }) => ({
            id,
            thumbnail: await deserializeRecoveryThumbnail(
                readResult.thumbnailDataById.get(recovery.thumbnail),
            ),
            timestamp: recovery.timestamp,
            memoryEstimateBytes: recovery.memoryEstimateBytes,
        })),
    );
    return {
        metas,
        totalMemoryUsedBytes: readResult.entries.reduce(
            (sum, { recovery }) => sum + recovery.memoryEstimateBytes,
            0,
        ),
    };
}

export type TGetRecoveryResult =
    | { status: 'not-found' }
    | {
          status: 'success';
          newId: number;
          data: TRecoveryBundle;
      };

const debugSlowLoading = false;
export async function getRecoveryAndUpdateId(
    id: number,
    signal?: AbortSignal,
): Promise<TGetRecoveryResult> {
    const transactionResult:
        | {
              newId: number;
              data: TRecoveryBundle;
          }
        | undefined = await KL_INDEXED_DB.runTransaction(
        [RECOVERY_STORE, IMAGE_DATA_STORE],
        'readwrite',
        async (transaction) => {
            if (debugSlowLoading) {
                // DEBUG: Keep the transaction busy to explore slow recovery loading and cancellation.
                const debugEndTimestamp = Date.now() + 20_000;
                while (Date.now() < debugEndTimestamp) {
                    await transaction.get(RECOVERY_STORE, id.toString());
                }
            }

            const recoveryIds = (await transaction.getAllKeys(RECOVERY_STORE)).map((id) =>
                id.toString(),
            );
            const oldId = id.toString();
            const recovery = await transaction.get(RECOVERY_STORE, oldId);
            if (recovery) {
                // remove the old one before storing the new one
                await transaction.remove(RECOVERY_STORE, oldId);
            } else {
                return undefined;
            }

            const newId = genNewId(recoveryIds.map((id) => +id));
            const updatedRecovery: TIdb['V2']['RecoveryStore']['Read'] = {
                ...recovery,
                timestamp: Date.now(),
            };
            // We lazily write in the same format we just read, otherwise this would be more effort. Should be fine.
            await transaction.set(
                RECOVERY_STORE,
                newId.toString(),
                updatedRecovery as TIdb['V2']['RecoveryStore']['Write'],
            );
            return {
                newId,
                data: {
                    recovery: updatedRecovery,
                    imageDataById: await transaction.bulkGet(
                        IMAGE_DATA_STORE,
                        getRecoveryImageDataIds(updatedRecovery),
                    ),
                },
            };
        },
        signal ? { signal } : undefined,
    );

    if (!transactionResult) {
        return { status: 'not-found' };
    }
    return {
        status: 'success',
        newId: transactionResult.newId,
        data: transactionResult.data,
    };
}

// returns the id of the stored recovery
export async function storeRecovery(
    tabId: number | undefined,
    composed: THistoryEntryDataComposed,
    getThumbnail: (factor: number) => HTMLCanvasElement,
): Promise<number> {
    // prepare the thumbnail. less transaction blocking
    const fit = fitInto(
        composed.size.width,
        composed.size.height,
        RECOVERY_THUMB_WIDTH_PX,
        RECOVERY_THUMB_HEIGHT_PX,
    );
    const thumbCanvas = getThumbnail(fit.width / composed.size.width);
    const thumbCtx = BB.ctx(thumbCanvas);
    const thumbImageData = {
        id: randomUuid(),
        data: thumbCtx.getImageData(0, 0, thumbCanvas.width, thumbCanvas.height),
    };

    return KL_INDEXED_DB.runTransaction(
        [RECOVERY_STORE, IMAGE_DATA_STORE, PROJECT_STORE],
        'readwrite',
        async (transaction) => {
            // get the existing recoveries and resolve the id to store under
            const recoveryEntries = await getRecoveryEntriesInTransaction(transaction);
            const resolvedTabId = tabId ?? genNewId(recoveryEntries.map(({ id }) => +id));
            const storedRecovery = recoveryEntries.find(
                ({ id }) => id === resolvedTabId.toString(),
            )?.recovery;

            // serialize the project and collect new image data to store
            const { recovery, newImageDataEntries, obsoleteImageDataIds } = serializeRecovery(
                composed,
                thumbImageData,
                storedRecovery,
            );

            // if the new total size exceeds the limit, remove the oldest other recoveries
            const otherRecoveryEntries = recoveryEntries.filter(
                (entry) => entry.id !== resolvedTabId.toString(),
            );
            const otherRecoveriesBytes = otherRecoveryEntries.reduce(
                (sum, entry) => sum + entry.recovery.memoryEstimateBytes,
                0,
            );
            const toRemoveRecoveryIds: string[] = [];
            const toRemoveImageDataIds: string[] = [];
            const overLimitByBytes =
                otherRecoveriesBytes + recovery.memoryEstimateBytes - RECOVERY_MEMORY_LIMIT_BYTES;
            if (overLimitByBytes > 0) {
                let toRemoveBytes = 0;
                const oldestFirstEntries = otherRecoveryEntries.sort(
                    (a, b) => a.recovery.timestamp - b.recovery.timestamp,
                );
                for (const entry of oldestFirstEntries) {
                    if (toRemoveBytes >= overLimitByBytes) {
                        break;
                    }
                    toRemoveRecoveryIds.push(entry.id);
                    toRemoveImageDataIds.push(...getRecoveryImageDataIds(entry.recovery));
                    toRemoveBytes += entry.recovery.memoryEstimateBytes;
                }
            }

            // update the recoveries and image data atomically
            await transaction.bulkRemove(RECOVERY_STORE, toRemoveRecoveryIds);
            await transaction.bulkSet(IMAGE_DATA_STORE, newImageDataEntries);
            await transaction.set(RECOVERY_STORE, resolvedTabId.toString(), recovery);
            await removeOrphansInTransaction(transaction, [
                ...obsoleteImageDataIds,
                ...toRemoveImageDataIds,
            ]);

            return resolvedTabId;
        },
    );
}

export async function deleteRecovery(id: string): Promise<void> {
    await KL_INDEXED_DB.runTransaction(
        [RECOVERY_STORE, IMAGE_DATA_STORE, PROJECT_STORE],
        'readwrite',
        async (transaction) => {
            const recovery = await transaction.get(RECOVERY_STORE, id);
            if (!recovery) {
                return;
            }
            await transaction.remove(RECOVERY_STORE, id);
            await removeOrphansInTransaction(transaction, getRecoveryImageDataIds(recovery));
        },
    );
}
