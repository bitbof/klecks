import { IVector2D } from '../../../bb/bb-types';
import { BB } from '../../../bb/bb';
import { PointerListener } from '../../../bb/input/pointer-listener';

export interface IFreeTransform {
    x: number; // center of transform region. image space
    y: number;
    width: number; // size of transform region. image space
    height: number;
    angleDeg: number; // angle of transform region. degrees
}

export type TFreeTransformCorner = {
    i: number; // index in corners array
    el: HTMLElement; // draggable corner circle in DOM
    x: number; // unscaled position (transform space)
    y: number;
    virtualPos: IVector2D; // unscaled temporary position (image space)
    updateDOM: () => void; // update styling in DOM
    pointerListener: PointerListener;
};

export type TFreeTransformEdge = {
    // derive position from corners
    el: HTMLElement;
    updateDOM: () => void;
    pointerListener: PointerListener;
};

/**
 * snap entire transform to pixel grid. changes transform
 *
 * for x y:
 * If a dimension has an even size, it will be an integer.
 * If it's uneven, it sits exactly half-way between two pixels.
 *
 * @param transform
 */
export function snapToPixel(transform: IFreeTransform): void {
    if (Math.abs(transform.angleDeg) % 90 !== 0) {
        return;
    }

    transform.width = Math.round(transform.width);
    transform.height = Math.round(transform.height);
    // 0° is original orientation.
    // At 90° and 270° width and height become swapped due to different orientation.
    const whSwapped = Math.abs(transform.angleDeg - 90) % 180 === 0;
    transform.x =
        (whSwapped ? transform.height : transform.width) % 2 === 0
            ? Math.round(transform.x)
            : Math.round(transform.x - 0.5) + 0.5;
    transform.y =
        (whSwapped ? transform.width : transform.height) % 2 === 0
            ? Math.round(transform.y)
            : Math.round(transform.y - 0.5) + 0.5;
}

export function copyTransform(transform: IFreeTransform): IFreeTransform {
    return {
        x: transform.x,
        y: transform.y,
        width: transform.width,
        height: transform.height,
        angleDeg: transform.angleDeg,
    };
}

/**
 * image space to transform space
 * - origin of transform space is at center of transform bounds.
 * - same scale as image space. -> one unit is x: 1/width, y: 1/height
 * - up is where transform points up
 * - x goes right
 * - y goes down
 * @param x
 * @param y
 * @param transform
 */
export function toTransformSpace(x: number, y: number, transform: IFreeTransform): IVector2D {
    let px, py;
    px = x - transform.x;
    py = y - transform.y;

    const rot = BB.rotateAround({ x: 0, y: 0 }, { x: px, y: py }, -transform.angleDeg);
    px = rot.x;
    py = rot.y;

    return {
        x: px,
        y: py,
    };
}

/**
 * transform space to image space
 * @param x
 * @param y
 * @param transform
 */
export function toImageSpace(x: number, y: number, transform: IFreeTransform): IVector2D {
    const rot = BB.rotateAround({ x: 0, y: 0 }, { x: x, y: y }, transform.angleDeg);
    return {
        x: rot.x + transform.x,
        y: rot.y + transform.y,
    };
}
