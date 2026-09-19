import { TIndexBounds, TKeyString, TRect } from '../bb-types';
import { createCanvas } from './create-canvas';
import { attempt, AttemptError, base64ToBlob } from './base';
import { loadImage } from './load-image';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../multi-polygon/get-selection-path-2d';
import { boundsToRect } from '../math/math';
import { changeCanvasDimensions } from './change-canvas-dimensions';
import { BB } from '../bb';

export function copyToCanvas(image: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
    const resultCanvas = createCanvas(image.width, image.height);
    const ctx = resultCanvas.getContext('2d');
    if (!ctx) {
        throw new Error('2d context not supported or canvas already initialized');
    }
    ctx.drawImage(image, 0, 0);
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

export async function loadToCanvas(path: string): Promise<HTMLCanvasElement> {
    const im = await loadImage(path);
    const canvas = createCanvas(im.width, im.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(im, 0, 0);
    return canvas;
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
    bounds ??= {
        x: 0,
        y: 0,
        width: transformImage.width,
        height: transformImage.height,
    };

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

export const createCheckerCanvas = function (size: number, isDark?: boolean): HTMLCanvasElement {
    const canvas = size < 1 ? createCanvas(1, 1) : createCanvas(size * 2, size * 2);
    const ctx = BB.ctx(canvas);
    if (size < 1) {
        ctx.fillStyle = 'rgb(128, 128, 128)';
        ctx.fillRect(0, 0, 1, 1);
    } else {
        ctx.fillStyle = isDark ? 'rgb(90, 90, 90)' : 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, size * 2, size * 2);
        ctx.fillStyle = isDark ? 'rgb(63, 63, 63)' : 'rgb(200, 200, 200)';
        ctx.fillRect(0, 0, size, size);
        ctx.fillRect(size, size, size * 2, size * 2);
    }
    return canvas;
};

export const createCheckerDataUrl = (function () {
    // previously created dataUrls
    const cache: TKeyString = {};

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
        changeCanvasDimensions(
            tmp2,
            base2.oldWidthEx > base2.newWidthEx ? 2 ** base2.oldWidthEx : w,
            base2.oldHeightEx > base2.newHeightEx ? 2 ** base2.oldHeightEx : h,
        );
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
            changeCanvasDimensions(buffer1, newWidth, newHeight, { ensureCleared: true });

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
        changeCanvasDimensions(canvas, w, h, { ensureCleared: true });
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
        changeCanvasDimensions(tmp1, w, h, { ensureCleared: true });
        const tmp1Ctx = tmp1.getContext('2d')!;
        tmp1Ctx.save();
        tmp1Ctx.imageSmoothingEnabled = true;
        tmp1Ctx.imageSmoothingQuality = 'high';
        tmp1Ctx.drawImage(canvas, 0, 0, w, h);
        tmp1Ctx.restore();

        changeCanvasDimensions(canvas, w, h);
        canvas.getContext('2d')!.drawImage(tmp1, 0, 0);
    } else {
        resizeCanvas(canvas, w, canvas.height, tmp1, tmp2);
        resizeCanvas(canvas, w, h, tmp1, tmp2);
    }
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
 * Determines a bounding box that describes all pixels, which are not fully transparent.
 * Returns undefined if empty.
 */
export function getCanvasBounds(
    context: CanvasRenderingContext2D,
    //restricts the search to this area.
    searchArea?: TIndexBounds,
): TRect | undefined {
    const searchRect = searchArea
        ? boundsToRect(searchArea)
        : {
              x: 0,
              y: 0,
              width: context.canvas.width,
              height: context.canvas.height,
          };
    if (searchRect.width <= 0 || searchRect.height <= 0) {
        return undefined;
    }

    const imdat = context.getImageData(
        searchRect.x,
        searchRect.y,
        searchRect.width,
        searchRect.height,
    );

    // top-left and bottom-right are non-transparent.
    if (imdat.data[3] > 0 && imdat.data.at(-1)! > 0) {
        return searchRect;
    }

    const tempBounds: Partial<TIndexBounds> = {};

    for (let i = 3; i < imdat.data.length; i += 4) {
        if (imdat.data[i] > 0) {
            const px = ((i - 3) / 4) % searchRect.width;
            const py = Math.floor((i - 3) / 4 / searchRect.width);

            if (tempBounds.x1 === undefined || px < tempBounds.x1) {
                tempBounds.x1 = px;
            }
            if (tempBounds.y1 === undefined || py < tempBounds.y1) {
                tempBounds.y1 = py;
            }
            if (tempBounds.x2 === undefined || px + 1 > tempBounds.x2) {
                tempBounds.x2 = px;
            }
            if (tempBounds.y2 === undefined || py + 1 > tempBounds.y2) {
                tempBounds.y2 = py;
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
        x: tempBounds.x1 + searchRect.x,
        y: tempBounds.y1 + searchRect.y,
        width: tempBounds.x2 - tempBounds.x1 + 1,
        height: tempBounds.y2 - tempBounds.y1 + 1,
    };
}

export function getImageDataSafely(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
): ImageData {
    const result = attempt(() => ctx.getImageData(x, y, width, height));
    return result instanceof AttemptError ? new ImageData(width, height) : result;
}

export function htmlCanvasToBlobAsync(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to create blob from canvas.'));
            }
        }, mimeType);
    });
}

export async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
    if ('toBlob' in HTMLCanvasElement.prototype) {
        return await htmlCanvasToBlobAsync(canvas, mimeType);
    } else {
        // assume base64
        return base64ToBlob(canvas.toDataURL(mimeType));
    }
}

export function drawSelectionMask(
    selection: MultiPolygon,
    context: CanvasRenderingContext2D,
): void {
    const canvas = context.canvas;
    context.save();
    context.fillRect(0, 0, canvas.width, canvas.height);
    const selectionPath = getSelectionPath2d(selection);
    context.clip(selectionPath);
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
}

export const identityTransform = Object.freeze([1, 0, 0, 1, 0, 0] as const);
