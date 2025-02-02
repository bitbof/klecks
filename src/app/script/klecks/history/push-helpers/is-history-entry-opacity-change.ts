import { THistoryEntryData } from '../history.types';

// Is it a history entry where the *only* change is the opacity of layerId
export function isHistoryEntryOpacityChange(entry: THistoryEntryData, layerId: string): boolean {
    const keys = Object.keys(entry);
    if (keys.length !== 1 || !entry.layerMap) {
        return false;
    }
    const ids = Object.keys(entry.layerMap);
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const layer = entry.layerMap[id];
        if (id === layerId) {
            const layerKeys = Object.keys(layer);
            if (layerKeys.length !== 1 || layerKeys[0] !== 'opacity') {
                return false;
            }
        } else {
            const layerKeys = Object.keys(layer);
            if (layerKeys.length > 0) {
                return false;
            }
        }
    }
    return true;
}
