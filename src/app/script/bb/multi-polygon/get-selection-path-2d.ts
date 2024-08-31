import { MultiPolygon } from 'polygon-clipping';

export function getSelectionPath2d(selection: MultiPolygon): Path2D {
    const path = new Path2D();
    selection.forEach((poly) => {
        poly.forEach((ring) => {
            ring.forEach((point, index) => {
                if (index === 0) {
                    path.moveTo(...point);
                } else {
                    path.lineTo(...point);
                }
            });
        });
        path.closePath();
    });
    return path;
}

export function getSvgPathD(poly: MultiPolygon): string {
    let result = '';
    poly.forEach((poly) => {
        poly.forEach((ring) => {
            result += 'M';
            ring.forEach((point) => {
                result += point.join(',') + ' ';
            });
        });
    });
    return result.trim();
}
