import {
    TViewportTransform,
    TViewportTransformXY,
} from '../../klecks/ui/project-viewport/project-viewport';
import { compose, Matrix, rotate, scale, translate } from 'transformation-matrix';

export function createMatrixFromTransform(
    transform: TViewportTransform | TViewportTransformXY,
): Matrix {
    const scaleX = 'scale' in transform ? transform.scale : transform.scaleX;
    const scaleY = 'scale' in transform ? transform.scale : transform.scaleY;
    return compose(
        translate(transform.x, transform.y),
        rotate((transform.angleDeg / 180) * Math.PI),
        scale(scaleX, scaleY),
    );
}
