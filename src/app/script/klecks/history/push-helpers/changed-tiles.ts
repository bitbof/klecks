import { IBounds } from '../../../bb/bb-types';
import { HISTORY_TILE_SIZE } from '../kl-history';
import { clamp } from '../../../bb/math/math';
import { createArray } from '../../../bb/base/base';

// returns array, each entry represents a tile, as a boolean
// true - intersected with bounds
export function getChangedTiles(
    bounds: IBounds, // canvas space
    width: number,
    height: number,
    tileSize: number = HISTORY_TILE_SIZE,
): boolean[] {
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    const result: boolean[] = createArray(tilesX * tilesY, false);

    const tileBounds = {
        x1: clamp(Math.floor(bounds.x1 / tileSize), 0, tilesX - 1),
        y1: clamp(Math.floor(bounds.y1 / tileSize), 0, tilesY - 1),
        x2: clamp(Math.floor(bounds.x2 / tileSize), 0, tilesX - 1),
        y2: clamp(Math.floor(bounds.y2 / tileSize), 0, tilesY - 1),
    };
    for (let i = tileBounds.x1; i <= tileBounds.x2; i++) {
        for (let e = tileBounds.y1; e <= tileBounds.y2; e++) {
            result[e * tilesX + i] = true;
        }
    }
    return result;
}

// Combines old and new changes.
// A tile is changed if it's changed in new or old.
export function updateChangedTiles(
    oldChangedOrEmpty: boolean[], // important: can be empty array, while new has entries.
    newChanged: boolean[],
): boolean[] {
    return newChanged.map((newItem, index) => {
        return newItem || !!(oldChangedOrEmpty[index] as boolean | undefined);
    });
}
