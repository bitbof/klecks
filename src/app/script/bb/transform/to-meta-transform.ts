import { createMatrixFromTransform } from './create-matrix-from-transform';
import { TViewportTransform } from '../../klecks/ui/project-viewport/project-viewport';
import { IVector2D } from '../bb-types';
import { inverse, applyToPoint } from 'transformation-matrix';

export type TMetaTransform = {
    viewportP: IVector2D;
    canvasP: IVector2D;
    scale: number;
    angleDeg: number;
};

export function toMetaTransform(
    transform: TViewportTransform,
    viewportP: IVector2D,
): TMetaTransform {
    const m = createMatrixFromTransform(transform);
    const canvasP = applyToPoint(inverse(m), viewportP);
    return {
        viewportP,
        canvasP,
        scale: transform.scale,
        angleDeg: transform.angleDeg,
    };
}
