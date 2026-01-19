import { TBounds } from '../../bb/bb-types';

/**
 * Set values in data within rect to 254, unless they're 255
 *
 * @param data Uint8Array
 * @param width int
 * @param x0 int
 * @param y0 int
 * @param x1 int >x0
 * @param y1 int >y0
 */
function fillRect(
    data: Uint8Array,
    width: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): void {
    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            if (data[y * width + x] === 255) {
                continue;
            }
            data[y * width + x] = 254;
        }
    }
}

// test, should fill, if there is a tolerance < 255
function toleranceTest(
    srcArr: Uint8ClampedArray,
    initR: number,
    initG: number,
    initB: number,
    initA: number,
    toleranceSquared: number, // already squared for performance
    i: number,
): boolean {
    return (
        (srcArr[i * 4] - initR) ** 2 <= toleranceSquared &&
        (srcArr[i * 4 + 1] - initG) ** 2 <= toleranceSquared &&
        (srcArr[i * 4 + 2] - initB) ** 2 <= toleranceSquared &&
        (srcArr[i * 4 + 3] - initA) ** 2 <= toleranceSquared
    );
}

// check is within selection
function selectionMaskTest(selectionMaskArr: Uint8Array | undefined, i: number): boolean {
    return !selectionMaskArr || !!selectionMaskArr[i];
}

/**
 *
 * @param srcArr Uint8ClampedArray rgba
 * @param selectionMaskArr Uint8Array width x height, 0 or 1 values
 * @param targetArr Uint8Array
 * @param width int
 * @param height int
 * @param px int
 * @param py int
 * @param tolerance int 0 - 255
 * @param grow int >= 0
 * @param isContiguous boolean
 */
function floodFill(
    srcArr: Uint8ClampedArray,
    selectionMaskArr: Uint8Array | undefined,
    targetArr: Uint8Array,
    width: number,
    height: number,
    px: number,
    py: number,
    tolerance: number,
    grow: number,
    isContiguous: boolean,
): TBounds {
    const initR = srcArr[(py * width + px) * 4];
    const initG = srcArr[(py * width + px) * 4 + 1];
    const initB = srcArr[(py * width + px) * 4 + 2];
    const initA = srcArr[(py * width + px) * 4 + 3];
    const view = new DataView(srcArr.buffer);
    const init = view.getUint32((py * width + px) * 4, true);
    const toleranceSquared = tolerance ** 2;
    const bounds: TBounds = { x1: px, y1: py, x2: px, y2: py };

    if (isContiguous) {
        const q: number[] = []; // queue of pixel indices. they are already filled.
        q.push(py * width + px); // starting pixel, where the user clicked to fill
        targetArr[py * width + px] = 255;

        let i: number, e: number;
        let x: number, y: number;
        while (q.length) {
            // checks neighbors of queued pixels, fills, and queues them.
            // Adds to queue after filling it. Skip if was already filled.

            i = q.pop()!;

            y = Math.floor(i / width);
            x = i % width;

            if (x > 0) {
                // can go left
                e = i - 1;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.x1 = Math.min(bounds.x1, x - 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
            if (x < width - 1) {
                // can go right
                e = i + 1;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.x2 = Math.max(bounds.x2, x + 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
            if (y > 0) {
                // can go up
                e = i - width;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.y1 = Math.min(bounds.y1, y - 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
            if (y < height - 1) {
                // can go down
                e = i + width;
                if (
                    targetArr[e] !== 255 &&
                    selectionMaskTest(selectionMaskArr, e) &&
                    (view.getUint32(e * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, e)))
                ) {
                    bounds.y2 = Math.max(bounds.y2, y + 1);
                    targetArr[e] = 255;
                    q.push(e);
                }
            }
        }
    } else {
        // not contiguous
        for (let y = 0, i = 0; y < height; y++) {
            for (let x = 0; x < width; x++, i++) {
                if (
                    selectionMaskTest(selectionMaskArr, i) &&
                    (view.getUint32(i * 4, true) === init ||
                        (tolerance > 0 &&
                            toleranceTest(srcArr, initR, initG, initB, initA, toleranceSquared, i)))
                ) {
                    targetArr[i] = 255;
                    if (x < bounds.x1) {
                        bounds.x1 = x;
                    }
                    if (y < bounds.y1) {
                        bounds.y1 = y;
                    }
                    if (x > bounds.x2) {
                        bounds.x2 = x;
                    }
                    if (y > bounds.y2) {
                        bounds.y2 = y;
                    }
                }
            }
        }
    }

    if (grow === 0) {
        return bounds;
    }

    // --- grow ---

    // how does it grow? it finds all pixel at the edge.
    // then depending on what kind of edge it is, it draws a rectangle into target
    // In the rectangle each pixel has the value 254, or else it will mess it all up.
    // after it's all done, replaces it with 255
    let x0, x1, y0, y1;
    let l, tl, t, tr, r, br, b, bl; // left, top left, top, top right, etc.
    for (let x = bounds.x1; x <= bounds.x2; x++) {
        for (let y = bounds.y1; y <= bounds.y2; y++) {
            if (targetArr[y * width + x] !== 255) {
                continue;
            }

            // bounds of rectangle
            x0 = x;
            x1 = x;
            y0 = y;
            y1 = y;

            l = targetArr[y * width + x - 1] !== 255;
            tl = targetArr[(y - 1) * width + x - 1] !== 255;
            t = targetArr[(y - 1) * width + x] !== 255;
            tr = targetArr[(y - 1) * width + x + 1] !== 255;
            r = targetArr[y * width + x + 1] !== 255;
            br = targetArr[(y + 1) * width + x + 1] !== 255;
            b = targetArr[(y + 1) * width + x] !== 255;
            bl = targetArr[(y + 1) * width + x - 1] !== 255;

            if (l) {
                // left
                x0 = x - grow;
            }
            if (l && tl && t) {
                // top left
                x0 = x - grow;
                y0 = y - grow;
            }
            if (t) {
                // top
                y0 = Math.min(y0, y - grow);
            }
            if (t && tr && r) {
                // top right
                y0 = Math.min(y0, y - grow);
                x1 = x + grow;
            }
            if (r) {
                // right
                x1 = Math.max(x1, x + grow);
            }
            if (r && br && b) {
                // bottom right
                x1 = Math.max(x1, x + grow);
                y1 = Math.max(y1, y + grow);
            }
            if (b) {
                // bottom
                y1 = Math.max(y1, y + grow);
            }
            if (b && bl && l) {
                // bottom left
                x0 = Math.min(x0, x - grow);
                y1 = Math.max(y1, y + grow);
            }

            if (!l && !tl && !t && !tr && !r && !br && !b && !bl) {
                continue;
            }

            fillRect(
                targetArr,
                width,
                Math.max(0, x0),
                Math.max(0, y0),
                Math.min(width - 1, x1),
                Math.min(height - 1, y1),
            );
        }
    }
    for (let i = 0; i < width * height; i++) {
        if (targetArr[i] === 254) {
            targetArr[i] = 255;
        }
    }
    // expand bounds by grow
    bounds.x1 -= grow;
    bounds.y1 -= grow;
    bounds.x2 += grow;
    bounds.y2 += grow;

    return bounds;
}

/**
 * Does flood fill, and returns that. an array - 0 not filled, 255 filled.
 */
export function floodFillBits(
    rgbaArr: Uint8ClampedArray,
    // width x height, 0 or 1 values
    selectionMaskArr: Uint8Array | undefined,
    width: number, // int
    height: number, // int
    x: number, // int
    y: number, // int
    tolerance: number, // 0 - 255
    grow: number, // int >= 0
    isContiguous: boolean,
): {
    data: Uint8Array;
    bounds: TBounds; // what area changed
} {
    x = Math.round(x); // just in case
    y = Math.round(y);

    const resultArr = new Uint8Array(new ArrayBuffer(width * height));

    const bounds = floodFill(
        rgbaArr,
        selectionMaskArr,
        resultArr,
        width,
        height,
        x,
        y,
        tolerance,
        grow,
        isContiguous,
    );

    return {
        data: resultArr,
        bounds,
    };
}
