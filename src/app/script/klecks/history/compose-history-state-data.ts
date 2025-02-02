import {
    THistoryEntryData,
    THistoryEntryDataComposed,
    THistoryEntryLayer,
    THistoryEntryLayerComposed,
    THistoryEntryLayerTile,
    TLayerId,
} from './history.types';

// finds the largest index (<=targetIndex) that is defined
function getLatestDefined<GType>(array: (GType | undefined)[], targetIndex: number): GType {
    for (let i = targetIndex; i >= 0; i--) {
        const value = array[i];
        if (value !== undefined) {
            return value;
        }
    }
    throw new Error('no defined entry found');
}

// in an array of maps, finds array[i][prop] for the largest index (<=targetIndex)
// where array[i][prop] is defined
function getLatestDefinedForProp<
    GProp extends string,
    GValue,
    GArray extends { [K in GProp]?: GValue },
>(array: (GArray | undefined)[], prop: GProp, targetIndex: number): GValue {
    for (let i = targetIndex; i >= 0; i--) {
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

// For each tile gets the latest (<=targetIndex) which is defined.
// Each tile[] is from a history entry.
function composeLayerTiles(
    tilesEntries: ((THistoryEntryLayerTile | undefined)[] | undefined)[],
    targetIndex: number,
): THistoryEntryLayerTile[] {
    const result = [...getLatestDefined(tilesEntries, targetIndex)];
    Object.entries(result).forEach(([id]) => {
        result[+id] = getLatestDefinedForProp(tilesEntries as any, id, targetIndex);
    });
    return result as THistoryEntryLayerTile[];
}

// combines layers from multiple history entries into the latest (<=targetIndex) representation
function composeLayer(
    layerEntries: (THistoryEntryLayer | undefined)[],
    targetIndex: number,
): THistoryEntryLayerComposed {
    return {
        name: getLatestDefinedForProp(layerEntries, 'name', targetIndex),
        opacity: getLatestDefinedForProp(layerEntries, 'opacity', targetIndex),
        isVisible: getLatestDefinedForProp(layerEntries, 'isVisible', targetIndex),
        mixModeStr: getLatestDefinedForProp(layerEntries, 'mixModeStr', targetIndex),
        index: getLatestDefinedForProp(layerEntries, 'index', targetIndex),
        tiles: composeLayerTiles(
            layerEntries.map((item) => (item ? item.tiles : undefined)),
            targetIndex,
        ),
    };
}

// combines layerMaps from multiple history entries into the latest (<=targetIndex) representation
function composeLayerMap(
    layerMaps: (Record<TLayerId, THistoryEntryLayer> | undefined)[],
    targetIndex: number,
) {
    const result = { ...getLatestDefined(layerMaps, targetIndex) };
    Object.entries(result).forEach(([id]) => {
        result[id] = composeLayer(
            layerMaps.map((item) => (item ? item[id] : undefined)),
            targetIndex,
        );
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
    return {
        size: getLatestDefinedForProp(entries, 'size', targetIndex),
        activeLayerId: getLatestDefinedForProp(entries, 'activeLayerId', targetIndex),
        selection: getLatestDefinedForProp(entries, 'selection', targetIndex),
        layerMap: composeLayerMap(
            entries.map((item) => item.layerMap),
            targetIndex,
        ),
    };
}
