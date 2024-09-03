import { TViewportTransform } from '../project-viewport';
import { ISize2D, IVector2D } from '../../../../bb/bb-types';
import { isTransformEqual } from './is-transform-equal';
import { BB } from '../../../../bb/bb';
import { TMetaTransform, toMetaTransform } from '../../../../bb/transform/to-meta-transform';
import { createTransform } from '../../../../bb/transform/create-transform';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint } from 'transformation-matrix';

export function blendTransform(
    currentTransform: TViewportTransform,
    targetTransform: TViewportTransform,
    projectSize: ISize2D,
    viewportCenter: IVector2D,
    easeFactor: number,
): TViewportTransform {
    // equal
    if (isTransformEqual(currentTransform, targetTransform)) {
        return { ...targetTransform };
    }

    // approximately equal
    if (
        (currentTransform.x === targetTransform.x ||
            Math.abs(currentTransform.x - targetTransform.x) < 2) &&
        (currentTransform.y === targetTransform.y ||
            Math.abs(currentTransform.y - targetTransform.y) < 2) &&
        (currentTransform.scale === targetTransform.scale ||
            Math.abs(currentTransform.scale - targetTransform.scale) < 0.08 * targetTransform.scale)
    ) {
        return {
            ...targetTransform,
        };
    }

    // same angle, just translate and scale
    if (currentTransform.angleDeg === targetTransform.angleDeg) {
        return {
            x: BB.mix(currentTransform.x, targetTransform.x, easeFactor),
            y: BB.mix(currentTransform.y, targetTransform.y, easeFactor),
            angleDeg: targetTransform.angleDeg,
            scale: BB.mix(currentTransform.scale, targetTransform.scale, easeFactor),
        };
    }

    // rotating around a point
    const currentMeta = toMetaTransform(currentTransform, viewportCenter);
    const targetMeta = toMetaTransform(targetTransform, viewportCenter);
    if (BB.Vec2.dist(currentMeta.canvasP, targetMeta.canvasP) < 1) {
        // move angles closer to each other. assumes [-180, 180] angle range.
        let closerCurrentAngleDeg = currentMeta.angleDeg;
        // -180 180 -> 180 + 180 = 360
        // 180 -180 -> -180 - 180 = -360
        const angleDelta = targetMeta.angleDeg - currentMeta.angleDeg;
        if (angleDelta > 180) {
            closerCurrentAngleDeg += 360;
        }
        if (angleDelta < -180) {
            closerCurrentAngleDeg -= 360;
        }

        const mixedMeta: TMetaTransform = {
            viewportP: viewportCenter,
            canvasP: targetMeta.canvasP,
            scale: BB.mix(currentTransform.scale, targetTransform.scale, easeFactor),
            angleDeg: BB.mix(closerCurrentAngleDeg, targetTransform.angleDeg, easeFactor),
        };

        return createTransform(
            mixedMeta.viewportP,
            mixedMeta.canvasP,
            mixedMeta.scale,
            mixedMeta.angleDeg,
        );
    }

    // rotate around center of canvas
    const canvasCenter = {
        x: projectSize.width / 2,
        y: projectSize.height / 2,
    };
    const currentMatrix = createMatrixFromTransform(currentTransform);
    const targetMatrix = createMatrixFromTransform(targetTransform);
    const currentCenter = applyToPoint(currentMatrix, canvasCenter);
    const targetCenter = applyToPoint(targetMatrix, canvasCenter);

    const mixedCenter = {
        x: BB.mix(currentCenter.x, targetCenter.x, easeFactor),
        y: BB.mix(currentCenter.y, targetCenter.y, easeFactor),
    };
    const mixedScale = BB.mix(currentTransform.scale, targetTransform.scale, easeFactor);
    const mixedAngleDeg = BB.mix(currentTransform.angleDeg, targetTransform.angleDeg, easeFactor);

    const mixedAngleRad = mixedAngleDeg * (Math.PI / 180);

    // calculate the offset from the center to the top-left corner (origin)
    const offsetX = -canvasCenter.x * mixedScale;
    const offsetY = -canvasCenter.y * mixedScale;

    const rotatedOffsetX = offsetX * Math.cos(mixedAngleRad) - offsetY * Math.sin(mixedAngleRad);
    const rotatedOffsetY = offsetX * Math.sin(mixedAngleRad) + offsetY * Math.cos(mixedAngleRad);

    const origin = {
        x: mixedCenter.x + rotatedOffsetX,
        y: mixedCenter.y + rotatedOffsetY,
    };

    return {
        x: origin.x,
        y: origin.y,
        scale: mixedScale,
        angleDeg: mixedAngleDeg,
    };
}
