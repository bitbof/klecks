import { IBounds, IKeyString, IRect } from '../bb-types';
import { createCanvas } from './create-canvas';
import { copyObj } from './base';

export function copyCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const resultCanvas = createCanvas(canvas.width, canvas.height);
    const ctx = resultCanvas.getContext('2d');
    if (!ctx) {
        throw new Error('2d context not supported or canvas already initialized');
    }
    ctx.drawImage(canvas, 0, 0);
    return resultCanvas;
}

export function ctx(
    canvas: HTMLCanvasElement,
    options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d', options);
    if (!ctx) {
        throw new Error("couldn't get 2d context");
    }
    return ctx;
}

/**
 * Determine if we should disable imageSmoothing for transformation.
 * ImageSmoothing can make images blurry even when they're in the original scale and aligned with the pixelgrid.
 */
export function testShouldPixelate(
    transform: {
        x: number;
        y: number;
        width: number;
        height: number;
        angleDeg: number;
    },
    scaleX: number,
    scaleY: number,
): boolean {
    if (
        ![1, -1].includes(scaleX) ||
        ![1, -1].includes(scaleY) ||
        transform.width % 1 !== 0 ||
        transform.height % 1 !== 0 ||
        Math.abs(transform.angleDeg) % 90 !== 0
    ) {
        return false;
    }
    const whSwapped = Math.abs(transform.angleDeg - 90) % 180 === 0;
    const width = whSwapped ? transform.height : transform.width;
    const height = whSwapped ? transform.width : transform.height;
    return (
        ((Math.abs(width) % 2 === 0 && transform.x % 1 === 0) ||
            (Math.abs(width) % 2 === 1 && transform.x % 1 === 0.5)) &&
        ((Math.abs(height) % 2 === 0 && transform.y % 1 === 0) ||
            (Math.abs(height) % 2 === 1 && transform.y % 1 === 0.5))
    );
}

/**
 * @param destCtx - the canvas that will be drawn on
 * @param transformImage - image that will be drawn on canvas
 * @param transform - {x, y, width, height, angle} - x and y are center of transformImage
 * @param bounds object - optional {x, y, width, height} - crop of transformImage in transformImage image space
 * @param pixelated
 */
export function drawTransformedImageWithBounds(
    destCtx: CanvasRenderingContext2D,
    transformImage: HTMLImageElement | HTMLCanvasElement,
    transform: {
        x: number;
        y: number;
        width: number;
        height: number;
        angleDeg: number;
    },
    bounds?: { x: number; y: number; width: number; height: number },
    pixelated?: boolean,
): void {
    if (!bounds) {
        bounds = {
            x: 0,
            y: 0,
            width: transformImage.width,
            height: transformImage.height,
        };
    }

    destCtx.save();
    if (pixelated) {
        destCtx.imageSmoothingEnabled = false;
    } else {
        destCtx.imageSmoothingEnabled = true;
        destCtx.imageSmoothingQuality = 'high';
    }

    destCtx.translate(transform.x, transform.y);
    destCtx.rotate((transform.angleDeg / 180) * Math.PI);
    destCtx.scale(transform.width > 0 ? 1 : -1, transform.height > 0 ? 1 : -1);
    destCtx.drawImage(
        transformImage,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        -Math.abs(transform.width) / 2,
        -Math.abs(transform.height) / 2,
        Math.abs(transform.width),
        Math.abs(transform.height),
    );

    destCtx.restore();
}

/**
 * all transformations are optional
 * center is the point around which will be scaled and rotated
 *
 * @param baseCanvas canvas - the canvas that will be drawn on
 * @param transformImage image|canvas - image that will be drawn on canvas
 * @param transformObj {center: {x, y}, scale: {x, y}, translate: {x, y}, angleDegree}
 */
export function drawTransformedImageOnCanvas(
    baseCanvas: HTMLCanvasElement,
    transformImage: HTMLImageElement | HTMLCanvasElement,
    transformObj: {
        center: { x: number; y: number };
        scale: { x: number; y: number };
        translate: { x: number; y: number };
        angleDegree: number;
    },
): void {
    transformObj = copyObj(transformObj);
    if (!transformObj.center) {
        transformObj.center = {
            x: transformImage.width / 2,
            y: transformImage.height / 2,
        };
    }
    if (!transformObj.scale) {
        transformObj.scale = {
            x: 1,
            y: 1,
        };
    }
    if (!transformObj.angleDegree) {
        transformObj.angleDegree = 0;
    }
    if (!transformObj.translate) {
        transformObj.translate = {
            x: 0,
            y: 0,
        };
    }

    const ctx = baseCanvas.getContext('2d');
    if (!ctx) {
        throw new Error('2d context not supported or canvas already initialized');
    }
    ctx.save();
    if (
        Math.abs(transformObj.scale.x - 1) > 0.000001 ||
        Math.abs(transformObj.scale.y - 1) > 0.000001 ||
        Math.abs(transformObj.angleDegree % 90) > 0.000001
    ) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    } else {
        ctx.imageSmoothingEnabled = false;
    }

    ctx.translate(transformObj.translate.x, transformObj.translate.y);
    ctx.translate(transformObj.center.x, transformObj.center.y);
    ctx.rotate((transformObj.angleDegree / 180) * Math.PI);
    ctx.scale(transformObj.scale.x, transformObj.scale.y);
    ctx.translate(-transformObj.center.x, -transformObj.center.y);
    ctx.drawImage(transformImage, 0, 0, transformImage.width, transformImage.height);

    ctx.restore();
}

export const createCheckerCanvas = function (size: number, isDark?: boolean): HTMLCanvasElement {
    const canvas = createCanvas();
    let ctx;
    if (size < 1) {
        canvas.width = 1;
        canvas.height = 1;
        ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('2d context not supported or canvas already initialized');
        }
        ctx.fillStyle = 'rgb(128, 128, 128)';
        ctx.fillRect(0, 0, 1, 1);
    } else if (size > 200) {
        canvas.width = 401;
        canvas.height = 401;
    } else {
        canvas.width = size * 2;
        canvas.height = size * 2;
        ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('2d context not supported or canvas already initialized');
        }
        ctx.fillStyle = isDark ? 'rgb(90, 90, 90)' : 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, size * 2, size * 2);
        ctx.fillStyle = isDark ? 'rgb(63, 63, 63)' : 'rgb(200, 200, 200)';
        ctx.fillRect(0, 0, size, size);
        ctx.fillRect(size, size, size * 2, size * 2);
    }
    return canvas;
};

export const createCheckerDataUrl = (function () {
    const cache: IKeyString = {
        // previously created dataUrls
        '8l': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4T2M8ceLEfwY8wNzcHJ80A+OoAcMiDP7//483HZw8eRJ/Ohg1gIFx6IcBAIhJUqnarXQ1AAAAAElFTkSuQmCC',
        '4l': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVQoU2M8ceLEfwYkYG5ujsxlYKSDgv///6O44eTJk6huoL0CAGsOKVVu8UYvAAAAAElFTkSuQmCC',
    };

    return function (
        size: number,
        callback?: (s: string) => void,
        isDark?: boolean,
    ): string | void {
        const modeStr = isDark ? 'd' : 'l';

        function create(size: number): string {
            size = parseInt('' + size);
            if (cache['' + size + modeStr]) {
                return cache['' + size + modeStr];
            }
            const canvas = createCheckerCanvas(size, isDark);
            const result = canvas.toDataURL('image/png');
            cache['' + size + modeStr] = result;
            return result;
        }

        if (callback) {
            //async
            setTimeout(function () {
                callback(create(size));
            }, 1);
        } else {
            //sync
            return create(size);
        }
    };
})();

/**
 * smooth resize image
 * @param canvas canvas - will be resized (modified)
 * @param w
 * @param h
 * @param tmp1 canvas - optional, provide to save resources
 * @param tmp2 canvas - optional, provide to save resources
 */
export function resizeCanvas(
    canvas: HTMLCanvasElement,
    w: number,
    h: number,
    tmp1?: HTMLCanvasElement,
    tmp2?: HTMLCanvasElement,
): void {
    //determine base 2 exponents of old and new size
    function getBase2Obj(oldW: number, oldH: number, newW: number, newH: number) {
        const result = {
            oldWidthEx: Math.round(Math.log2(oldW)),
            oldHeightEx: Math.round(Math.log2(oldH)),
            newWidthEx: Math.ceil(Math.log2(newW)),
            newHeightEx: Math.ceil(Math.log2(newH)),
        };
        result.oldWidthEx = Math.max(result.oldWidthEx, result.newWidthEx);
        result.oldHeightEx = Math.max(result.oldHeightEx, result.newHeightEx);
        return result;
    }

    if (!w || !h || (w === canvas.width && h === canvas.height)) {
        return;
    }
    w = Math.max(w, 1);
    h = Math.max(h, 1);
    if (w <= canvas.width && h <= canvas.height) {
        tmp1 = !tmp1 ? createCanvas() : tmp1;
        tmp2 = !tmp2 ? createCanvas() : tmp2;

        const base2 = getBase2Obj(canvas.width, canvas.height, w, h);

        //initially scale to a base of 2. unless new size is too close to old. e.g. sizing from 900 to 600
        tmp2.width = base2.oldWidthEx > base2.newWidthEx ? Math.pow(2, base2.oldWidthEx) : w;
        tmp2.height = base2.oldHeightEx > base2.newHeightEx ? Math.pow(2, base2.oldHeightEx) : h;
        tmp1.getContext('2d')!.save();
        tmp2.getContext('2d')!.save();

        let ew, eh;
        let buffer1 = tmp1,
            buffer2 = tmp2;

        ew = base2.oldWidthEx;
        eh = base2.oldHeightEx;

        let bufferCtx = buffer2.getContext('2d')!;
        bufferCtx.imageSmoothingEnabled = true;
        bufferCtx.imageSmoothingQuality = 'high';
        bufferCtx.globalCompositeOperation = 'copy';
        bufferCtx.drawImage(canvas, 0, 0, buffer2.width, buffer2.height);

        let currentWidth = buffer2.width;
        let currentHeight = buffer2.height;

        //stepwise half the size
        for (; ew > base2.newWidthEx || eh > base2.newHeightEx; ew--, eh--) {
            bufferCtx = buffer1.getContext('2d')!;
            bufferCtx.imageSmoothingEnabled = true;
            bufferCtx.imageSmoothingQuality = 'high';
            bufferCtx.globalCompositeOperation = 'copy';

            const newWidth = ew > base2.newWidthEx ? currentWidth / 2 : currentWidth;
            const newHeight = eh > base2.newHeightEx ? currentHeight / 2 : currentHeight;

            //buffer also needs to be properly sized, unfortunately
            buffer1.width = newWidth;
            buffer1.height = newHeight;

            bufferCtx.drawImage(
                buffer2,
                0,
                0,
                currentWidth,
                currentHeight,
                0,
                0,
                newWidth,
                newHeight,
            );
            currentWidth = newWidth;
            currentHeight = newHeight;

            //swap
            const tmp = buffer1;
            buffer1 = buffer2;
            buffer2 = tmp;
        }

        //when no longer can be halved, bring to target size
        canvas.width = w;
        canvas.height = h;
        const canvasCtx = canvas.getContext('2d')!;
        canvasCtx.save();
        canvasCtx.imageSmoothingEnabled = true;
        canvasCtx.imageSmoothingQuality = 'high';
        canvasCtx.drawImage(buffer2, 0, 0, currentWidth, currentHeight, 0, 0, w, h);
        canvasCtx.restore();
        tmp1.getContext('2d')!.restore();
        tmp2.getContext('2d')!.restore();
    } else if (w >= canvas.width && h >= canvas.height) {
        tmp1 = !tmp1 ? createCanvas() : tmp1;
        tmp1.width = w;
        tmp1.height = h;
        const tmp1Ctx = tmp1.getContext('2d')!;
        tmp1Ctx.save();
        tmp1Ctx.imageSmoothingEnabled = true;
        tmp1Ctx.imageSmoothingQuality = 'high';
        tmp1Ctx.drawImage(canvas, 0, 0, w, h);
        tmp1Ctx.restore();

        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(tmp1, 0, 0);
    } else {
        resizeCanvas(canvas, w, canvas.height, tmp1, tmp2);
        resizeCanvas(canvas, w, h, tmp1, tmp2);
    }
}

/**
 * puts naive greyscale version of image into alpha channel.
 * only writes a, doesn't write rgb
 * @param canvas
 */
export function convertToAlphaChannelCanvas(canvas: HTMLCanvasElement): void {
    const imdat = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imdat.data.length; i += 4) {
        if (imdat.data[i + 3] === 0) {
            continue;
        }
        imdat.data[i + 3] =
            ((imdat.data[i] + imdat.data[i + 1] + imdat.data[i + 2]) / 3) *
            (imdat.data[i + 3] / 255);
    }
    canvas.getContext('2d')!.putImageData(imdat, 0, 0);
}

/**
 * Sometimes garbage collection is too slow, and canvases use up too much memory,
 * or in the worst case there is a hard to fix memory leak.
 * This function manually makes the canvas use as little memory as possible.
 */
export function freeCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = 1;
    canvas.height = 1;
    canvas.remove();
}

/**
 * Determine bounding box that describes all pixels which are not fully transparent.
 * Returns undefined if empty.
 *
 * @param context
 * @param integerBounds optional - restricts the search to this area. bounds have to be integers
 */
export function canvasBounds(
    context: CanvasRenderingContext2D,
    integerBounds?: IBounds,
): IRect | undefined {
    const searchBounds = integerBounds ?? {
        x1: 0,
        y1: 0,
        x2: context.canvas.width - 1,
        y2: context.canvas.height - 1,
    };
    const searchWidth = searchBounds.x2 - searchBounds.x1 + 1;
    const searchHeight = searchBounds.y2 - searchBounds.y1 + 1;

    const imdat = context.getImageData(searchBounds.x1, searchBounds.y1, searchWidth, searchHeight);

    if (imdat.data[3] > 0 && imdat.data[imdat.data.length - 1] > 0) {
        return {
            x: searchBounds.x1,
            y: searchBounds.y1,
            width: searchBounds.x2 - searchBounds.x1 + 1,
            height: searchBounds.y2 - searchBounds.y1 + 1,
        };
    }
    const tempBounds: Partial<IBounds> = {
        x1: undefined,
        y1: undefined,
        x2: undefined,
        y2: undefined,
    };
    for (let i = 3; i < imdat.data.length; i += 4) {
        if (imdat.data[i] > 0) {
            const x = ((i - 3) / 4) % searchWidth;
            const y = Math.floor((i - 3) / 4 / searchWidth);
            if (tempBounds.x1 === undefined || tempBounds.x1 > x) {
                tempBounds.x1 = x;
            }
            if (tempBounds.y1 === undefined) {
                tempBounds.y1 = y;
            }
            if (tempBounds.x2 === undefined || tempBounds.x2 < x) {
                tempBounds.x2 = x;
            }
            if (tempBounds.y2 === undefined || tempBounds.y2 < y) {
                tempBounds.y2 = y;
            }
        }
    }
    if (
        tempBounds.x1 === undefined ||
        tempBounds.y1 === undefined ||
        tempBounds.x2 === undefined ||
        tempBounds.y2 === undefined
    ) {
        return undefined;
    }

    return {
        x: tempBounds.x1 + searchBounds.x1,
        y: tempBounds.y1 + searchBounds.y1,
        width: tempBounds.x2! - tempBounds.x1 + 1,
        height: tempBounds.y2! - tempBounds.y1 + 1,
    };
}
