import { TViewportTransform } from '../../klecks/ui/project-viewport/project-viewport';
import { TVector2D } from '../bb-types';
import { applyToPoint, compose, rotate, scale as scaleMatrix } from 'transformation-matrix';

export function createTransform(
    viewportPoint: TVector2D,
    canvasPoint: TVector2D,
    scale: number,
    angleDeg: number,
    isMirrored: boolean,
): TViewportTransform {
    const mat = compose(
        scaleMatrix(-scale, -scale),
        rotate((angleDeg / 180) * Math.PI),
        scaleMatrix(isMirrored ? -1 : 1, 1),
    );
    const topLeftP = applyToPoint(mat, canvasPoint);
    topLeftP.x += viewportPoint.x;
    topLeftP.y += viewportPoint.y;
    return {
        x: topLeftP.x,
        y: topLeftP.y,
        scale,
        angleDeg,
        isMirrored,
    };
}
