import { BB } from '../../bb/bb';
import { changeCanvasDimensions } from '../../bb/base/change-canvas-dimensions';
import { isLayerFill, TRgb, TRgba } from '../kl-types';
import { TIndexBounds, TPressureInput } from '../../bb/bb-types';
import { clamp, intersectBounds } from '../../bb/math/math';
import { LinearLine, TLinearLineCallback } from '../../bb/math/line';
import { HISTORY_TILE_SIZE, KlHistory } from '../history/kl-history';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { copyImageData } from '../utils/copy-image-data';
import { createArray } from '../../bb/base/base';
import { createImageDataTile, getTileSizeFromIndex } from '../history/image-data-tile';
import { getBinaryMask } from '../select-tool/get-binary-mask';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { getChangedTiles } from '../history/push-helpers/changed-tiles';
import { freeCanvas } from '../../bb/base/canvas';

// Distance (px) along the stroke between color samples.
const BLEND_SAMPLE_DISTANCE = 5;

// Dot spacing is a fixed fraction of the dot diameter -> same overlap at every size.
// Spacing never goes below SPACING_MIN. Instead, the dot alpha is raised to reach the same shade.
const SPACING_RATIO = 0.08;
const SPACING_MIN = 1; // px

type TDrawBufferItem = {
    x: number;
    y: number;
    size: number;
    opacity: number;
    alphaExponent: number; // alpha -> 1 - (1 - alpha)^alphaExponent. 1 -> unchanged

    // indices
    x1: number;
    y1: number;
    x2: number;
    y2: number;

    r: number;
    g: number;
    b: number;
};

export class BlendBrush {
    // testing mode - context only gets updated when line is finished
    private isTesting: boolean = false;

    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private layerId: string = 'NOT_SET';
    private color: TRgb = {} as TRgb;
    private size: number = 30; // radius - 0.5 - 99999
    private opacity: number = 0.6; // 0-1
    private blending: number = 0.8; // 0-1

    private settingLockLayerAlpha: boolean = false;
    private settingSizePressure: boolean = false;
    private settingOpacityPressure: boolean = true;
    private settingBlendingPressure: boolean = true;

    private blendCol: TRgba = { r: 0, g: 0, b: 0, a: 1 }; // todo docs
    private blendMix: number = 0.45; // todo docs
    private mixCol: TRgb = { r: 0, g: 0, b: 0 }; // todo docs
    private localColOld: TRgba = {} as TRgba; // color of the previous sample
    private localColNew: TRgba = {} as TRgba; // color of the latest sample
    private distSinceSample: number = 0;

    private isDrawing: boolean = false;
    private lastInput: TPressureInput = { x: 0, y: 0, pressure: 0 }; // todo docs
    private linearLine: undefined | LinearLine;

    private klHistory: KlHistory = {} as KlHistory;
    private redrawBounds: TIndexBounds | undefined;
    private cells: (ImageData | undefined)[] = [];
    private drawBuffer: TDrawBufferItem[] = [];

    private selectionBounds: TIndexBounds | undefined;
    private mask: Uint8Array | undefined;

    private updateRedrawBounds(bounds: TIndexBounds): void {
        const boundsWithinSelection = intersectBounds(bounds, this.selectionBounds);
        if (!boundsWithinSelection) {
            return;
        }
        this.redrawBounds = BB.updateBounds(this.redrawBounds, boundsWithinSelection);
    }

    private getCellsWidth(): number {
        return Math.ceil(this.context.canvas.width / HISTORY_TILE_SIZE);
    }

    /**
     * draw cells onto context
     * @param cells
     */
    private drawCells(cells: (ImageData | undefined)[]): void {
        const cellsW = this.getCellsWidth();
        cells.forEach((imageData, index) => {
            if (!imageData) {
                return;
            }
            const cellOffsetX = (index % cellsW) * HISTORY_TILE_SIZE;
            const cellOffsetY = Math.floor(index / cellsW) * HISTORY_TILE_SIZE;
            this.context.putImageData(imageData, cellOffsetX, cellOffsetY);
        });
    }

    /**
     * draw changed cells (changed by brushstroke) onto context
     * @private
     */
    private drawChangedCells(): void {
        if (!this.redrawBounds) {
            return;
        }

        const cells: typeof this.cells = this.cells.map(() => undefined);
        const touchedCells = this.getTouchedCells(this.redrawBounds);
        touchedCells.forEach((isTouched, index) => {
            if (isTouched) {
                cells[index] = this.cells[index];
            }
        });
        this.drawCells(cells);
        this.redrawBounds = undefined;
    }

    private getTouchedCells(bounds: TIndexBounds): boolean[] {
        const touchedCells = this.cells.map(() => false);
        const cellsW = this.getCellsWidth();
        bounds = {
            type: 'index',
            x1: Math.floor(bounds.x1 / HISTORY_TILE_SIZE),
            y1: Math.floor(bounds.y1 / HISTORY_TILE_SIZE),
            x2: Math.floor(bounds.x2 / HISTORY_TILE_SIZE),
            y2: Math.floor(bounds.y2 / HISTORY_TILE_SIZE),
        };
        for (let i = bounds.x1; i <= bounds.x2; i++) {
            for (let e = bounds.y1; e <= bounds.y2; e++) {
                touchedCells[e * cellsW + i] = true;
            }
        }
        return touchedCells;
    }

    /**
     * Slice up bounds according to cells
     * @param bounds
     * @private
     */
    private sliceBounds(bounds: TIndexBounds): { index: number; bounds: TIndexBounds }[] {
        const boundsWithinSelection = intersectBounds(bounds, this.selectionBounds);
        if (!boundsWithinSelection) {
            return [];
        }
        const cellsW = this.getCellsWidth();
        const result: { index: number; bounds: TIndexBounds }[] = [];
        const touchedCells = this.getTouchedCells(boundsWithinSelection);

        touchedCells.forEach((cell, i) => {
            if (!cell) {
                return;
            }

            const cellOffsetX = (i % cellsW) * HISTORY_TILE_SIZE;
            const cellOffsetY = Math.floor(i / cellsW) * HISTORY_TILE_SIZE;
            const cellWidth = this.cells[i]!.width;
            const cellHeight = this.cells[i]!.height;

            const inCellBounds: TIndexBounds = {
                type: 'index',
                x1: Math.max(0, boundsWithinSelection.x1 - cellOffsetX),
                y1: Math.max(0, boundsWithinSelection.y1 - cellOffsetY),
                x2: Math.min(cellWidth - 1, boundsWithinSelection.x2 - cellOffsetX),
                y2: Math.min(cellHeight - 1, boundsWithinSelection.y2 - cellOffsetY),
            };
            if (inCellBounds.x1 > inCellBounds.x2 || inCellBounds.y1 > inCellBounds.y2) {
                return;
            }
            result.push({
                index: i,
                bounds: inCellBounds,
            });
        });

        return result;
    }

    /**
     * update copyImageData. copy over new regions if needed
     */
    private copyFromCanvas(bounds: TIndexBounds | undefined): void {
        if (!bounds) {
            return;
        }

        const touchedCells = this.getTouchedCells(bounds);
        const composedLayer = this.klHistory.getComposed().layerMap[this.layerId];

        let canvas: HTMLCanvasElement | undefined;
        touchedCells.forEach((item, i) => {
            if (!item || this.cells[i]) {
                // not touched, or already copied
                return;
            }
            // Uncaught TypeError: Cannot read properties of undefined (reading 'tiles')
            const composedTile = composedLayer.tiles[i];
            if (isLayerFill(composedTile)) {
                const { width, height } = getTileSizeFromIndex(i, this.context.canvas);
                if (!canvas) {
                    canvas = BB.canvas(width, height);
                } else {
                    changeCanvasDimensions(canvas, width, height, { ensureCleared: true });
                }
                const ctx = BB.ctx(canvas);
                ctx.fillStyle = composedTile.fill;
                ctx.fillRect(0, 0, width, height);
                // InvalidStateError: The object is in an invalid state.
                this.cells[i] = ctx.getImageData(0, 0, width, height);
            } else {
                this.cells[i] = copyImageData(composedTile.data);
            }
        });
        if (canvas) {
            freeCanvas(canvas);
        }
    }

    private getAverage(x: number, y: number, size: number): TRgba {
        size = Math.max(0.5, size * 0.75);
        const x1 = Math.max(0, Math.floor(x - size));
        const y1 = Math.max(0, Math.floor(y - size));
        const x2 = Math.min(this.context.canvas.width - 1, Math.ceil(x + size));
        const y2 = Math.min(this.context.canvas.height - 1, Math.ceil(y + size));
        if (x1 > x2 || y1 > y2) {
            return { r: 0, g: 0, b: 0, a: 0 };
        }

        let ar = 0,
            ag = 0,
            ab = 0,
            aa = 0;

        const slicedBounds = this.sliceBounds({ type: 'index', x1, y1, x2, y2 });
        const cellsW = this.getCellsWidth();

        slicedBounds.forEach((slice) => {
            const cellOffsetX = (slice.index % cellsW) * HISTORY_TILE_SIZE;
            const cellOffsetY = Math.floor(slice.index / cellsW) * HISTORY_TILE_SIZE;
            const width = this.cells[slice.index]!.width;
            const data = this.cells[slice.index]!.data;
            const bounds = slice.bounds;

            for (let i = bounds.y1, globalY = i + cellOffsetY; i <= bounds.y2; i++, globalY++) {
                for (
                    let e = bounds.x1, globalX = e + cellOffsetX, e2 = (i * width + bounds.x1) * 4;
                    e <= bounds.x2;
                    e++, globalX++, e2 += 4
                ) {
                    if (
                        this.mask &&
                        this.mask[globalY * this.context.canvas.width + globalX] === 0
                    ) {
                        // don't same where the mask is 0
                        continue;
                    }

                    const alpha = data[e2 + 3] / 255;
                    if (alpha === 0) {
                        continue;
                    }

                    ar += data[e2] * alpha;
                    ag += data[e2 + 1] * alpha;
                    ab += data[e2 + 2] * alpha;
                    aa += alpha;
                }
            }
        });

        if (aa !== 0) {
            ar /= aa;
            ag /= aa;
            ab /= aa;
            aa = Math.min(1, aa);
        }
        return { r: ar, g: ag, b: ab, a: aa };
    }

    private getDotBounds(x: number, y: number, size: number): TIndexBounds | undefined {
        size = Math.max(0.5, size);
        const x1 = Math.max(0, Math.floor(x - size));
        const y1 = Math.max(0, Math.floor(y - size));
        const x2 = Math.min(this.context.canvas.width - 1, Math.ceil(x + size));
        const y2 = Math.min(this.context.canvas.height - 1, Math.ceil(y + size));
        if (x1 > x2 || y1 > y2) {
            return undefined;
        }
        return { type: 'index', x1, y1, x2, y2 };
    }

    private drawDot(params: TDrawBufferItem): void {
        // array with random numbers. faster than Math.random()
        let randI = 0;
        const randLen = params.size > 30 ? 1024 : 512; // lower lengths lead to noticeable patterns
        const randArr: number[] = [];
        for (let i = 0; i < randLen; i++) {
            randArr[i] = (Math.random() - 0.5) / 1.001 + 0.5;
        }

        // thin lines take more than just 1 sample
        const sampleArr = [8, 4, 4, 4, 2, 2, 2, 2, 2, 2]; // <0.5, 0.5, 1, 1.5, etc.
        const samples = sampleArr[Math.floor(params.size * 2)];
        const samplesSquared: number = samples ? samples * samples : 0;
        const sampleOffsets: number[] = [];
        if (samples) {
            let i = 0;
            for (let n = 0; n < samples; n++) {
                for (let m = 0; m < samples; m++, i += 2) {
                    sampleOffsets[i] = (n + 1) / samples; // x offset
                    sampleOffsets[i + 1] = (m + 1) / samples; // y offset
                }
            }
        }

        const sharpness = params.opacity ** 2 * 0.8;
        // to optimize calculations
        const invSharpness = 1 - sharpness;
        const sharpnessSubtrahend = sharpness / invSharpness;
        const sizeSquared = params.size * params.size;
        const distDivisor = (sizeSquared * invSharpness) / params.opacity;
        const alphaMinuend = (1 + sharpnessSubtrahend) * params.opacity;
        const hasAlphaExponent = params.alphaExponent !== 1;

        const slicedBounds = this.sliceBounds({
            type: 'index',
            x1: params.x1,
            y1: params.y1,
            x2: params.x2,
            y2: params.y2,
        });

        const cellsW = this.getCellsWidth();
        slicedBounds.forEach((slice) => {
            const cellOffsetX = (slice.index % cellsW) * HISTORY_TILE_SIZE;
            const cellOffsetY = Math.floor(slice.index / cellsW) * HISTORY_TILE_SIZE;
            const cellWidth = this.cells[slice.index]!.width;
            const data = this.cells[slice.index]!.data;

            // i - y index within cell
            // e - x index within cell

            // e2 - index in image data (a tile)
            // mi - index in mask (one mask for the entire image)

            // ri - y index within image relative to dot-center
            // re - x index within image relative to dot-center

            for (
                let i = slice.bounds.y1, ri = i + cellOffsetY - params.y;
                i <= slice.bounds.y2;
                i++, ri++
            ) {
                for (
                    let e = slice.bounds.x1,
                        mi =
                            (i + cellOffsetY) * this.context.canvas.width +
                            (slice.bounds.x1 + cellOffsetX),
                        e2 = (i * cellWidth + slice.bounds.x1) * 4,
                        re = e + cellOffsetX - params.x;
                    e <= slice.bounds.x2;
                    e++, mi++, e2 += 4, re++
                ) {
                    if (this.mask && this.mask[mi] === 0) {
                        continue;
                    }

                    // O = over -> brush-dot
                    // U = under -> image

                    let alphaO = 0;
                    if (samplesSquared) {
                        for (let f = 0; f < sampleOffsets.length; f += 2) {
                            const dist = BB.lenSquared(
                                re + sampleOffsets[f],
                                ri + sampleOffsets[f + 1],
                            );
                            if (dist >= sizeSquared) {
                                continue;
                            }
                            const sampleAlpha = clamp(
                                alphaMinuend - dist / distDivisor,
                                0,
                                params.opacity,
                            );
                            // compensate per sample, so the coverage (antialiasing) stays linear
                            alphaO += hasAlphaExponent
                                ? 1 - (1 - sampleAlpha) ** params.alphaExponent
                                : sampleAlpha;
                        }
                        if (!alphaO) {
                            continue;
                        }
                        alphaO /= samplesSquared;
                    } else {
                        // technically needs + 0.5 offset, but not noticeable with large brush
                        const dist = re ** 2 + ri ** 2;
                        if (dist >= sizeSquared) {
                            continue;
                        }
                        alphaO = clamp(alphaMinuend - dist / distDivisor, 0, params.opacity);
                        if (hasAlphaExponent) {
                            alphaO = 1 - (1 - alphaO) ** params.alphaExponent;
                        }
                    }

                    const invAlphaO = 1 - alphaO;
                    const alphaU = data[e2 + 3] / 255;

                    if (this.settingLockLayerAlpha) {
                        const underR = params.r * alphaO + data[e2] * invAlphaO;
                        const underG = params.g * alphaO + data[e2 + 1] * invAlphaO;
                        const underB = params.b * alphaO + data[e2 + 2] * invAlphaO;
                        if (alphaU) {
                            data[e2] = Math.floor(underR + randArr[randI]);
                            data[e2 + 1] = Math.floor(underG + randArr[randI]);
                            data[e2 + 2] = Math.floor(underB + randArr[randI]);
                        }
                    } else {
                        const underR = params.r * alphaO + data[e2] * alphaU * invAlphaO;
                        const underG = params.g * alphaO + data[e2 + 1] * alphaU * invAlphaO;
                        const underB = params.b * alphaO + data[e2 + 2] * alphaU * invAlphaO;

                        const newAlpha = 1 - invAlphaO * (1 - alphaU);
                        data[e2 + 3] = Math.floor(Math.min(255, newAlpha * 255) + 0.5);
                        if (newAlpha) {
                            data[e2] = Math.floor(underR / newAlpha + randArr[randI]);
                            data[e2 + 1] = Math.floor(underG / newAlpha + randArr[randI]);
                            data[e2 + 2] = Math.floor(underB / newAlpha + randArr[randI]);
                        }
                    }
                    randI = (randI + 1) % randLen;
                }
            }
        });
    }

    // desired spacing, before clamping to SPACING_MIN
    private calcSpacingUnclamped(size: number): number {
        return size * 2 * SPACING_RATIO;
    }

    private calcSpacing(size: number): number {
        return Math.max(SPACING_MIN, this.calcSpacingUnclamped(size));
    }

    private calcOpacity(pressure: number): number {
        return this.settingOpacityPressure
            ? this.opacity * BB.mix(0.05, 1, pressure * pressure)
            : this.opacity;
    }

    private getIsBlending(): boolean {
        return this.blending !== 0 || this.settingBlendingPressure;
    }

    private calcBlending(pressure: number): number {
        // pressure 0 -> full blending, pressure 1 -> chosen blending
        // So with high pressure you apply color. With low pressure you blend.
        return this.settingBlendingPressure ? BB.mix(1, this.blending, pressure) : this.blending;
    }

    /**
     * How much the alpha of a dot of this size needs to be raised, so the spacing clamped to SPACING_MIN
     * results in the same shade as the unclamped spacing would.
     */
    private calcAlphaExponent(size: number): number {
        // Sub-pixel dots already get lower alpha from partial pixel coverage.
        // Limit compensation to the spacing for a 1px diameter dot.
        return Math.max(1, SPACING_MIN / this.calcSpacingUnclamped(Math.max(0.5, size)));
    }

    /**
     * Samples canvas color at x y, and blends it into blendCol.
     * Returns the new color to draw with.
     */
    private sampleColor(x: number, y: number, p: number): TRgba {
        const avgSize = this.settingSizePressure
            ? Math.max(0.5, p * this.size)
            : Math.max(0.5, this.size);
        const avgBounds = this.getDotBounds(x, y, avgSize);
        if (avgBounds) {
            this.copyFromCanvas(avgBounds);
        }
        const average = this.getAverage(x, y, avgSize);

        if (average.a > 0 && this.blendCol.a === 0) {
            this.blendCol.r = average.r;
            this.blendCol.g = average.g;
            this.blendCol.b = average.b;
            this.blendCol.a = average.a;
        } else {
            if (average.a === 0) {
                average.r = this.color.r;
                average.g = this.color.g;
                average.b = this.color.b;
                average.a = 1 - this.calcBlending(p);
            }

            this.blendCol.r = BB.mix(
                this.blendCol.r,
                BB.mix(this.blendCol.r, average.r, this.blendMix),
                average.a,
            );
            this.blendCol.g = BB.mix(
                this.blendCol.g,
                BB.mix(this.blendCol.g, average.g, this.blendMix),
                average.a,
            );
            this.blendCol.b = BB.mix(
                this.blendCol.b,
                BB.mix(this.blendCol.b, average.b, this.blendMix),
                average.a,
            );
            this.blendCol.a = Math.min(1, this.blendCol.a + average.a);
        }
        return { ...this.blendCol };
    }

    private flushDrawBuffer(): void {
        this.copyFromCanvas(this.redrawBounds);
        this.drawBuffer.forEach((item) => {
            this.drawDot(item);
        });
        this.drawBuffer = [];
    }

    /**
     * Continues line to point. Samples the color exactly every BLEND_SAMPLE_DISTANCE along the line, independent of
     * how far apart the points are. Before sampling, the dots so far are drawn.
     */
    private continueLine(point: TPressureInput): void {
        point = { ...point, pressure: clamp(point.pressure, 0, 1) };
        if (this.getIsBlending()) {
            const from = { ...this.lastInput };
            const length = BB.dist(from.x, from.y, point.x, point.y);
            let traveled = 0;
            while (length - traveled >= BLEND_SAMPLE_DISTANCE - this.distSinceSample) {
                traveled += BLEND_SAMPLE_DISTANCE - this.distSinceSample;
                const t = traveled / length;
                const samplePoint = {
                    x: BB.mix(from.x, point.x, t),
                    y: BB.mix(from.y, point.y, t),
                    pressure: BB.mix(from.pressure, point.pressure, t),
                };
                this.drawTo(samplePoint);
                this.flushDrawBuffer();
                this.localColOld = this.localColNew;
                this.localColNew = this.sampleColor(
                    samplePoint.x,
                    samplePoint.y,
                    samplePoint.pressure,
                );
                this.distSinceSample = 0;
            }
        }
        this.drawTo(point);
    }

    /**
     * Pushes dots from lastInput to point into drawBuffer. Color transitions from the previous to the latest sample.
     */
    private drawTo(point: TPressureInput): void {
        const { x, y } = point;
        const p = point.pressure;

        let localPressure;
        let localOpacity;
        let localBlending;
        let localSize = this.settingSizePressure
            ? Math.max(1, p * this.size)
            : Math.max(1, this.size);

        const bDist = this.calcSpacing(localSize);

        if (!this.getIsBlending()) {
            this.mixCol.r = this.color.r;
            this.mixCol.g = this.color.g;
            this.mixCol.b = this.color.b;
        }

        const segmentLength = BB.dist(this.lastInput.x, this.lastInput.y, x, y);
        const segmentStart = this.distSinceSample;

        const dotCallback: TLinearLineCallback = (val) => {
            const factor = val.t;
            localPressure = this.lastInput.pressure * (1 - factor) + p * factor;
            localBlending = this.calcBlending(localPressure);
            if (localBlending >= 1 && this.blendCol.a <= 0) {
                return;
            }
            localOpacity = this.calcOpacity(localPressure);
            localSize = this.settingSizePressure
                ? Math.max(0.1, localPressure * this.size)
                : Math.max(0.1, this.size);
            if (this.getIsBlending()) {
                const colorFactor = Math.min(
                    1,
                    (segmentStart + factor * segmentLength) / BLEND_SAMPLE_DISTANCE,
                );
                this.mixCol.r = BB.mix(this.localColOld.r, this.localColNew.r, colorFactor);
                this.mixCol.g = BB.mix(this.localColOld.g, this.localColNew.g, colorFactor);
                this.mixCol.b = BB.mix(this.localColOld.b, this.localColNew.b, colorFactor);
            }
            if (localBlending === 1 && this.localColOld.a === 0) {
                this.mixCol.r = this.localColNew.r;
                this.mixCol.g = this.localColNew.g;
                this.mixCol.b = this.localColNew.b;
            }
            const bounds = this.getDotBounds(val.x, val.y, localSize);
            if (bounds) {
                this.updateRedrawBounds(bounds);
                this.drawBuffer.push({
                    x: val.x,
                    y: val.y,
                    size: localSize,
                    opacity: localOpacity,
                    alphaExponent: this.calcAlphaExponent(localSize),
                    x1: bounds.x1,
                    y1: bounds.y1,
                    x2: bounds.x2,
                    y2: bounds.y2,
                    r: BB.mix(this.color.r, this.mixCol.r, localBlending),
                    g: BB.mix(this.color.g, this.mixCol.g, localBlending),
                    b: BB.mix(this.color.b, this.mixCol.b, localBlending),
                });
            }
        };

        this.linearLine!.add(x, y, bDist, dotCallback);

        this.distSinceSample += segmentLength;
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
    }

    // ----------------------------------- public -----------------------------------
    constructor() {}

    setHistory(klHistory: KlHistory): void {
        this.klHistory = klHistory;
    }

    getSize(): number {
        return this.size;
    }

    setSize(s: number): void {
        this.size = s;
    }

    getOpacity(): number {
        return this.opacity;
    }

    setOpacity(o: number): void {
        this.opacity = o;
    }

    getBlending(): number {
        return this.blending;
    }

    setBlending(b: number): void {
        this.blending = b;
    }

    setColor(c: TRgb): void {
        this.color = BB.copyObj(c);
    }

    setContext(c: CanvasRenderingContext2D, id: string): void {
        this.context = c;
        this.layerId = id;
    }

    setSizePressure(b: boolean): void {
        this.settingSizePressure = b;
    }

    setOpacityPressure(b: boolean): void {
        this.settingOpacityPressure = b;
    }

    setBlendingPressure(b: boolean): void {
        this.settingBlendingPressure = b;
    }

    getLockAlpha(): boolean {
        return this.settingLockLayerAlpha;
    }

    setLockAlpha(b: boolean): void {
        this.settingLockLayerAlpha = b;
    }

    getIsDrawing(): boolean {
        return this.isDrawing;
    }

    setIsTesting(b: boolean): void {
        this.isTesting = b;
    }

    startLine(x: number, y: number, p: number): void {
        const selection = this.klHistory.getComposed().selection.value;
        this.selectionBounds = selection ? getMultiPolyBounds(selection, 'index') : undefined;
        this.mask = selection
            ? getBinaryMask(selection, this.context.canvas.width, this.context.canvas.height)
            : undefined;
        const totalCells =
            Math.ceil(this.context.canvas.width / HISTORY_TILE_SIZE) *
            Math.ceil(this.context.canvas.height / HISTORY_TILE_SIZE);
        this.cells = createArray(totalCells, undefined);

        this.isDrawing = true;

        p = Math.max(0, Math.min(1, p));
        const localOpacity = this.calcOpacity(p);
        const localBlending = this.calcBlending(p);
        const localSize = this.settingSizePressure
            ? Math.max(0.1, p * this.size)
            : Math.max(0.1, this.size);
        if (!this.getIsBlending()) {
            this.mixCol.r = this.color.r;
            this.mixCol.g = this.color.g;
            this.mixCol.b = this.color.b;
        } else {
            this.copyFromCanvas(this.getDotBounds(x, y, localSize));

            const average = this.getAverage(
                x,
                y,
                this.settingSizePressure ? Math.max(0.1, p * this.size) : Math.max(0.1, this.size),
            );
            if (average.a === 0) {
                this.blendCol = {
                    r: this.color.r,
                    g: this.color.g,
                    b: this.color.b,
                    a: 1 - localBlending,
                };
            } else {
                this.blendCol = {
                    r: average.r,
                    g: average.g,
                    b: average.b,
                    a: average.a,
                };
            }

            this.mixCol.r = this.blendCol.r;
            this.mixCol.g = this.blendCol.g;
            this.mixCol.b = this.blendCol.b;
        }

        this.localColOld = {
            r: this.mixCol.r,
            g: this.mixCol.g,
            b: this.mixCol.b,
            a: this.blendCol.a,
        };
        this.localColNew = { ...this.localColOld };
        this.distSinceSample = 0;

        this.redrawBounds = undefined;
        this.drawBuffer = [];

        if (localBlending < 1 || this.blendCol.a > 0) {
            const bounds = this.getDotBounds(x, y, localSize);
            if (bounds) {
                this.updateRedrawBounds(bounds);
                this.drawBuffer.push({
                    x: x,
                    y: y,
                    size: localSize,
                    opacity: localOpacity,
                    alphaExponent: this.calcAlphaExponent(localSize),
                    x1: bounds.x1,
                    y1: bounds.y1,
                    x2: bounds.x2,
                    y2: bounds.y2,
                    r: BB.mix(this.color.r, this.mixCol.r, localBlending),
                    g: BB.mix(this.color.g, this.mixCol.g, localBlending),
                    b: BB.mix(this.color.b, this.mixCol.b, localBlending),
                });
            }
        }

        this.flushDrawBuffer();

        this.linearLine = new LinearLine({ x, y });

        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;

        if (!this.isTesting) {
            this.drawChangedCells();
        }
    }

    goLine(points: TPressureInput[]): void {
        if (!this.isDrawing) {
            return;
        }
        points.forEach((point) => this.continueLine(point));
        this.flushDrawBuffer();

        if (!this.isTesting) {
            this.drawChangedCells();
        }
    }

    endLine(): void {
        this.isDrawing = false;
        this.linearLine = undefined;

        this.drawChangedCells();

        if (this.cells.some((item) => item)) {
            let cells = this.cells;
            if (this.selectionBounds) {
                const tilesInSelection = getChangedTiles(
                    this.selectionBounds,
                    this.context.canvas.width,
                    this.context.canvas.height,
                );
                cells = cells.map((cell, index) => {
                    return tilesInSelection[index] ? cell : undefined;
                });
            }

            this.klHistory.push(
                getPushableLayerChange(
                    this.klHistory.getComposed(),
                    cells.map((cell) => {
                        return cell ? createImageDataTile(cell) : undefined;
                    }),
                ),
            );
        }
        this.cells = [];
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        this.startLine(x1, y1, 1);
        this.goLine([{ x: x2, y: y2, pressure: 1 }]);
        this.endLine();
    }
}
