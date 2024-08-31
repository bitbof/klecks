import { MultiPolygon } from 'polygon-clipping';
import { IBounds } from '../bb-types';

export function getMultiPolyBounds(poly: MultiPolygon): IBounds {
    let x1: number | undefined = undefined;
    let y1: number | undefined = undefined;
    let x2: number | undefined = undefined;
    let y2: number | undefined = undefined;
    poly.forEach((poly) => {
        poly.forEach((ring) => {
            ring.forEach((p) => {
                x1 = x1 === undefined ? p[0] : Math.min(x1, p[0]);
                y1 = y1 === undefined ? p[1] : Math.min(y1, p[1]);

                x2 = x2 === undefined ? p[0] : Math.max(x2, p[0]);
                y2 = y2 === undefined ? p[1] : Math.max(y2, p[1]);
            });
        });
    });
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
        throw 'empty poly';
    }
    return {
        x1,
        y1,
        x2,
        y2,
    };
}
