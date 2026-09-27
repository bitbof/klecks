import { THistoryEntryData } from './history.types';
import { isLayerFill } from '../kl-types';

export function getImageDataBytes(imageData: ImageData): number {
    return imageData.data.byteLength;
}

export function getFillBytes(fillStr: string): number {
    // 2 byte per character
    return fillStr.length * 2;
}

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
                    result += getFillBytes(tile.fill);
                } else {
                    result += getImageDataBytes(tile.data);
                }
            });
        });

    return result;
}
