import { getInverse, getSquareToQuad, multiply } from '../math/matrix';
import { TFxCanvas } from '../fx-canvas-types';

export type TRectanglePoints = [
    number,
    number, // point a
    number,
    number, // point b
    number,
    number, // point c
    number,
    number, // point d
];

/**
 * Perspective
 * @description  Warps one quadrangle to another with a perspective transform. This can be used to
 *               make a 2D image look 3D or to recover a 2D image captured in a 3D environment.
 *               Note: Requires alpha to be premultiplied.
 * @param before The x and y coordinates of four points before the transform in a flat list. This
 *               would look like [ax, ay, bx, by, cx, cy, dx, dy] for four points (ax, ay), (bx, by),
 *               (cx, cy), and (dx, dy).
 * @param after  The x and y coordinates of four points after the transform in a flat list, just
 *               like the other argument.
 */
export type TFilterPerspective = (
    this: TFxCanvas,
    before: TRectanglePoints,
    after: TRectanglePoints,
) => TFxCanvas;

export const perspective: TFilterPerspective = function (before, after) {
    const a = getSquareToQuad(...after);
    const b = getSquareToQuad(...before);
    const c = multiply(getInverse(a), b);
    return this.matrixWarp(c);
};
