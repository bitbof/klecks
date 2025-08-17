import { TKlCanvasLayer } from '../../canvas/kl-canvas';
import { TBounds } from '../../../bb/bb-types';
import { THistoryEntryLayer, THistoryEntryLayerTile, TLayerId } from '../history.types';
import { canvasToLayerTiles } from './canvas-to-layer-tiles';

type TLayerKey = keyof THistoryEntryLayer;
type TLayerMapGeneric = {
    attributes: 'all' | TLayerKey[];
};
type TLayerMapLayer = {
    layerId: string;
    attributes: 'all' | TLayerKey[];
    bounds?: TBounds; // changed bounds
    tiles?: (THistoryEntryLayerTile | undefined)[]; // custom tiles. bounds ignored if tiles set.
};
export type TLayerMapConfigItem = TLayerMapGeneric | TLayerMapLayer;

// create individual THistoryEntryLayer
function createEntryLayer(
    layer: TKlCanvasLayer,
    attributes: 'all' | TLayerKey[],
    bounds?: TBounds,
    tiles?: (THistoryEntryLayerTile | undefined)[],
): THistoryEntryLayer {
    const useAll = attributes === 'all';
    const result: THistoryEntryLayer = {};

    if (useAll || attributes.includes('name')) {
        result.name = layer.name;
    }
    if (useAll || attributes.includes('opacity')) {
        result.opacity = layer.opacity;
    }
    if (useAll || attributes.includes('isVisible')) {
        result.isVisible = layer.isVisible;
    }
    if (useAll || attributes.includes('mixModeStr')) {
        result.mixModeStr = layer.mixModeStr;
    }
    if (useAll || attributes.includes('index')) {
        result.index = layer.index;
    }
    if (useAll || attributes.includes('tiles')) {
        result.tiles = tiles ?? canvasToLayerTiles(layer.context.canvas, bounds);
    }
    return result;
}

/**
 * Creates THistoryEntryData.layerMap from KlCanvas layers that can be pushed into history.
 *
 * items control what attributes will be set for each layer. Examples:
 * { attributes: ['index'] } - each layer only has index attribute. all layers will be in the map.
 * { layerId: '0', attributes: ['name']} - map only contains layer '0'. it only has 'name' attribute.
 * { layerId: '0', attributes: 'all'} - map only contains layer '0', with all attributes.
 * { layerId: '0', attributes: 'all'}, { attributes: ['index'] }
 *      - layer '0' has all attributes.
 *      - all other layers will be in the map, but only contain attribute 'index'.
 *
 *  Can further customize by setting what bounds changed, or provide custom tiles.
 */
export function createLayerMap(
    layers: TKlCanvasLayer[],
    ...items: (TLayerMapConfigItem | undefined)[]
): Record<TLayerId, THistoryEntryLayer> {
    const generic: TLayerMapGeneric = items.find((item) => item && !('layerId' in item)) ?? {
        attributes: [],
    };
    const targets: TLayerMapLayer[] = items
        .filter((item) => !!item)
        .filter((item) => 'layerId' in item);

    return Object.fromEntries(
        layers.map((layer, index) => {
            for (const target of targets) {
                if (target.layerId === layer.id) {
                    return [
                        layer.id,
                        createEntryLayer(layer, target.attributes, target.bounds, target.tiles),
                    ];
                }
            }
            return [layer.id, createEntryLayer(layer, generic.attributes)];
        }),
    );
}
