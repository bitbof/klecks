import { TRect } from '../../../bb/bb-types';
import { HISTORY_TILE_SIZE } from '../kl-history';

export function tileIndexToCanvasRect(index: number, width: number): TRect {
    const tilesPerX = Math.ceil(width / HISTORY_TILE_SIZE);
    const x = (index % tilesPerX) * HISTORY_TILE_SIZE;
    const y = Math.floor(index / tilesPerX) * HISTORY_TILE_SIZE;
    return { x, y, width: HISTORY_TILE_SIZE, height: HISTORY_TILE_SIZE };
}
