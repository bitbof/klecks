import { TRect } from '../../../bb/bb-types';
import { HISTORY_TILE_SIZE } from '../kl-history';
import { getTileSizeFromIndex } from '../image-data-tile';

export function tileIndexToCanvasRect(
    index: number,
    canvasSize: { width: number; height: number },
): TRect {
    const tilesPerRow = Math.ceil(canvasSize.width / HISTORY_TILE_SIZE);
    const x = (index % tilesPerRow) * HISTORY_TILE_SIZE;
    const y = Math.floor(index / tilesPerRow) * HISTORY_TILE_SIZE;
    return { x, y, ...getTileSizeFromIndex(index, canvasSize) };
}
