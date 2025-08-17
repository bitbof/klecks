import { THistoryEntryLayerTile } from '../history.types';
import { HISTORY_TILE_SIZE } from '../kl-history';
import { getTileFromCanvas } from './get-tile-from-canvas';
import { TBounds } from '../../../bb/bb-types';
import { getChangedTiles } from './changed-tiles';
import { createImageDataTile } from '../image-data-tile';

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
                    ? createImageDataTile(getTileFromCanvas(canvas, col, row, HISTORY_TILE_SIZE))
                    : undefined,
            );
        }
    }
    return result;
}

export function canvasToLayerTiles(canvas: HTMLCanvasElement): THistoryEntryLayerTile[];
export function canvasToLayerTiles(
    canvas: HTMLCanvasElement,
    bounds?: TBounds, // canvas area that changed. if undefined -> everything changed
): (THistoryEntryLayerTile | undefined)[];
export function canvasToLayerTiles(
    canvas: HTMLCanvasElement,
    bounds?: TBounds, // canvas area that changed. if undefined -> everything changed
): (THistoryEntryLayerTile | undefined)[] {
    if (bounds) {
        const changedTiles = getChangedTiles(bounds, canvas.width, canvas.height);
        return canvasAndChangedTilesToLayerTiles(canvas, changedTiles);
    } else {
        // only do a single read back
        const ctx = canvas.getContext('2d')!;
        const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const tilesX = Math.ceil(canvas.width / HISTORY_TILE_SIZE);
        const tilesY = Math.ceil(canvas.height / HISTORY_TILE_SIZE);
        const result: THistoryEntryLayerTile[] = [];

        // manually transfer into tiles
        for (let row = 0; row < tilesY; row++) {
            for (let col = 0; col < tilesX; col++) {
                const x = col * HISTORY_TILE_SIZE;
                const y = row * HISTORY_TILE_SIZE;
                const tileWidth = Math.min(HISTORY_TILE_SIZE, canvas.width - x);
                const tileHeight = Math.min(HISTORY_TILE_SIZE, canvas.height - y);

                const tileData = new ImageData(tileWidth, tileHeight);
                for (let line = 0; line < tileHeight; line++) {
                    const srcStart = ((y + line) * canvas.width + x) * 4;
                    const destStart = line * tileWidth * 4;
                    tileData.data.set(
                        fullImageData.data.subarray(srcStart, srcStart + tileWidth * 4),
                        destStart,
                    );
                }
                result.push(createImageDataTile(tileData));
            }
        }
        return result;
    }
}
