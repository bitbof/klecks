import polygonClipping from 'polygon-clipping';
import { Geom, MultiPolygon, Ring } from 'polygon-clipping';

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

// intersects each ring individually to avoid failing edge cases from clipping the whole multipolygon at once
export function clipMultiPolygon(multiPolygon: MultiPolygon, clip: Ring): MultiPolygon {
    const result: MultiPolygon = [];
    for (const polygon of multiPolygon) {
        for (const ring of polygon) {
            const clipped = applyPolygonClipping('intersection', [[ring]], [[clip]]);
            for (const poly of clipped) {
                result.push(poly);
            }
        }
    }
    return result;
}
