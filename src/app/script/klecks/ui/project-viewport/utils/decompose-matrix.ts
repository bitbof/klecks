import {IVector2D} from '../../../../bb/bb-types';
import {Matrix} from 'transformation-matrix';

// https://stackoverflow.com/questions/16359246/how-to-extract-position-rotation-and-scale-from-matrix-svg
function deltaTransformPoint (matrix: Matrix, point: IVector2D)  {
    const dx = point.x * matrix.a + point.y * matrix.c;
    const dy = point.x * matrix.b + point.y * matrix.d;
    return { x: dx, y: dy };
}

export function decomposeMatrix (matrix: Matrix) {
    // @see https://gist.github.com/2052247
    // calculate delta transform point
    const px = deltaTransformPoint(matrix, { x: 0, y: 1 });
    const py = deltaTransformPoint(matrix, { x: 1, y: 0 });

    // calculate skew
    const skewX = ((180 / Math.PI) * Math.atan2(px.y, px.x) - 90);
    const skewY = ((180 / Math.PI) * Math.atan2(py.y, py.x));
    return {
        translateX: matrix.e,
        translateY: matrix.f,
        scaleX: Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b),
        scaleY: Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d),
        skewX: skewX,
        skewY: skewY,
        rotation: skewX, // rotation is the same as skew x
    };
}