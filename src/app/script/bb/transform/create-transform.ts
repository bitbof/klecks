import { TViewportTransform } from '../../klecks/ui/project-viewport/project-viewport';
import { IVector2D } from '../bb-types';
import { compose, rotate, scale as scaleFunc, applyToPoint } from 'transformation-matrix';

export function createTransform(
    viewportPoint: IVector2D,
    canvasPoint: IVector2D,
    scale: number,
    angleDeg: number,
): TViewportTransform {
    const mat = compose(scaleFunc(-scale, -scale), rotate((angleDeg / 180) * Math.PI));
    const topLeftP = applyToPoint(mat, canvasPoint);
    topLeftP.x += viewportPoint.x;
    topLeftP.y += viewportPoint.y;
    return {
        x: topLeftP.x,
        y: topLeftP.y,
        scale,
        angleDeg,
    };
}
