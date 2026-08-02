import { isLayerFill } from '../kl-types';
import { THistoryEntryData } from './history.types';
import { HISTORY_TILE_SIZE } from './kl-history';
import { getTileSizeFromIndex } from './image-data-tile';

// creates some visibility for problems with history entries.
export function validateHistoryEntry(
    entryData: THistoryEntryData,
    previousSize: { width: number; height: number },
): void {
    const size = entryData.size ?? previousSize;
    const tilesX = Math.ceil(size.width / HISTORY_TILE_SIZE);
    const tilesY = Math.ceil(size.height / HISTORY_TILE_SIZE);
    const expectedTileCount = tilesX * tilesY;

    const layerEntries = Object.entries(entryData.layerMap ?? {});
    for (let layerIndex = 0; layerIndex < layerEntries.length; layerIndex++) {
        const [layerId, layer] = layerEntries[layerIndex];
        if (layer.tiles === undefined) {
            continue;
        }
        if (layer.tiles.length !== expectedTileCount) {
            const err = `[KlHistory] Invalid tile count for layer "${layerId}": expected ${expectedTileCount}, got ${layer.tiles.length}`;
            setTimeout(() => {
                throw new Error(err);
            });
            // one error is enough
            return;
        }

        for (let tileIndex = 0; tileIndex < layer.tiles.length; tileIndex++) {
            const tile = layer.tiles[tileIndex];
            if (tile === undefined || isLayerFill(tile)) {
                continue;
            }
            const tileSize = getTileSizeFromIndex(tileIndex, size);
            if (tile.data.width !== tileSize.width || tile.data.height !== tileSize.height) {
                const err = `[KlHistory] Invalid tile dimensions for layer "${layerId}" at index ${tileIndex}: expected ${tileSize.width}x${tileSize.height}, got ${tile.data.width}x${tile.data.height}`;
                setTimeout(() => {
                    throw new Error(err);
                });
                // one error is enough
                return;
            }
        }
    }
}
