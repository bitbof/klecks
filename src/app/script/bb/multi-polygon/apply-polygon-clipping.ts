import polygonClipping, { Geom, MultiPolygon, Ring } from 'polygon-clipping';
import { attempt, AttemptError } from '../base/base';

// wrapper to catch errors, and offer fallback
export function applyPolygonClipping(
    operation: 'intersection' | 'xor' | 'union' | 'difference',
    geom: Geom,
    ...geoms: Geom[]
): MultiPolygon {
    const result = attempt(() => polygonClipping[operation](geom, ...geoms));
    return result instanceof AttemptError ? [] : result;
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
