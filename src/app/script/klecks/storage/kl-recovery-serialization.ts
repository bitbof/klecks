import { loadImage } from './project-converter';
import { isLayerFill, TDeserializedKlStorageProject, TKlProjectLayer } from '../kl-types';
import { BB } from '../../bb/bb';
import { HISTORY_TILE_SIZE } from '../history/kl-history';
import {
    THistoryEntryDataComposed,
    THistoryEntryLayerTile,
    TImageDataTile,
} from '../history/history.types';
import { sortLayerMap } from '../history/sort-layer-map';
import { getAbortError, isBlob, randomUuid } from '../../bb/base/base';
import { TIdb } from './kl-indexed-db.types';
import { getFillBytes, getImageDataBytes } from '../history/estimate-bytes';
import { getTileSizeFromIndex } from '../history/image-data-tile';

type TImageDataRead = TIdb['V2']['ImageDataStore']['Read'];

export function getRecoveryImageDataIds(recovery: TIdb['V2']['RecoveryStore']['Read']): string[] {
    return [
        recovery.thumbnail,
        ...recovery.layers.flatMap((layer) =>
            layer.image.flatMap((tile) => (isLayerFill(tile) ? [] : [tile.id])),
        ),
    ];
}

export type TSerializedRecoveryBundle = {
    recovery: TIdb['V2']['RecoveryStore']['Write'];
    newImageDataEntries: {
        key: string;
        value: TIdb['V2']['ImageDataStore']['Write'];
    }[];
    obsoleteImageDataIds: string[];
};

export function serializeRecovery(
    composed: THistoryEntryDataComposed,
    thumbnail: { id: string; data: ImageData },
    previousRecovery?: TIdb['V2']['RecoveryStore']['Read'],
): TSerializedRecoveryBundle {
    const previousImageDataIdSet = new Set(
        previousRecovery ? getRecoveryImageDataIds(previousRecovery) : [],
    );

    // create the recovery layers and image data entries, and sum up the memory use
    const layers: TIdb['V2']['RecoveryStore']['Write']['layers'] = [];
    const imageDataEntries: TSerializedRecoveryBundle['newImageDataEntries'] = [
        { key: thumbnail.id, value: thumbnail.data },
    ];
    let memoryEstimateBytes = getImageDataBytes(thumbnail.data);
    const sortedComposedLayers = Object.values(composed.layerMap).sort(sortLayerMap);
    for (const composedLayer of sortedComposedLayers) {
        const image: TIdb['V2']['RecoveryStore']['Write']['layers'][number]['image'] = [];
        for (const tile of composedLayer.tiles) {
            if (isLayerFill(tile)) {
                memoryEstimateBytes += getFillBytes(tile.fill);
                image.push(tile);
            } else {
                imageDataEntries.push({ key: tile.id, value: tile.data });
                const size = getImageDataBytes(tile.data);
                memoryEstimateBytes += size;
                image.push({ id: tile.id, sizeBytes: size });
            }
        }
        layers.push({
            name: composedLayer.name,
            isVisible: composedLayer.isVisible,
            opacity: composedLayer.opacity,
            mixModeStr: composedLayer.mixModeStr,
            image,
        });
    }

    const newImageDataEntries = imageDataEntries.filter(
        (item) => !previousImageDataIdSet.has(item.key),
    );
    const obsoleteImageDataIds = [
        ...previousImageDataIdSet.difference(new Set(imageDataEntries.map((item) => item.key))),
    ];
    return {
        recovery: {
            projectId: composed.projectId.value,
            width: composed.size.width,
            height: composed.size.height,
            timestamp: Date.now(),
            thumbnail: thumbnail.id,
            layers,
            memoryEstimateBytes,
        },
        newImageDataEntries,
        obsoleteImageDataIds,
    };
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw getAbortError(signal);
    }
}

export type TRecoveryBundle = {
    recovery: TIdb['V2']['RecoveryStore']['Read'];
    imageDataById: Map<string, TImageDataRead | undefined>;
};

async function deserializeImageDataTile(
    id: string,
    readResult: TImageDataRead | undefined,
    commonCtx: CanvasRenderingContext2D,
    expectedSize: { width: number; height: number },
): Promise<TImageDataTile> {
    let imageData: ImageData | undefined;
    if (isBlob(readResult)) {
        try {
            const image = await loadImage(readResult);
            commonCtx.canvas.width = image.width;
            commonCtx.canvas.height = image.height;
            commonCtx.drawImage(image, 0, 0);
            imageData = commonCtx.getImageData(0, 0, image.width, image.height);
        } catch {
            // handled by empty fallback below
        }
    } else {
        imageData = readResult;
    }

    if (imageData?.width === expectedSize.width && imageData.height === expectedSize.height) {
        // all good
        return { id, data: imageData };
    }
    // Either no imageData, or imageData has wrong size.

    // Before 0.10.2 it was possible that the blend brush created tiles of the wrong size (always HISTORY_TILE_SIZE).
    // We fix those here, so nothing breaks.
    commonCtx.canvas.width = expectedSize.width;
    commonCtx.canvas.height = expectedSize.height;
    if (imageData) {
        // fixing tile with wrong size
        commonCtx.putImageData(imageData, 0, 0);
        return { id, data: commonCtx.getImageData(0, 0, expectedSize.width, expectedSize.height) };
    }

    // If we fail to load the tile, we still create an image data tile with the same ID.
    // This has the advantage that it might still get restored another time (if the user does not change it).
    // A layer fill tile would always overwrite the image data tile on the next store, causing a permanent loss.
    return { id, data: commonCtx.getImageData(0, 0, expectedSize.width, expectedSize.height) };
}

export async function deserializeRecovery(
    readResult: TRecoveryBundle,
    signal?: AbortSignal,
): Promise<TDeserializedKlStorageProject> {
    throwIfAborted(signal);
    const canvas = BB.canvas(HISTORY_TILE_SIZE, HISTORY_TILE_SIZE);
    const ctx = BB.ctx(canvas);
    const layers: TKlProjectLayer[] = [];

    for (const layer of readResult.recovery.layers) {
        const deserializedTiles: THistoryEntryLayerTile[] = [];
        for (const [tileIndex, tile] of layer.image.entries()) {
            throwIfAborted(signal);
            if (isLayerFill(tile)) {
                deserializedTiles.push(tile);
            } else {
                deserializedTiles.push(
                    await deserializeImageDataTile(
                        tile.id,
                        readResult.imageDataById.get(tile.id),
                        ctx,
                        getTileSizeFromIndex(tileIndex, readResult.recovery),
                    ),
                );
            }
        }
        layers.push({
            ...layer,
            image: deserializedTiles,
        });
    }

    throwIfAborted(signal);
    const thumbnail = await deserializeRecoveryThumbnail(
        readResult.imageDataById.get(readResult.recovery.thumbnail),
    );

    return {
        project: {
            projectId: readResult.recovery.projectId ?? randomUuid(),
            width: readResult.recovery.width,
            height: readResult.recovery.height,
            layers,
        },
        timestamp: 0,
        thumbnail,
    };
}

export async function deserializeRecoveryThumbnail(
    readResult: TImageDataRead | undefined,
): Promise<HTMLImageElement | HTMLCanvasElement> {
    const canvas = BB.canvas(HISTORY_TILE_SIZE, HISTORY_TILE_SIZE);
    const ctx = BB.ctx(canvas);
    if (!readResult) {
        return canvas;
    }
    if (isBlob(readResult)) {
        try {
            const image = await loadImage(readResult);
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
        } catch (e) {
            // noop
        }
        return canvas;
    }
    canvas.width = readResult.width;
    canvas.height = readResult.height;
    ctx.putImageData(readResult, 0, 0);
    return canvas;
}
