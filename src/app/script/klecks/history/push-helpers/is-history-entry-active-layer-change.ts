import { THistoryEntryData } from '../history.types';

// does it exclusively change activeLayerId
export function isHistoryEntryActiveLayerChange(entry: THistoryEntryData): boolean {
    const keys = Object.keys(entry);
    return keys.length === 1 && keys[0] === 'activeLayerId';
}
