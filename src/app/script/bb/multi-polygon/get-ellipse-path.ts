import { Polygon, Ring } from 'polygon-clipping';

export function getEllipsePath(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    steps: number,
): Polygon {
    const result: Ring = [];
    const d = (2 * Math.PI) / steps;

    for (let i = 0; i < 2 * Math.PI; i += d) {
        result.push([Math.cos(i) * rx + cx, Math.sin(i) * ry + cy]);
    }

    return [result];
}
