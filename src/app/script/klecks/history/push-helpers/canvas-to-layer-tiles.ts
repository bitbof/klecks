import { THistoryEntryLayerTile } from '../history.types';
import { HISTORY_TILE_SIZE } from '../kl-history';
import { getTileFromCanvas } from './get-tile-from-canvas';
import { IBounds } from '../../../bb/bb-types';
import { getChangedTiles } from './changed-tiles';

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
                    ? getTileFromCanvas(canvas, col, row, HISTORY_TILE_SIZE)
                    : undefined,
            );
        }
    }
    return result;
}

export function canvasToLayerTiles(canvas: HTMLCanvasElement): THistoryEntryLayerTile[];
export function canvasToLayerTiles(
    canvas: HTMLCanvasElement,
    bounds?: IBounds, // canvas area that changed. if undefined -> everything changed
): (THistoryEntryLayerTile | undefined)[];
export function canvasToLayerTiles(
    canvas: HTMLCanvasElement,
    bounds?: IBounds, // canvas area that changed. if undefined -> everything changed
): (THistoryEntryLayerTile | undefined)[] {
    if (bounds) {
        const changedTiles = getChangedTiles(
            {
                x1: Math.max(0, bounds.x1),
                y1: Math.max(0, bounds.y1),
                x2: Math.min(canvas.width, bounds.x2),
                y2: Math.min(canvas.height, bounds.y2),
            },
            canvas.width,
            canvas.height,
        );
        return canvasAndChangedTilesToLayerTiles(canvas, changedTiles);
    } else {
        const tilesX = Math.ceil(canvas.width / HISTORY_TILE_SIZE);
        const tilesY = Math.ceil(canvas.height / HISTORY_TILE_SIZE);
        const result: (THistoryEntryLayerTile | undefined)[] = [];
        for (let row = 0; row < tilesY; row++) {
            for (let col = 0; col < tilesX; col++) {
                result.push(getTileFromCanvas(canvas, col, row, HISTORY_TILE_SIZE));
            }
        }
        return result;
    }
}
