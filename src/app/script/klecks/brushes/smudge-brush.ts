import { BB } from '../../bb/bb';
import { IBounds, IPressureInput, IVector2D } from '../../bb/bb-types';
import { IHistoryEntry, KlHistory, THistoryInnerActions } from '../history/kl-history';
import { IRGB } from '../kl-types';
import { clamp } from '../../bb/math/math';
import { BezierLine, TBezierLineCallback } from '../../bb/math/line';

export interface ISmudgeBrushHistoryEntry extends IHistoryEntry {
    tool: ['brush', 'SmudgeBrush'];
    actions: THistoryInnerActions<SmudgeBrush>[];
}

// let statCount = 1;
// let statAcc = 0;
// stats on win10, chrome, size 100, opacity 80, smudge()
// unoptimized: 1 ms
// minimal: 0.09 ms
// minimal + circle: 0.5ms
// minimal + circle + ix, iy: 0.23ms
// unoptimized + ix, iy: 0.64 ms
// unoptimized + ix, iy + sans rounding: 0.61 ms
// ix, iy + sans rounding + sans random: 0.32ms
// ix, iy + sans rounding + fast random: 0.46 ms
// ix, iy + sans rounding + fast random + offset const: 0.48 ms

const CELL_SIZE = 256;

interface ISmudgeParams {
    aP: IVector2D;
    bP: IVector2D;
    size: {
        w: number;
        h: number;
    };
    brush: {
        center: IVector2D;
        size: number;
        opacity: number;
        alphaLock: boolean;
    };
}

/**
 * determine bounds of smudge
 * @param imWidth
 * @param imHeight
 * @param aP
 * @param bP
 * @param size
 */
function prepSmudge(
    imWidth: number,
    imHeight: number,
    aP: IVector2D, // top left of source, integers
    bP: IVector2D, // top left of dest, integers
    size: { w: number; h: number }, // size of both rectangles, integers
): {
    aP: IVector2D;
    bP: IVector2D;
    size: { w: number; h: number };
} | null {
    if (aP.x === bP.x && aP.y === bP.y) {
        return null;
    }

    aP = BB.copyObj(aP);
    bP = BB.copyObj(bP);
    size = BB.copyObj(size);

    // corner behavior
    // cut down rectangles, if a or b go outside
    // i.e. if user drags partially or fully outside the canvas
    {
        let top = 0;
        let right = 0;
        let bottom = 0;
        let left = 0;

        if (aP.x < 0) {
            left = -aP.x;
        }
        if (aP.y < 0) {
            top = -aP.y;
        }
        if (bP.x < 0) {
            left = Math.max(left, -bP.x);
        }
        if (bP.y < 0) {
            top = Math.max(top, -bP.y);
        }
        if (aP.x + size.w > imWidth) {
            right = aP.x + size.w - imWidth;
        }
        if (aP.y + size.h > imHeight) {
            bottom = aP.y + size.h - imHeight;
        }
        if (bP.x + size.w > imWidth) {
            right = Math.max(right, bP.x + size.w - imWidth);
        }
        if (bP.y + size.h > imHeight) {
            bottom = Math.max(bottom, bP.y + size.h - imHeight);
        }

        aP.x += left;
        bP.x += left;
        aP.y += top;
        bP.y += top;

        size.w = size.w - left - right;
        size.h = size.h - top - bottom;
        if (size.w <= 0 || size.h <= 0) {
            return null;
        }
    }

    return {
        aP: {
            x: aP.x,
            y: aP.y,
        },
        bP: {
            x: bP.x,
            y: bP.y,
        },
        size: {
            w: size.w,
            h: size.h,
        },
    };
}

/**
 * Pixel operations that do the smudging via ImageData
 * @param imageData
 * @param p
 */
function smudge(imageData: ImageData, p: ISmudgeParams): void {
    p = BB.copyObj(p);

    const cSize = p.brush.size;
    const cX = p.brush.center.x;
    const cY = p.brush.center.y;

    /*if (statCount % 1000 === 0) {
        console.log(statAcc / 1000);
        statAcc = 0;
    }
    let start = performance.now();*/

    // determine offset
    const aIndex = p.aP.y * imageData.width + p.aP.x;
    const bIndex = p.bP.y * imageData.width + p.bP.x;
    const offset = (bIndex - aIndex) * 4;

    // array with random numbers. faster than Math.random()
    let randI = 0;
    const randLen = cSize > 30 ? 1024 : 512; // lower lengths lead to noticeable patterns
    const randArr: number[] = [];
    for (let i = 0; i < randLen; i++) {
        randArr[i] = (Math.random() - 0.5) / 1.001 + 0.5;
    }

    const softnessPx = Math.max(3, Math.min(8, p.brush.size - 8));

    const pixel = (ai: number, bi: number, ix: number, iy: number): void => {
        const dist = BB.dist(cX, cY, ix, iy);
        const fac =
            1 - p.brush.opacity * (1 - clamp((dist - (cSize - softnessPx)) / softnessPx, 0, 1));

        if (fac === 1) {
            return;
        }

        if (!imageData.data[ai + 3]) {
            /* empty */
        } else if (!imageData.data[bi + 3]) {
            // don't mix if target fully transparent. pixel might have a strange color.
            imageData.data[bi] = imageData.data[ai];
            imageData.data[bi + 1] = imageData.data[ai + 1];
            imageData.data[bi + 2] = imageData.data[ai + 2];
        } else {
            // consider alpha ratio. If a has lower alpha than b, then b should be stronger, and vice versa
            // not totally accurate. TODO same compositing as blend brush
            let fac2;
            if (imageData.data[ai + 3] < imageData.data[bi + 3]) {
                fac2 = 1 - (imageData.data[ai + 3] / imageData.data[bi + 3]) * (1 - fac);
            } else {
                fac2 = (imageData.data[bi + 3] / imageData.data[ai + 3]) * fac;
            }

            // ImageData's Uint8ClampedArray rounds -> 0.5 becomes 1. But not in Safari, so needs to be done manually
            // Offset mixed color by random number noise (-0.5, 0.5), so it doesn't get stuck while mixing.
            // No +0.5, because it cancels out with rand.
            imageData.data[bi] = Math.floor(
                BB.mix(imageData.data[ai], imageData.data[bi + 0], fac2) + randArr[randI],
            );
            imageData.data[bi + 1] = Math.floor(
                BB.mix(imageData.data[ai + 1], imageData.data[bi + 1], fac2) + randArr[randI],
            );
            imageData.data[bi + 2] = Math.floor(
                BB.mix(imageData.data[ai + 2], imageData.data[bi + 2], fac2) + randArr[randI],
            );

            randI = (randI + 1) % randLen;
        }
        // Always mix alpha. unless alpha lock
        if (!p.brush.alphaLock) {
            imageData.data[bi + 3] = Math.floor(
                BB.mix(imageData.data[ai + 3], imageData.data[bi + 3], fac) + 0.5,
            );
        }
    };

    const bx1 = p.bP.x * 4;
    const bx2 = bx1 + (p.size.w - 1) * 4;

    // transfer of pixels depends on direction of smudging if there is overlap
    if (p.aP.y < p.bP.y) {
        for (let y = p.size.h - 1, iy = p.bP.y + p.size.h - 1; y >= 0; y--, iy--) {
            const yStart = (y + p.bP.y) * imageData.width * 4;
            for (
                let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = p.bP.x + p.size.w - 1;
                x >= bx1 + yStart;
                x -= 4, x2 -= 4, ix--
            ) {
                pixel(x2, x, ix, iy);
            }
        }
    } else if (p.aP.y > p.bP.y) {
        for (let y = 0, iy = p.bP.y; y < p.size.h; y++, iy++) {
            const yStart = (y + p.bP.y) * imageData.width * 4;
            for (
                let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = p.bP.x + p.size.w - 1;
                x >= bx1 + yStart;
                x -= 4, x2 -= 4, ix--
            ) {
                pixel(x2, x, ix, iy);
            }
        }
    } else {
        if (p.aP.x < p.bP.x) {
            for (let y = p.size.h - 1, iy = p.bP.y + p.size.h - 1; y >= 0; y--, iy--) {
                const yStart = (y + p.bP.y) * imageData.width * 4;
                for (
                    let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = p.bP.x + p.size.w - 1;
                    x >= bx1 + yStart;
                    x -= 4, x2 -= 4, ix--
                ) {
                    pixel(x2, x, ix, iy);
                }
            }
        } else {
            for (let y = 0, iy = p.bP.y; y < p.size.h; y++, iy++) {
                const yStart = (y + p.bP.y) * imageData.width * 4;
                for (
                    let x = bx1 + yStart, x2 = bx1 + yStart - offset, ix = p.bP.x;
                    x < bx2 + yStart;
                    x += 4, x2 += 4, ix++
                ) {
                    pixel(x2, x, ix, iy);
                }
            }
        }
    }

    //statCount++;
    //statAcc += performance.now() - start;
}

export class SmudgeBrush {
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private history: KlHistory | undefined;
    private historyEntry: ISmudgeBrushHistoryEntry | undefined;

    private settingColor: IRGB = { r: 0, g: 0, b: 0 };
    private settingSize: number = 35;
    private settingSpacing: number = 0.20446882736951905;
    private settingOpacity: number = 0.8;
    private settingHasSizePressure: boolean = false;
    private settingHasOpacityPressure: boolean = false;
    private settingLockLayerAlpha: boolean = false;

    private lineToolLastDot: number = 0;
    private lastInput: IPressureInput = { x: 0, y: 0, pressure: 0 };
    private lastInput2: IPressureInput = { x: 0, y: 0, pressure: 0 };
    private lastDot: IVector2D | undefined;

    private isDrawing: boolean = false;

    private bezierLine: BezierLine | undefined;

    private redrawBounds: IBounds | undefined;
    private completeRedrawBounds: IBounds | undefined;

    private copyImageData: ImageData = {} as ImageData;

    private drawBuffer: ISmudgeParams[] = [];

    private copiedCells: boolean[] = [];

    // workaround for https://github.com/microsoft/TypeScript/issues/41654
    private resetRedrawBounds(): void {
        this.redrawBounds = undefined;
    }

    private updateRedrawBounds(bounds: IBounds): void {
        this.redrawBounds = BB.updateBounds(this.redrawBounds, bounds);
    }

    private updateCompleteRedrawBounds(x1: number, y1: number, x2: number, y2: number): void {
        this.completeRedrawBounds = BB.updateBounds(this.completeRedrawBounds, {
            x1,
            y1,
            x2,
            y2,
        });
    }

    /**
     * update copyImageData. copy over new regions if needed
     */
    copyFromCanvas(): void {
        const touchedCells = this.copiedCells.map(() => false);

        const bounds: IBounds[] = [];
        const cellsW = Math.ceil(this.copyImageData.width / CELL_SIZE);

        if (!this.redrawBounds) {
            return;
        }
        bounds.push({
            x1: Math.floor(this.redrawBounds.x1 / CELL_SIZE),
            y1: Math.floor(this.redrawBounds.y1 / CELL_SIZE),
            x2: Math.floor(this.redrawBounds.x2 / CELL_SIZE),
            y2: Math.floor(this.redrawBounds.y2 / CELL_SIZE),
        });
        bounds.forEach((item) => {
            for (let i = item.x1; i <= item.x2; i++) {
                for (let e = item.y1; e <= item.y2; e++) {
                    touchedCells[e * cellsW + i] = true;
                }
            }
        });

        touchedCells.forEach((item, i) => {
            if (!item || this.copiedCells[i]) {
                // not touched, or already copied
                return;
            }
            this.copiedCells[i] = true;
            const x = i % cellsW;
            const y = Math.floor(i / cellsW);
            const w =
                ((Math.min(x * CELL_SIZE + CELL_SIZE, this.copyImageData.width) - 1) % CELL_SIZE) +
                1;
            const h =
                ((Math.min(y * CELL_SIZE + CELL_SIZE, this.copyImageData.height) - 1) % CELL_SIZE) +
                1;

            // temp canvas to prevent main canvas from getting slowed down in chrome
            const tmpCanvas = BB.canvas(w, h);
            const tmpCtx = BB.ctx(tmpCanvas);
            tmpCtx.drawImage(this.context.canvas, -x * CELL_SIZE, -y * CELL_SIZE);

            const data = tmpCtx.getImageData(0, 0, w, h);

            for (let i = 0; i < h; i++) {
                for (
                    let e = 0,
                        e2 = i * w * 4,
                        e3 = ((y * CELL_SIZE + i) * this.copyImageData.width + x * CELL_SIZE) * 4;
                    e < w;
                    e++, e2 += 4, e3 += 4
                ) {
                    this.copyImageData.data[e3] = data.data[e2];
                    this.copyImageData.data[e3 + 1] = data.data[e2 + 1];
                    this.copyImageData.data[e3 + 2] = data.data[e2 + 2];
                    this.copyImageData.data[e3 + 3] = data.data[e2 + 3];
                }
            }
        });
    }

    /**
     * fill drawBuffer with params about to be drawn
     * @param x
     * @param y
     * @param size
     * @param opacity
     */
    prepDot(x: number, y: number, size: number, opacity: number): void {
        if (!this.lastDot) {
            this.lastDot = {
                x: x,
                y: y,
            };
            return;
        }

        size = Math.round(size);

        const w = Math.round(size * 2);
        const h = Math.round(size * 2);

        const bounds = prepSmudge(
            this.copyImageData.width,
            this.copyImageData.height,
            {
                x: Math.round(this.lastDot.x - size),
                y: Math.round(this.lastDot.y - size),
            },
            {
                x: Math.round(x - size),
                y: Math.round(y - size),
            },
            {
                w,
                h,
            },
        );

        if (bounds) {
            const params: ISmudgeParams = {
                aP: bounds.aP,
                bP: bounds.bP,
                size: bounds.size,
                brush: {
                    center: { x, y },
                    size,
                    opacity,
                    alphaLock: this.settingLockLayerAlpha,
                },
            };
            this.updateRedrawBounds({
                x1: params.bP.x,
                y1: params.bP.y,
                x2: params.bP.x + params.brush.size * 2,
                y2: params.bP.y + params.brush.size * 2,
            });
            this.drawBuffer.push(params);
        }

        this.lastDot = {
            x: x,
            y: y,
        };
    }

    continueLine(
        x: number | undefined,
        y: number | undefined,
        size: number,
        pressure: number,
    ): void {
        this.drawBuffer = [];

        if (!this.bezierLine) {
            this.bezierLine = new BB.BezierLine();
            this.bezierLine.add(this.lastInput.x, this.lastInput.y, 0, function () {});
        }

        const drawArr: Parameters<typeof this.prepDot>[] = []; //draw instructions. will be all drawn at once

        const dotCallback: TBezierLineCallback = (val): void => {
            const localPressure = BB.mix(this.lastInput2.pressure, pressure, val.t);
            const localOpacity =
                this.settingOpacity *
                (this.settingHasOpacityPressure ? localPressure * localPressure : 1);
            const localSize = Math.max(
                0.1,
                this.settingSize * (this.settingHasSizePressure ? localPressure : 1),
            );
            drawArr.push([val.x, val.y, localSize, localOpacity]); //, val.angle]);
        };

        const localSpacing = (size * this.settingSpacing) / 3;
        if (x === undefined || y === undefined) {
            this.bezierLine.addFinal(localSpacing, dotCallback);
        } else {
            this.bezierLine.add(x, y, localSpacing, dotCallback);
        }

        // execute draw instructions
        for (let i = 0; i < drawArr.length; i++) {
            const item = drawArr[i];
            this.prepDot(item[0], item[1], item[2], item[3]);
        }

        this.copyFromCanvas();

        for (let i = 0; i < this.drawBuffer.length; i++) {
            smudge(this.copyImageData, this.drawBuffer[i]);
        }
    }

    // ----------------------------------- public -----------------------------------

    constructor() {}

    startLine(x: number, y: number, p: number): void {
        this.historyEntry = {
            tool: ['brush', 'SmudgeBrush'],
            actions: [],
        };

        p = BB.clamp(p, 0, 1);
        const localOpacity = this.settingHasOpacityPressure
            ? this.settingOpacity * p * p
            : this.settingOpacity;
        const localSize = this.settingHasSizePressure
            ? Math.max(0.1, p * this.settingSize)
            : Math.max(0.1, this.settingSize);

        this.lastDot = undefined;
        this.isDrawing = true;

        this.copyImageData = new ImageData(this.context.canvas.width, this.context.canvas.height);
        const totalCells =
            Math.ceil(this.context.canvas.width / CELL_SIZE) *
            Math.ceil(this.context.canvas.height / CELL_SIZE);
        this.copiedCells = '0'
            .repeat(totalCells)
            .split('')
            .map(() => false);

        this.prepDot(x, y, localSize, localOpacity);

        this.lineToolLastDot = localSize * this.settingSpacing;
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
        this.lastInput2.pressure = p;

        this.completeRedrawBounds = undefined;
    }

    goLine(x: number, y: number, p: number): void {
        if (!this.isDrawing) {
            return;
        }

        this.resetRedrawBounds();
        const pressure = BB.clamp(p, 0, 1);
        const localSize = this.settingHasSizePressure
            ? Math.max(0.1, this.lastInput.pressure * this.settingSize)
            : Math.max(0.1, this.settingSize);

        this.continueLine(x, y, localSize, this.lastInput.pressure);

        if (this.redrawBounds) {
            this.context.putImageData(
                this.copyImageData,
                0,
                0,
                this.redrawBounds.x1,
                this.redrawBounds.y1,
                this.redrawBounds.x2 - this.redrawBounds.x1 - 1,
                this.redrawBounds.y2 - this.redrawBounds.y1 - 1,
            );
            this.updateCompleteRedrawBounds(
                this.redrawBounds.x1,
                this.redrawBounds.y1,
                this.redrawBounds.x2,
                this.redrawBounds.y2,
            );
        }

        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput2.pressure = this.lastInput.pressure;
        this.lastInput.pressure = pressure;
    }

    endLine(): void {
        this.resetRedrawBounds();
        const localSize = this.settingHasSizePressure
            ? Math.max(0.1, this.lastInput.pressure * this.settingSize)
            : Math.max(0.1, this.settingSize);
        this.context.save();
        this.continueLine(undefined, undefined, localSize, this.lastInput.pressure);
        this.context.restore();

        this.isDrawing = false;
        this.bezierLine = undefined;

        if (this.redrawBounds) {
            this.context.putImageData(
                this.copyImageData,
                0,
                0,
                this.redrawBounds.x1,
                this.redrawBounds.y1,
                this.redrawBounds.x2 - this.redrawBounds.x1 - 1,
                this.redrawBounds.y2 - this.redrawBounds.y1 - 1,
            );
            this.updateCompleteRedrawBounds(
                this.redrawBounds.x1,
                this.redrawBounds.y1,
                this.redrawBounds.x2,
                this.redrawBounds.y2,
            );
        }

        if (this.historyEntry && this.completeRedrawBounds) {
            let historyIm: ImageData | HTMLCanvasElement = this.copyImageData;
            if (
                !(
                    this.completeRedrawBounds.x1 === 0 &&
                    this.completeRedrawBounds.y1 === 0 &&
                    this.completeRedrawBounds.x2 >= this.context.canvas.width - 1 &&
                    this.completeRedrawBounds.y2 >= this.context.canvas.height - 1
                )
            ) {
                // temp canvas to prevent main canvas from getting slowed down in chrome
                const tmpCanvas = BB.canvas(
                    this.completeRedrawBounds.x2 - this.completeRedrawBounds.x1 + 1,
                    this.completeRedrawBounds.y2 - this.completeRedrawBounds.y1 + 1,
                );
                const tmpCtx = BB.ctx(tmpCanvas);
                tmpCtx.drawImage(
                    this.context.canvas,
                    -this.completeRedrawBounds.x1,
                    -this.completeRedrawBounds.y1,
                );

                historyIm = tmpCanvas; // faster than getting image data (measured on 2018 lenovo chromebook)
            }
            this.historyEntry.actions.push({
                action: 'drawImage',
                params: [historyIm, this.completeRedrawBounds.x1, this.completeRedrawBounds.y1],
            });
            this.history?.push(this.historyEntry);
            this.historyEntry = undefined;
        }
        this.copyImageData = {} as ImageData;
    }

    drawImage(im: ImageData | HTMLCanvasElement, x: number, y: number): void {
        if (im instanceof ImageData) {
            this.context.putImageData(im, x, y);
        } else {
            this.context.clearRect(x, y, im.width, im.height);
            this.context.drawImage(im, x, y);
        }
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        return;
        /*
        // todo
        lastInput.x = x2;
        lastInput.y = y2;
        lastInput.pressure = 1;

        if (isDrawing || x1 === undefined) {
            return;
        }

        let angle = BB.pointsToAngleDeg({x:x1, y:y1}, {x:x2, y:y2});
        let mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
        let eX = (x2 - x1) / mouseDist;
        let eY = (y2 - y1) / mouseDist;
        let loopDist;
        let bdist = settingSize * settingSpacing;
        lineToolLastDot = settingSize * settingSpacing;
        for (loopDist = lineToolLastDot; loopDist <= mouseDist; loopDist += bdist) {
            drawDot(x1 + eX * loopDist, y1 + eY * loopDist, settingSize, settingOpacity);
        }


        let historyEntry = {
            tool: ["brush", "SmudgeBrush"],
            actions: []
        };
        // todo
        history.add(historyEntry);*/
    }

    getIsDrawing(): boolean {
        return this.isDrawing;
    }

    setColor(c: IRGB): void {
        if (
            this.settingColor.r === c.r &&
            this.settingColor.g === c.g &&
            this.settingColor.b === c.b
        ) {
            return;
        }
        this.settingColor = { r: c.r, g: c.g, b: c.b };
    }

    setContext(c: CanvasRenderingContext2D): void {
        this.context = c;
    }

    setHistory(h: KlHistory): void {
        this.history = h;
    }

    setSize(s: number): void {
        this.settingSize = s;
    }

    setOpacity(o: number): void {
        this.settingOpacity = o;
    }

    setSpacing(s: number): void {
        this.settingSpacing = s;
    }

    sizePressure(b: boolean): void {
        this.settingHasSizePressure = b;
    }

    opacityPressure(b: boolean): void {
        this.settingHasOpacityPressure = b;
    }

    setLockAlpha(b: boolean): void {
        this.settingLockLayerAlpha = b;
    }

    getSpacing(): number {
        return this.settingSpacing;
    }

    getSize(): number {
        return this.settingSize;
    }

    getOpacity(): number {
        return this.settingOpacity;
    }

    getLockAlpha(): boolean {
        return this.settingLockLayerAlpha;
    }
}
