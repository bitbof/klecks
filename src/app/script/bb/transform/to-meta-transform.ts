import { createMatrixFromTransform } from './create-matrix-from-transform';
import { TViewportTransform } from '../../klecks/ui/project-viewport/project-viewport';
import { TVector2D } from '../bb-types';
import { applyToPoint, inverse } from 'transformation-matrix';

export type TMetaTransform = {
    viewportP: TVector2D;
    canvasP: TVector2D;
    scale: number;
    angleDeg: number;
};

export function toMetaTransform(
    transform: TViewportTransform,
    viewportP: TVector2D,
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
