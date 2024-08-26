import * as polygonClipping from 'polygon-clipping';
import { Geom, MultiPolygon } from 'polygon-clipping';

// wrapper to catch errors, and offer fallback
export function applyPolygonClipping(
    operation: 'intersection' | 'xor' | 'union' | 'difference',
    geom: Geom,
    ...geoms: Geom[]
): MultiPolygon {
    let result: MultiPolygon = []; // initialized with fallback
    try {
        result = polygonClipping[operation](geom, ...geoms);
    } catch (e) {
        /* */
    }
    return result;
}
