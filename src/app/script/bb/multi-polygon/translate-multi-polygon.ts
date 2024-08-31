import { MultiPolygon } from 'polygon-clipping';

export function translateMultiPolygon(poly: MultiPolygon, x: number, y: number): MultiPolygon {
    return poly.map((poly) => {
        return poly.map((ring) => {
            return ring.map((p) => {
                return [p[0] + x, p[1] + y];
            });
        });
    });
}
