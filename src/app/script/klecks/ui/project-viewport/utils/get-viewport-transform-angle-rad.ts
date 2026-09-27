import { TViewportTransform } from '../project-viewport';

// accounts for mirroring
export function getViewportTransformAngleRad(transform: TViewportTransform): number {
    const angleDeg = transform.isMirrored ? -transform.angleDeg : transform.angleDeg;
    return (angleDeg / 180) * Math.PI;
}
