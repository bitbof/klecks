import {
    THistoryEntryData,
    THistoryEntryDataComposed,
    THistoryEntryLayer,
    THistoryEntryLayerComposed,
    THistoryEntryLayerTile,
    TLayerId,
} from './history.types';

// finds the largest index that is defined
function getLatestDefined<GType>(array: (GType | undefined)[]): GType {
    for (let i = array.length - 1; i >= 0; i--) {
        const value = array[i];
        if (value !== undefined) {
            return value;
        }
    }
    throw new Error('no defined entry found');
}

// in an array of maps, finds array[i][prop] for the largest index
// where array[i][prop] is defined
function getLatestDefinedProp<
    GProp extends string,
    GValue,
    GArray extends { [K in GProp]?: GValue },
>(array: (GArray | undefined)[], prop: GProp): GValue {
    for (let i = array.length - 1; i >= 0; i--) {
        if (!array[i]) {
            continue;
        }
        const value = array[i]![prop];
        if (value !== undefined) {
            return value;
        }
    }
    throw new Error('no defined entry found');
}

// For each tile gets the latest which is defined.
// Each tile[] is from a history entry.
function composeLayerTiles(
    tilesEntries: ((THistoryEntryLayerTile | undefined)[] | undefined)[],
): THistoryEntryLayerTile[] {
    const result = [...getLatestDefined(tilesEntries)];
    Object.entries(result).forEach(([id]) => {
        result[+id] = getLatestDefinedProp(tilesEntries as any, id);
    });
    return result as THistoryEntryLayerTile[];
}

// combines layers from multiple history entries into the latest representation
function composeLayer(
    layerEntries: (THistoryEntryLayer | undefined)[],
): THistoryEntryLayerComposed {
    return {
        name: getLatestDefinedProp(layerEntries, 'name'),
        opacity: getLatestDefinedProp(layerEntries, 'opacity'),
        isVisible: getLatestDefinedProp(layerEntries, 'isVisible'),
        mixModeStr: getLatestDefinedProp(layerEntries, 'mixModeStr'),
        index: getLatestDefinedProp(layerEntries, 'index'),
        tiles: composeLayerTiles(layerEntries.map((item) => (item ? item.tiles : undefined))),
    };
}

// combines layerMaps from multiple history entries into the latest representation
function composeLayerMap(layerMaps: (Record<TLayerId, THistoryEntryLayer> | undefined)[]) {
    const result = { ...getLatestDefined(layerMaps) };
    Object.entries(result).forEach(([id]) => {
        result[id] = composeLayer(layerMaps.map((item) => (item ? item[id] : undefined)));
    });
    return result as Record<TLayerId, THistoryEntryLayerComposed>;
}

/**
 * Combines multiple history entries into one. Entries after targetIndex are ignored.
 *
 * Each history entry only contains changes (e.g. name of layer 1 changed, or an area of layer 2 got
 * changed by a brush stroke), so it isn't the complete picture. Combining everything gives the complete picture.
 *
 * When combining it always takes the most recent data (<=targetIndex).
 * [oldest, ..., newest]
 */
export function composeHistoryStateData(
    entries: THistoryEntryData[],
    targetIndex?: number,
): THistoryEntryDataComposed {
    if (targetIndex === undefined) {
        targetIndex = entries.length - 1;
    }
    entries = entries.slice(0, targetIndex + 1);
    return {
        projectId: getLatestDefinedProp(entries, 'projectId'),
        size: getLatestDefinedProp(entries, 'size'),
        activeLayerId: getLatestDefinedProp(entries, 'activeLayerId'),
        selection: getLatestDefinedProp(entries, 'selection'),
        layerMap: composeLayerMap(entries.map((item) => item.layerMap)),
    };
}
