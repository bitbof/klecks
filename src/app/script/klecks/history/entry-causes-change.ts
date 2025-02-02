import { THistoryEntryData, THistoryEntryDataComposed } from './history.types';

// checks if `entry` would change `composed`
export function entryCausesChange(
    entry: THistoryEntryData,
    composed: THistoryEntryDataComposed,
): boolean {
    if (entry.size !== undefined) {
        if (entry.size.width !== composed.size.width) {
            return true;
        }
        if (entry.size.height !== composed.size.height) {
            return true;
        }
    }
    if (entry.selection !== undefined) {
        if (entry.selection.value !== composed.selection.value) {
            return true;
        }
    }
    if (entry.activeLayerId !== undefined) {
        if (entry.activeLayerId !== composed.activeLayerId) {
            return true;
        }
    }
    if (entry.layerMap !== undefined) {
        const entryLayerMapIds = Object.keys(entry.layerMap);
        for (const layerId of Object.keys(composed.layerMap)) {
            if (!entryLayerMapIds.includes(layerId)) {
                return true;
            }
        }
        for (const layerId of entryLayerMapIds) {
            const composedLayer = composed.layerMap[layerId];
            if (!composedLayer) {
                return true;
            }
            const entryLayer = entry.layerMap[layerId];
            if (entryLayer.name !== undefined && entryLayer.name !== composedLayer.name) {
                return true;
            }
            if (entryLayer.opacity !== undefined && entryLayer.opacity !== composedLayer.opacity) {
                return true;
            }
            if (
                entryLayer.isVisible !== undefined &&
                entryLayer.isVisible !== composedLayer.isVisible
            ) {
                return true;
            }
            if (
                entryLayer.mixModeStr !== undefined &&
                entryLayer.mixModeStr !== composedLayer.mixModeStr
            ) {
                return true;
            }
            if (entryLayer.index !== undefined && entryLayer.index !== composedLayer.index) {
                return true;
            }
            if (entryLayer.tiles !== undefined) {
                // not needed currently
                return true;
            }
        }
    }
    return false;
}
