import { TBounds } from '../../../bb/bb-types';
import { HISTORY_TILE_SIZE } from '../kl-history';
import { boundsInArea, clamp } from '../../../bb/math/math';
import { createArray } from '../../../bb/base/base';

// returns array, each entry represents a tile, as a boolean
// true - intersected with bounds
export function getChangedTiles(
    bounds: TBounds, // canvas space
    width: number,
    height: number,
    tileSize: number = HISTORY_TILE_SIZE,
): boolean[] {
    // ensure: 1 top left, 2 bottom right
    bounds = {
        x1: Math.min(bounds.x1, bounds.x2),
        y1: Math.min(bounds.y1, bounds.y2),
        x2: Math.max(bounds.x1, bounds.x2),
        y2: Math.max(bounds.y1, bounds.y2),
    };
    const boundsInCanvas = boundsInArea(bounds, width, height);
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    if (!boundsInCanvas) {
        // no change if bounds don't overlap canvas
        return createArray(tilesX * tilesY, false);
    }
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
