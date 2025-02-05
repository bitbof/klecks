import {
    THistoryEntryData,
    THistoryEntryDataComposed,
    THistoryEntryLayerTile,
} from '../history.types';
import { canvasToLayerTiles } from './canvas-to-layer-tiles';

// create a history entry where the currently active layer changes its tiles
export function getPushableLayerChange(
    composed: THistoryEntryDataComposed,
    imageOrTiles: HTMLCanvasElement | (THistoryEntryLayerTile | undefined)[],
): THistoryEntryData {
    const activeLayerId = composed.activeLayerId;
    const layerMap = Object.fromEntries(
        Object.entries(composed.layerMap).map(([layerId, layerItem]) => {
            if (layerId === activeLayerId) {
                return [
                    layerId,
                    {
                        tiles:
                            imageOrTiles instanceof HTMLCanvasElement
                                ? canvasToLayerTiles(imageOrTiles)
                                : [...imageOrTiles],
                    },
                ];
            }

            return [layerId, {}];
        }),
    );
    return {
        layerMap,
    };
}
