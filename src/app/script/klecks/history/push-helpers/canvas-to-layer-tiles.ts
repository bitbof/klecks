import { THistoryEntryLayerTile } from '../history.types';
import { HISTORY_TILE_SIZE } from '../kl-history';
import { getTileFromCanvas } from './get-tile-from-canvas';
import { getChangedTiles } from './changed-tiles';
import { createImageDataTile, getTileSize } from '../image-data-tile';
import { TIndexBounds } from '../../../bb/bb-types';
import { getImageDataSafely } from '../../../bb/base/canvas';

export function canvasAndChangedTilesToLayerTiles(
    canvas: HTMLCanvasElement,
    changedTiles: boolean[],
): (THistoryEntryLayerTile | undefined)[] {
    const result: (THistoryEntryLayerTile | undefined)[] = [];
    const tilesX = Math.ceil(canvas.width / HISTORY_TILE_SIZE);
    const tilesY = Math.ceil(canvas.height / HISTORY_TILE_SIZE);

    for (let row = 0; row < tilesY; row++) {
        for (let col = 0; col < tilesX; col++) {
            result.push(
                changedTiles[row * tilesX + col]
                    ? createImageDataTile(getTileFromCanvas(canvas, col, row))
                    : undefined,
            );
        }
    }
    return result;
}

export function canvasToLayerTiles(canvas: HTMLCanvasElement): THistoryEntryLayerTile[];
export function canvasToLayerTiles(
    canvas: HTMLCanvasElement,
    bounds?: TIndexBounds, // canvas area that changed. if undefined -> everything changed
): (THistoryEntryLayerTile | undefined)[];
export function canvasToLayerTiles(
    canvas: HTMLCanvasElement,
    bounds?: TIndexBounds, // canvas area that changed. if undefined -> everything changed
): (THistoryEntryLayerTile | undefined)[] {
    if (bounds) {
        const changedTiles = getChangedTiles(bounds, canvas.width, canvas.height);
        return canvasAndChangedTilesToLayerTiles(canvas, changedTiles);
    } else {
        // only do a single read back
        const ctx = canvas.getContext('2d')!;
        /*
            Uncaught SecurityError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': The canvas has been tainted by cross-origin data.
            Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
            -> no idea how this was achieved. Tried importing svg with cross-origin content. Did not result in that exception
         */
        // InvalidStateError: The object is in an invalid state.
        const fullImageData = getImageDataSafely(ctx, 0, 0, canvas.width, canvas.height);
        const tilesX = Math.ceil(canvas.width / HISTORY_TILE_SIZE);
        const tilesY = Math.ceil(canvas.height / HISTORY_TILE_SIZE);
        const result: THistoryEntryLayerTile[] = [];

        // manually transfer into tiles
        for (let row = 0; row < tilesY; row++) {
            for (let col = 0; col < tilesX; col++) {
                const tileSize = getTileSize(col, row, canvas);
                const x = col * HISTORY_TILE_SIZE;
                const y = row * HISTORY_TILE_SIZE;
                const tileData = new ImageData(tileSize.width, tileSize.height);
                for (let line = 0; line < tileSize.height; line++) {
                    const srcStart = ((y + line) * canvas.width + x) * 4;
                    const destStart = line * tileSize.width * 4;
                    tileData.data.set(
                        fullImageData.data.subarray(srcStart, srcStart + tileSize.width * 4),
                        destStart,
                    );
                }
                result.push(createImageDataTile(tileData));
            }
        }
        return result;
    }
}
