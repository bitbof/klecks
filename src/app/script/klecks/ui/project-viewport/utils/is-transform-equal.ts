import { TViewportTransform } from '../project-viewport';

export function isTransformEqual(a: TViewportTransform, b: TViewportTransform): boolean {
    const isPositionChanged = a.x !== b.x || a.y !== b.y;
    const isScaleOrAngleChanged = a.scale !== b.scale || a.angleDeg !== b.angleDeg;
    return !isPositionChanged && !isScaleOrAngleChanged;
}
