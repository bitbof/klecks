import { THistoryEntryData } from './history.types';
import { isLayerFill } from '../kl-types';

// estimates how much memory a history entry uses
export function estimateBytes(entry: THistoryEntryData): number {
    let result = 0;

    // for complex selection paths
    entry.selection?.value?.forEach((poly) => {
        poly.forEach((ring) => {
            result += ring.length * 2 * 8; // each number 8 bytes
        });
    });

    entry.layerMap &&
        Object.entries(entry.layerMap).forEach(([, layer]) => {
            layer.tiles?.forEach((tile) => {
                if (tile === undefined) {
                    return;
                }
                if (isLayerFill(tile)) {
                    result += tile.fill.length * 2; // 2 byte per character
                } else {
                    result += tile.data.width * tile.data.height * 4; // 4 channels, each 1 byte
                }
            });
        });

    return result;
}
