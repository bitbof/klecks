import { MultiPolygon, Pair } from 'polygon-clipping';
import { applyToPoint, Matrix } from 'transformation-matrix';

export function transformMultiPolygon(multiPolygon: MultiPolygon, transform: Matrix): MultiPolygon {
    return multiPolygon.map((poly) => {
        return poly.map((ring) => {
            return ring.map((point) => {
                return Object.values(applyToPoint(transform, { x: point[0], y: point[1] })) as Pair;
            });
        });
    });
}
