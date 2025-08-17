import {
    BROWSER_STORAGE_STORE,
    IMAGE_DATA_STORE,
    KL_INDEXED_DB,
    RECOVERY_STORE,
} from './kl-indexed-db';
import { loadImage } from './project-converter';
import { isLayerFill, TDeserializedKlStorageProject, TKlProjectLayer } from '../kl-types';
import { BB } from '../../bb/bb';
import { HISTORY_TILE_SIZE } from '../history/kl-history';
import { THistoryEntryDataComposed, THistoryEntryLayerTile } from '../history/history.types';
import { sortLayerMap } from '../history/sort-layer-map';
import { fitInto, isBlob, randomUuid, timeoutWrapper } from '../../bb/base/base';
import {
    RECOVERY_AGE_LIMIT_MS,
    RECOVERY_MEMORY_LIMIT_BYTES,
    RECOVERY_THUMB_HEIGHT_PX,
    RECOVERY_THUMB_WIDTH_PX,
    TRecoveryMetaData,
} from './kl-recovery-manager';
import { TIdb } from './kl-indexed-db.types';
import { isTImageDataReference } from './project-store';

export async function getIdsFromRecoveryStore(): Promise<number[]> {
    const keys = await KL_INDEXED_DB.getKeys(RECOVERY_STORE);
    return keys.map((item) => +item);
}

export async function getImageDataIdsFromStorage(): Promise<string[]> {
    return await KL_INDEXED_DB.getKeys(IMAGE_DATA_STORE);
}

export async function clearOldRecoveries(): Promise<void> {
    const ids = await KL_INDEXED_DB.getKeys(RECOVERY_STORE);
    const recoveries = (await Promise.all(
        ids.map((id) => {
            return KL_INDEXED_DB.get(RECOVERY_STORE, id);
        }),
    )) as TIdb['V2']['RecoveryStore']['Read'][];
    await Promise.all(
        recoveries.map((recovery, index) => {
            if (recovery.timestamp < new Date().getTime() - RECOVERY_AGE_LIMIT_MS) {
                return deleteRecovery(ids[index]);
            }
            return Promise.resolve();
        }),
    );
}

async function loadFromImageDataStore(
    id: string,
    commonCtx: CanvasRenderingContext2D,
): Promise<ImageData> {
    const result = (await KL_INDEXED_DB.get(IMAGE_DATA_STORE, id)) as
        | TIdb['V2']['ImageDataStore']['Read']
        | undefined;
    if (!result) {
        commonCtx.clearRect(0, 0, HISTORY_TILE_SIZE, HISTORY_TILE_SIZE);
        return commonCtx.getImageData(0, 0, HISTORY_TILE_SIZE, HISTORY_TILE_SIZE);
    }
    if (isBlob(result)) {
        let image: HTMLImageElement | undefined;
        try {
            image = await loadImage(result);
        } catch (e) {
            // someday maybe pass error with result, to show user something went wrong
        }
        commonCtx.canvas.width = image?.width ?? commonCtx.canvas.width;
        commonCtx.canvas.height = image?.height ?? commonCtx.canvas.height;
        // no clear needed, because size was set
        image && commonCtx.drawImage(image, 0, 0);
        return commonCtx.getImageData(0, 0, commonCtx.canvas.width, commonCtx.canvas.height);
    }
    return result;
}

async function getRawRecoveryProject(
    id: number,
): Promise<TIdb['V2']['RecoveryStore']['Read'] | undefined> {
    return (await KL_INDEXED_DB.get(RECOVERY_STORE, '' + id)) as
        | TIdb['V2']['RecoveryStore']['Read']
        | undefined;
}

/**
 * Removes orphaned tiles. Doesn't delete those still referenced.
 */
export async function removeOrphans(candidateIds?: string[]): Promise<void> {
    const imageDataIds = candidateIds ?? (await getImageDataIdsFromStorage());
    const usedIds = new Set<string>();
    const recoveryIds = await getIdsFromRecoveryStore();
    for (const id of recoveryIds) {
        const raw = (await KL_INDEXED_DB.get(RECOVERY_STORE, '' + id)) as
            | TIdb['V2']['RecoveryStore']['Read']
            | undefined;
        if (!raw) {
            continue;
        }
        for (const layer of raw.layers) {
            for (const tile of layer.image) {
                if (!isLayerFill(tile)) {
                    usedIds.add(tile.id);
                }
            }
        }
        usedIds.add(raw.thumbnail);
    }

    // also have to check browser storage store
    const browserStorageRaw = (await KL_INDEXED_DB.get(
        BROWSER_STORAGE_STORE,
        1,
    )) as TIdb['V2']['ProjectStore']['Read'];
    if (browserStorageRaw) {
        if (isTImageDataReference(browserStorageRaw.thumbnail)) {
            usedIds.add(browserStorageRaw.thumbnail.id);
        }
        for (const layer of browserStorageRaw.layers) {
            if (isTImageDataReference(layer.blob)) {
                usedIds.add(layer.blob.id);
            }
        }
    }

    // remove entries
    await KL_INDEXED_DB.bulkRemove(
        IMAGE_DATA_STORE,
        imageDataIds.filter((id) => !usedIds.has(id)),
    );
}

export async function getRecovery(
    tabId: number,
): Promise<TDeserializedKlStorageProject | undefined> {
    const raw = (await KL_INDEXED_DB.get(RECOVERY_STORE, '' + tabId)) as
        | TIdb['V2']['RecoveryStore']['Read']
        | undefined;
    if (raw === undefined) {
        return undefined;
    }

    // shared canvas to load tiles
    const canvas = BB.canvas(HISTORY_TILE_SIZE, HISTORY_TILE_SIZE);
    const ctx = BB.ctx(canvas);

    // speed up by loading in parallel
    const layers: TKlProjectLayer[] = [];
    await Promise.all<void>(
        raw.layers.map(async (layerSerialized, index) => {
            const tiles: THistoryEntryLayerTile[] = [];
            for (let index = 0; index < layerSerialized.image.length; index++) {
                const tile = layerSerialized.image[index];
                if (isLayerFill(tile)) {
                    tiles.push(tile);
                } else {
                    tiles.push({
                        id: tile.id,
                        data: await loadFromImageDataStore(tile.id, ctx),
                    });
                }
            }
            layers[index] = {
                ...layerSerialized,
                image: tiles,
            };
        }),
    );

    return {
        project: {
            projectId: (raw.projectId as string | undefined) ?? randomUuid(), // was not always defined during beta
            width: raw.width,
            height: raw.height,
            layers,
        },
        timestamp: 0,
        thumbnail: await getThumbnail(raw.thumbnail),
    };
}

async function getThumbnail(id: string): Promise<HTMLImageElement | HTMLCanvasElement> {
    const canvas = BB.canvas(HISTORY_TILE_SIZE, HISTORY_TILE_SIZE);
    const ctx = BB.ctx(canvas);
    const imageData = await loadFromImageDataStore(id, ctx);
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// returns false if recovery doesn't exist
export async function changeRecoveryId(oldId: number, newId: number): Promise<boolean> {
    const storedProjectSerialized = await getRawRecoveryProject(oldId);
    if (!storedProjectSerialized) {
        // nothing to do
        return false;
    }
    storedProjectSerialized.timestamp = new Date().getTime();
    await KL_INDEXED_DB.set(RECOVERY_STORE, '' + newId, storedProjectSerialized);
    await KL_INDEXED_DB.remove(RECOVERY_STORE, '' + oldId);
    return true;
}

export async function storeRecovery(
    tabId: number,
    composed: THistoryEntryDataComposed,
    getThumbnail: (factor: number) => HTMLCanvasElement,
): Promise<void> {
    let orphanCandidates: string[] | undefined;

    try {
        // get thumbnail early to be accurate
        const fit = fitInto(
            composed.size.width,
            composed.size.height,
            RECOVERY_THUMB_WIDTH_PX,
            RECOVERY_THUMB_HEIGHT_PX,
        );
        const thumbCanvas = getThumbnail(fit.width / composed.size.width);

        const sortedComposedLayers = Object.values(composed.layerMap).sort(sortLayerMap);

        // make a list of existing imageData ids in A (stored project)
        const storedProjectSerialized = await timeoutWrapper(
            getRawRecoveryProject(tabId),
            'storeRecovery.getRawRecoveryProject',
        );
        const storedImageDataIds = new Set(
            storedProjectSerialized?.layers.flatMap((layer) => {
                return layer.image
                    .map((tile) => (!isLayerFill(tile) ? tile.id : undefined))
                    .filter((id) => id !== undefined);
            }),
        );
        storedProjectSerialized && storedImageDataIds.add(storedProjectSerialized.thumbnail);

        // to help calculate updated memoryEstimateBytes
        const storedImageDataSizes: Record<string, number> = {};
        storedProjectSerialized &&
            storedProjectSerialized.layers.forEach((layer) => {
                layer.image.forEach((tile) => {
                    if (!isLayerFill(tile)) {
                        storedImageDataSizes[tile.id] = tile.sizeBytes || 0;
                    }
                });
            });

        // make a list of imageData ids in B (to be stored)
        const idsFromProject = new Set(
            sortedComposedLayers.flatMap((layer) => {
                return layer.tiles.flatMap((tile) => {
                    return isLayerFill(tile) ? [] : [tile.id];
                });
            }),
        );

        // the to delete list: not in B (aka no longer stored)
        orphanCandidates = [...storedImageDataIds].filter((id) => {
            return !idsFromProject.has(id);
        });

        const layers: TIdb['V2']['RecoveryStore']['Write']['layers'] = [];
        const imageDataList: { id: string; data: TIdb['V2']['ImageDataStore']['Write'] }[] = [];

        // estimate memory
        let memoryEstimateBytes = 0;

        for (const composedLayer of sortedComposedLayers) {
            layers.push({
                name: composedLayer.name,
                isVisible: composedLayer.isVisible,
                opacity: composedLayer.opacity,
                mixModeStr: composedLayer.mixModeStr,
                image: await (async () => {
                    const result: TIdb['V2']['RecoveryStore']['Write']['layers'][number]['image'] =
                        [];
                    for (const tile of composedLayer.tiles) {
                        if (isLayerFill(tile)) {
                            result.push(tile);
                            memoryEstimateBytes += tile.fill.length;
                        } else {
                            let size = 0;
                            if (storedImageDataIds.has(tile.id)) {
                                size = storedImageDataSizes[tile.id];
                            } else {
                                imageDataList.push({
                                    id: tile.id,
                                    data: tile.data,
                                });
                                size = tile.data.width * tile.data.height * 4; // 4 channels, each 1 byte
                            }
                            memoryEstimateBytes += size;
                            result.push({ id: tile.id, sizeBytes: size });
                        }
                    }
                    return result;
                })(),
            });
        }
        const thumbImageData: { id: string; data: ImageData } = {
            id: randomUuid(),
            data: (() => {
                const thumbCtx = BB.ctx(thumbCanvas);
                return thumbCtx.getImageData(0, 0, thumbCanvas.width, thumbCanvas.height);
            })(),
        };
        imageDataList.push(thumbImageData);
        memoryEstimateBytes += thumbImageData.data.width * thumbImageData.data.height * 4; // 4 channels, each 1 byte

        const serialized: TIdb['V2']['RecoveryStore']['Write'] = {
            projectId: composed.projectId.value,
            width: composed.size.width,
            height: composed.size.height,
            timestamp: new Date().getTime(), // - RECOVERY_AGE_LIMIT_MS,
            thumbnail: thumbImageData.id,
            layers,
            memoryEstimateBytes,
        };

        // check will we be over the memory limit - if so, removed oldest drawings until we won't.
        const totalExceptDrawingBytes = await timeoutWrapper(
            getTotalMemoryExceptCurrentDrawing(tabId),
            'storeRecovery.getTotalMemory',
        );
        if (totalExceptDrawingBytes + memoryEstimateBytes > RECOVERY_MEMORY_LIMIT_BYTES) {
            const overLimitByBytes =
                totalExceptDrawingBytes + memoryEstimateBytes - RECOVERY_MEMORY_LIMIT_BYTES;
            let toBeRemovedBytes = 0;
            const idsToRemove: string[] = [];
            const metas = (await getAllMeta()).sort((a, b) => {
                if (a.timestamp > b.timestamp) {
                    return 1;
                }
                if (a.timestamp < b.timestamp) {
                    return -1;
                }
                return 0;
            });
            metas.forEach((meta) => {
                if (toBeRemovedBytes >= overLimitByBytes) {
                    // removed enough
                    return;
                }
                idsToRemove.push(meta.id);
                toBeRemovedBytes += meta.memoryEstimateBytes;
            });
            // also make sure to remove the imagedata
            for (const id of idsToRemove) {
                await deleteRecovery(id);
            }
        }

        // store first. so nothing will be lost if something goes wrong
        await timeoutWrapper(
            KL_INDEXED_DB.bulkSet(
                IMAGE_DATA_STORE,
                imageDataList.map((item) => {
                    return {
                        key: item.id,
                        value: item.data,
                    };
                }),
            ),
            'storeRecovery.storeTile',
            1000 * 30,
        );

        await timeoutWrapper(
            KL_INDEXED_DB.set(RECOVERY_STORE, '' + tabId, serialized),
            'storeRecovery.storeRecovery',
        );
    } finally {
        /*
        Orphaned tiles are possible and must be cleaned up, even if there's a timeout or other exception.
         */
        await timeoutWrapper(removeOrphans(orphanCandidates), 'storeRecovery.removeOrphans', 8000);
    }
}

export async function deleteRecovery(id: string): Promise<void> {
    const recovery = (await KL_INDEXED_DB.get(RECOVERY_STORE, id)) as
        | TIdb['V2']['RecoveryStore']['Read']
        | undefined;
    if (!recovery) {
        return;
    }
    await KL_INDEXED_DB.remove(RECOVERY_STORE, id);

    const orphanCandidates: string[] = [recovery.thumbnail];
    for (const layer of recovery.layers) {
        for (const tile of layer.image) {
            if (!isLayerFill(tile)) {
                orphanCandidates.push(tile.id);
            }
        }
    }

    // prevent deletion of tiles referenced by multiple recoveries.
    await removeOrphans(orphanCandidates);
}

async function getAllMeta(): Promise<TRecoveryMetaData[]> {
    const ids = await getIdsFromRecoveryStore();
    const result: TRecoveryMetaData[] = [];
    for (const id of ids) {
        result.push(await getMetadata('' + id));
    }
    return result;
}

async function getTotalMemoryExceptCurrentDrawing(tabId: number): Promise<number> {
    const ids = await getIdsFromRecoveryStore();
    let result = 0;
    for (const id of ids) {
        if (id === tabId) {
            continue;
        }
        const meta = await getMetadata('' + id);
        result += meta.memoryEstimateBytes;
    }
    return result;
}

export async function getMetadata(
    drawingId: string,
    includeThumbnail?: boolean,
): Promise<TRecoveryMetaData> {
    const raw = await KL_INDEXED_DB.get(RECOVERY_STORE, drawingId);
    if (raw === undefined) {
        throw new Error('drawing not found');
    }
    const parsed = raw as TIdb['V2']['RecoveryStore']['Read'];

    return {
        id: drawingId,
        width: parsed.width,
        height: parsed.height,
        thumbnail: includeThumbnail ? await getThumbnail(parsed.thumbnail) : undefined,
        timestamp: parsed.timestamp,
        memoryEstimateBytes: parsed.memoryEstimateBytes,
    };
}
