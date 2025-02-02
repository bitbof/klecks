import { THistoryEntryLayerTile } from './history.types';
import { HISTORY_TILE_SIZE } from './kl-history';

export function createFillColorTiles(
    width: number,
    height: number,
    fill: string,
): THistoryEntryLayerTile[] {
    const result: THistoryEntryLayerTile[] = [];
    const tilesX = Math.ceil(width / HISTORY_TILE_SIZE);
    const tilesY = Math.ceil(height / HISTORY_TILE_SIZE);
    for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
            result.push({ fill });
        }
    }
    return result;
}
