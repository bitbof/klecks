import { TViewportTransform } from '../project-viewport';
import { TCoordinateBounds, TRect, TSize2D } from '../../../../bb/bb-types';
import { createTransform } from '../../../../bb/transform/create-transform';
import { fitInto } from '../../../../bb/base/base';
import { Matrix, TVec4 } from '../../../../bb/math/matrix';
import { snapAngleDeg } from '../../../../bb/math/math';
import { EASEL_MAX_SCALE } from '../../easel/easel.config';

/**
 * Returns a viewport transform that fits `rect` (in canvas space) into the viewport.
 * @param rect - rectangle in canvas space to fit
 * @param viewportTransform - current viewport transform
 * @param easelSize - size of the viewport DOM element
 * @param snapRotation - if true, snaps the current viewport angle to the nearest 90°
 * @param padding - viewport space padding per side (default 0)
 * @param maxScale - maximum scale of the returned transform (default EASEL_MAX_SCALE)
 */
export function getFitRectTransform(
    rect: TRect,
    viewportTransform: TViewportTransform,
    easelSize: TSize2D,
    snapRotation: boolean,
    padding: number = 0,
    maxScale: number = EASEL_MAX_SCALE,
): TViewportTransform {
    // rotate
    let newAngleDeg = viewportTransform.angleDeg;
    if (snapRotation) {
        if (newAngleDeg === 45) {
            // would otherwise get rounded to 90
            newAngleDeg = 0;
        }
        newAngleDeg = snapAngleDeg(newAngleDeg, 90, 90);
    }

    // calc width and height of bounds after rotation
    const rectCenterX = rect.x + rect.width / 2;
    const rectCenterY = rect.y + rect.height / 2;
    const canvasPointsArr = [
        [rect.x, rect.y], // top left
        [rect.x + rect.width, rect.y], // top right
        [rect.x + rect.width, rect.y + rect.height], // bottom right
        [rect.x, rect.y + rect.height], // bottom left
    ];

    // setup transformation matrix
    let matrix = Matrix.getIdentity();
    matrix = Matrix.multiplyMatrices(
        matrix,
        Matrix.createRotationMatrix((newAngleDeg / 180) * Math.PI),
    );

    // rotate points
    for (let i = 0; i < canvasPointsArr.length; i++) {
        let coords: TVec4 = [canvasPointsArr[i][0], canvasPointsArr[i][1], 0, 1];
        coords = Matrix.multiplyMatrixAndPoint(matrix, coords);
        canvasPointsArr[i][0] = coords[0];
        canvasPointsArr[i][1] = coords[1];
    }

    const boundsObj: Partial<TCoordinateBounds> = {};
    for (let i = 0; i < canvasPointsArr.length; i++) {
        if (boundsObj.x1 === undefined || canvasPointsArr[i][0] < boundsObj.x1) {
            boundsObj.x1 = canvasPointsArr[i][0];
        }
        if (boundsObj.y1 === undefined || canvasPointsArr[i][1] < boundsObj.y1) {
            boundsObj.y1 = canvasPointsArr[i][1];
        }
        if (boundsObj.x2 === undefined || canvasPointsArr[i][0] > boundsObj.x2) {
            boundsObj.x2 = canvasPointsArr[i][0];
        }
        if (boundsObj.y2 === undefined || canvasPointsArr[i][1] > boundsObj.y2) {
            boundsObj.y2 = canvasPointsArr[i][1];
        }
    }
    const boundsWidth = boundsObj.x2! - boundsObj.x1!;
    const boundsHeight = boundsObj.y2! - boundsObj.y1!;

    // fit bounds
    const { width: fitWidth } = fitInto(
        boundsWidth,
        boundsHeight,
        easelSize.width - padding * 2,
        easelSize.height - padding * 2,
        1,
    );

    // determine scale
    const factor = Math.min(maxScale, fitWidth / boundsWidth);

    return createTransform(
        { x: easelSize.width / 2, y: easelSize.height / 2 },
        { x: rectCenterX, y: rectCenterY },
        factor,
        newAngleDeg,
    );
}
