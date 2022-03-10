import {BB} from '../../bb/bb';
import {IRGB, IRGBA} from '../kl.types';
import {IBounds, IPressureInput} from '../../bb/bb.types';
import {IHistoryEntry, KlHistoryInterface} from '../history/kl-history';

const cellSize = 256;

interface IDrawBufferItem {
    x: number;
    y: number;
    size: number;
    opacity: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    r: number;
    g: number;
    b: number;
}

// faster than using BB.clamp somehow (in chrome)
function clamp(num, min, max) {
    return num <= min
        ? min
        : num >= max
            ? max
            : num
}

export class BlendBrush {

    private isTesting: boolean = false; // testing mode - context only gets updated when line is finished

    private context: CanvasRenderingContext2D;
    private color: IRGB;
    private size: number = 29; // radius - 0.5 - 99999
    private opacity: number = 0.6; // 0-1
    private blending: number = 0.65; // 0-1

    private settingLockLayerAlpha: boolean = false;
    private settingSizePressure: boolean = true;
    private settingOpacityPressure: boolean = false;

    private blendCol: IRGBA = {r: 0, g: 0, b: 0, a: 1}; // todo docs
    private blendMix: number = 0.45; // todo docs
    private mixr: number; // todo docs
    private mixg: number; // todo docs
    private mixb: number; // todo docs
    private localColOld: IRGBA; // todo docs

    private isDrawing: boolean = false;
    private lastInput: IPressureInput = {x: 0, y: 0, pressure: 0}; // todo docs
    private lastInput2: IPressureInput = {x: 0, y: 0, pressure: 0}; // todo docs
    private bezierLine: any; // todo type

    private history: KlHistoryInterface | null;
    private historyEntry: IHistoryEntry;
    private redrawBounds: IBounds;
    private cells: (ImageData | null)[];
    private drawBuffer: IDrawBufferItem[];

    private updateRedrawBounds (bounds: IBounds): void {
        this.redrawBounds = BB.updateBounds(this.redrawBounds, bounds);
    }

    private getCellsWidth(): number {
        return Math.ceil(this.context.canvas.width / cellSize);
    }

    /**
     * draw changed cells (changed by brushstroke) onto context
     * @private
     */
    private drawChangedCells(): void {
        const cells = this.cells.map(item => null);
        const touchedCells = this.getTouchedCells(this.redrawBounds);
        touchedCells.forEach((isTouched, index) => {
            if (isTouched) {
                cells[index] = this.cells[index];
            }
        });
        this.drawCells(cells);
        this.redrawBounds = null;
    }

    private getTouchedCells(bounds: IBounds): boolean[] {
        const touchedCells = this.cells.map(item => false);
        const cellsW = this.getCellsWidth();
        bounds = {
            x1: Math.floor(bounds.x1 / cellSize),
            y1: Math.floor(bounds.y1 / cellSize),
            x2: Math.floor(bounds.x2 / cellSize),
            y2: Math.floor(bounds.y2 / cellSize),
        };
        for (let i = bounds.x1; i <= bounds.x2; i++) {
            for (let e = bounds.y1; e <= bounds.y2; e++) {
                touchedCells[e * cellsW + i] = true;
            }
        }
        return touchedCells;
    }

    /**
     * Slice up bounds accordings to cells
     * @param bounds
     * @private
     */
    private sliceBounds(bounds: IBounds): {index: number; bounds: IBounds}[] {
        const cellsW = this.getCellsWidth();
        const result: {index: number; bounds: IBounds}[] = [];
        const touchedCells = this.getTouchedCells(bounds);

        touchedCells.forEach((cell, i) => {
            if (!cell) {
                return;
            }

            const cellOffsetX = (i % cellsW) * cellSize;
            const cellOffsetY = Math.floor(i / cellsW) * cellSize;
            const cellWidth = this.cells[i].width;
            const cellHeight = this.cells[i].height;

            const inCellBounds = {
                x1: Math.max(0, bounds.x1 - cellOffsetX),
                y1: Math.max(0, bounds.y1 - cellOffsetY),
                x2: Math.min(cellWidth - 1, bounds.x2 - cellOffsetX),
                y2: Math.min(cellHeight - 1, bounds.y2 - cellOffsetY),
            }
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
    private copyFromCanvas(bounds: IBounds) {
        if (!bounds) {
            return;
        }

        const touchedCells = this.getTouchedCells(bounds);
        const cellsW = this.getCellsWidth();

        touchedCells.forEach((item, i) => {
            if (!item || this.cells[i]) {
                // not touched, or already copied
                return;
            }
            const x = i % cellsW;
            const y = Math.floor(i / cellsW);
            const w = (Math.min(x * cellSize + cellSize, this.context.canvas.width) - 1) % cellSize + 1;
            const h = (Math.min(y * cellSize + cellSize, this.context.canvas.height) - 1) % cellSize + 1;

            // temp canvas to prevent main canvas from getting slowed down in chrome
            const tmpCanvas = BB.canvas(w, h);
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(this.context.canvas, -x * cellSize, -y * cellSize);

            this.cells[i] = tmpCtx.getImageData(0, 0, w, h);
        });
    }

    private getAverage (x, y, size): IRGBA {

        size = Math.max(0.5, size * 0.75);
        const x1 = Math.max(0, Math.floor(x - size));
        const y1 = Math.max(0, Math.floor(y - size));
        const x2 = Math.min(this.context.canvas.width - 1, Math.ceil(x + size));
        const y2 = Math.min(this.context.canvas.height - 1, Math.ceil(y + size));
        if (x1 > x2 || y1 > y2) {
            return {
                r: 0,
                g: 0,
                b: 0,
                a: 0,
            };
        }

        let ar = 0, ag = 0, ab = 0, aa = 0, alpha;

        const slicedBounds = this.sliceBounds({ x1, y1, x2, y2 });
        slicedBounds.forEach(slice => {
            const width = this.cells[slice.index].width;
            const data = this.cells[slice.index].data;
            const bounds = slice.bounds;

            for (let i = bounds.y1; i <= bounds.y2; i += 4) {
                for (let e = bounds.x1, e2 = i * width * 4 + bounds.x1 * 4; e <= bounds.x2; e += 4, e2 += 4 * 4) {
                    alpha = data[e2 + 3];
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
        return {
            r: ar,
            g: ag,
            b: ab,
            a: aa
        };
    }

    private prepDot (x: number, y: number, size: number): IBounds {
        size = Math.max(0.5, size);
        let x1 = Math.max(0, Math.floor(x - size));
        let y1 = Math.max(0, Math.floor(y - size));
        let x2 = Math.min(this.context.canvas.width - 1, Math.ceil(x + size));
        let y2 = Math.min(this.context.canvas.height - 1, Math.ceil(y + size));
        if (x1 > x2 || y1 > y2) {
            return null;
        }
        return { x1, y1, x2, y2 };
    }

    private drawDot (params: IDrawBufferItem): void {
        // array with random numbers. faster than Math.random()
        let randI = 0;
        const randLen = params.size > 30 ? 1024 : 512; // lower lengths lead to noticeable patterns
        const randArr = [];
        for (let i = 0; i < randLen; i++) {
            randArr[i] = (Math.random() - 0.5) / 1.001 + 0.5;
        }

        // thin lines take more than just 1 sample
        const sampleArr = [8,4,4,4,2,2,2,2,2,2]; // <0.5, 0.5, 1, 1.5, etc.
        const samples = sampleArr[Math.floor(params.size * 2)];
        const samplesSquared: number = samples ? samples * samples : 0;
        const sampleOffsets = [];
        if (samples) {
            let i = 0;
            for (let n = 0; n < samples; n++) {
                for (let m = 0; m < samples; m++, i += 2) {
                    sampleOffsets[i] = (n + 1) / samples; // x offset
                    sampleOffsets[i + 1] = (m + 1) / samples; // y offset
                }
            }
        }

        const sharpness = Math.pow(params.opacity, 2) * 0.8;
        // to optimize calculations
        const invSharpness = 1 - sharpness;
        const sharpnessSubtrahend = sharpness / invSharpness;
        const sizeSquared = params.size * params.size;
        const distDivisor = sizeSquared * invSharpness / params.opacity;
        const alphaMinuend = (1 + sharpnessSubtrahend) * params.opacity;


        const slicedBounds = this.sliceBounds({
            x1: params.x1,
            y1: params.y1,
            x2: params.x2,
            y2: params.y2,
        });

        const cellsW = this.getCellsWidth();
        slicedBounds.forEach(slice => {
            const cellOffsetX = (slice.index % cellsW) * cellSize;
            const cellOffsetY = Math.floor(slice.index / cellsW) * cellSize;
            const cellWidth = this.cells[slice.index].width;
            const data = this.cells[slice.index].data;

            // i - y index within cell
            // e - x index within cell

            // e2 - index in image data

            // ri - y index within image relative to dot-center
            // re - x index within image relative to dot-center

            for (let i = slice.bounds.y1, ri = i + cellOffsetY - params.y; i <= slice.bounds.y2; i++, ri++) {
                for (
                    let e = slice.bounds.x1,
                        e2 = i * cellWidth * 4 + slice.bounds.x1 * 4,
                        re = e + cellOffsetX - params.x;
                    e <= slice.bounds.x2;
                    e++,
                        e2 += 4,
                        re++
                ) {
                    // O = over -> brush-dot
                    // U = under -> image

                    let alphaO = 0;
                    if (samplesSquared) {
                        for (let f = 0; f < sampleOffsets.length; f += 2) {
                            const dist = BB.lenSquared(re + sampleOffsets[f], ri + sampleOffsets[f + 1]);
                            if (dist >= sizeSquared) {
                                continue;
                            }
                            alphaO += clamp(alphaMinuend - dist / distDivisor, 0, params.opacity);
                        }
                        if (!alphaO) {
                            continue;
                        }
                        alphaO /= samplesSquared;
                    } else {
                        // technically needs + 0.5 offset, but not noticeable with large brush
                        const dist = Math.pow(re, 2) + Math.pow(ri, 2);
                        if (dist >= sizeSquared) {
                            continue;
                        }
                        alphaO = clamp(alphaMinuend - dist / distDivisor, 0, params.opacity);
                    }

                    const invAlphaO = 1 - alphaO;
                    const alphaU =data[e2 + 3] / 255;

                    if (this.settingLockLayerAlpha) {
                        const underR = (params.r * alphaO) + ((data[e2]) * invAlphaO);
                        const underG = (params.g * alphaO) + ((data[e2 + 1]) * invAlphaO);
                        const underB = (params.b * alphaO) + ((data[e2 + 2]) * invAlphaO);
                        if (alphaU) {
                            data[e2] = Math.floor(underR + randArr[randI]);
                            data[e2 + 1] = Math.floor(underG + randArr[randI]);
                            data[e2 + 2] = Math.floor(underB + randArr[randI]);
                        }
                    } else {
                        const underR = (params.r * alphaO) + ((data[e2] * alphaU) * invAlphaO);
                        const underG = (params.g * alphaO) + ((data[e2 + 1] * alphaU) * invAlphaO);
                        const underB = (params.b * alphaO) + ((data[e2 + 2] * alphaU) * invAlphaO);

                        let newAlpha = 1 - invAlphaO * (1 - alphaU);
                        data[e2 + 3] = Math.floor(Math.min(255, newAlpha * 255) + 0.5);
                        if (newAlpha) {
                            data[e2] = Math.floor(underR / (newAlpha) + randArr[randI]);
                            data[e2 + 1] = Math.floor(underG / (newAlpha) + randArr[randI]);
                            data[e2 + 2] = Math.floor(underB / (newAlpha) + randArr[randI]);
                        }
                    }
                    randI = (randI + 1) % randLen;

                }
            }

        });
    }

    private calcSpacing (size: number): number {
        return BB.mix(
            (size * 2) / 2, // until size 5.3
            (size * 2) / 9, // at size 24
            BB.clamp((size - 2.7) / (12 - 2.7), 0, 1)
        );
    }

    private continueLine (x: number, y: number, p: number, isCoalesced: boolean): void {

        this.drawBuffer = [];

        let localPressure;
        let localOpacity;
        let localSize = (this.settingSizePressure) ? Math.max(1, p * this.size) : Math.max(1, this.size);

        let bdist = this.calcSpacing(localSize);

        let avgX = x;
        let avgY = y;
        if (x === null) {
            avgX = this.lastInput.x;
            avgY = this.lastInput.y;
        }

        let localColNew;

        if (this.blending === 0) {
            this.mixr = this.color.r;
            this.mixg = this.color.g;
            this.mixb = this.color.b;
        } else {
            let average;
            if (isCoalesced) {
                average = {r: this.localColOld.r, g: this.localColOld.g, b: this.localColOld.b, a: 0};
            } else {
                const avgParams = [avgX, avgY, ((this.settingSizePressure) ? Math.max(0.5, p * this.size) : Math.max(0.5, this.size))];
                const bounds = this.prepDot(avgParams[0], avgParams[1], avgParams[2]);
                this.copyFromCanvas(bounds);
                average = this.getAverage(avgParams[0], avgParams[1], avgParams[2]);
            }
            localColNew = {r: 0, g: 0, b: 0, a: 0};

            if (average.a > 0 && this.blendCol.a === 0) {
                this.blendCol.r = average.r;
                this.blendCol.g = average.g;
                this.blendCol.b = average.b;
                this.blendCol.a = average.a;
                localColNew.r = this.blendCol.r;
                localColNew.g = this.blendCol.g;
                localColNew.b = this.blendCol.b;
                localColNew.a = this.blendCol.a;

            } else {
                if (average.a === 0) {
                    average.r = this.color.r;
                    average.g = this.color.g;
                    average.b = this.color.b;
                    average.a = 1 - this.blending;
                }

                this.blendCol.r = BB.mix(this.blendCol.r, BB.mix(this.blendCol.r, average.r, this.blendMix), average.a);
                this.blendCol.g = BB.mix(this.blendCol.g, BB.mix(this.blendCol.g, average.g, this.blendMix), average.a);
                this.blendCol.b = BB.mix(this.blendCol.b, BB.mix(this.blendCol.b, average.b, this.blendMix), average.a);
                this.blendCol.a = Math.min(1, this.blendCol.a + average.a);
                localColNew.r = this.blendCol.r;
                localColNew.g = this.blendCol.g;
                localColNew.b = this.blendCol.b;
                localColNew.a = this.blendCol.a;
            }

        }


        const bezierCallback = (val) => {
            if (this.blending >= 1 && this.blendCol.a <= 0) {
                return;
            }
            let factor = val.t;
            localPressure = this.lastInput2.pressure * (1 - factor) + p * factor;
            localOpacity = (this.settingOpacityPressure) ? (this.opacity * localPressure * localPressure) : this.opacity;
            localSize = (this.settingSizePressure) ? Math.max(0.1, localPressure * this.size) : Math.max(0.1, this.size);
            if (this.blending != 0) {
                this.mixr = BB.mix(this.localColOld.r, localColNew.r, factor);
                this.mixg = BB.mix(this.localColOld.g, localColNew.g, factor);
                this.mixb = BB.mix(this.localColOld.b, localColNew.b, factor);
            }
            if (this.blending === 1 && this.localColOld.a === 0) {
                this.mixr = localColNew.r;
                this.mixg = localColNew.g;
                this.mixb = localColNew.b;
            }
            const bounds = this.prepDot(val.x, val.y, localSize);
            if (bounds) {
                this.updateRedrawBounds(bounds);
                this.drawBuffer.push({
                    x: val.x,
                    y: val.y,
                    size: localSize,
                    opacity: localOpacity,
                    x1: bounds.x1,
                    y1: bounds.y1,
                    x2: bounds.x2,
                    y2: bounds.y2,
                    r: BB.mix(this.color.r, this.mixr, this.blending),
                    g: BB.mix(this.color.g, this.mixg, this.blending),
                    b: BB.mix(this.color.b, this.mixb, this.blending),
                })
            }
        };

        if (x === null) {
            this.bezierLine.addFinal(bdist, bezierCallback);
        } else {
            this.bezierLine.add(x, y, bdist, bezierCallback);
        }

        this.copyFromCanvas(this.redrawBounds);
        this.drawBuffer.forEach(item => {
            this.drawDot(item);
        });
        this.drawBuffer = [];

        this.localColOld = localColNew;
    }





    // --- public ----
    constructor () {
    }

    setHistory (h: KlHistoryInterface): void {
        this.history = h;
    }

    getSize (): number {
        return this.size;
    }

    setSize (s: number): void {
        this.size = s;
    }

    getOpacity (): number {
        return this.opacity;
    }

    setOpacity (o: number): void {
        this.opacity = o;
    }

    getBlending (): number {
        return this.blending;
    }

    setBlending (b: number) {
        this.blending = b;
    }

    setColor (c: IRGB): void {
        this.color = BB.copyObj(c);
    }

    setContext (c: CanvasRenderingContext2D) {
        this.context = c;
    }

    setSizePressure (b: boolean): void {
        this.settingSizePressure = !!b;
    }

    setOpacityPressure (b: boolean): void {
        this.settingOpacityPressure = !!b;
    }

    getLockAlpha (): boolean {
        return this.settingLockLayerAlpha;
    }

    setLockAlpha (b: boolean): void {
        this.settingLockLayerAlpha = !!b;
    }

    getIsDrawing (): boolean {
        return this.isDrawing;
    }

    setIsTesting (b: boolean): void {
        this.isTesting = !!b;
    }

    startLine (x: number, y: number, p: number): void {
        this.historyEntry = {
            tool: ["brush", "BlendBrush"],
            actions: []
        };


        const totalCells = Math.ceil(this.context.canvas.width / cellSize) * Math.ceil(this.context.canvas.height / cellSize);
        this.cells = '0'.repeat(totalCells).split('').map(item => null);

        this.isDrawing = true;

        p = Math.max(0, Math.min(1, p));
        let localOpacity = (this.settingOpacityPressure) ? (this.opacity * p * p) : this.opacity;
        let localSize = (this.settingSizePressure) ? Math.max(0.1, p * this.size) : Math.max(0.1, this.size);
        if (this.blending === 0) {
            this.mixr = this.color.r;
            this.mixg = this.color.g;
            this.mixb = this.color.b;
        } else {
            this.copyFromCanvas(this.prepDot(x, y, localSize));

            let average = this.getAverage(
                x,
                y,
                ((this.settingSizePressure) ? Math.max(0.1, p * this.size) : Math.max(0.1, this.size))
            );
            if (average.a === 0) {
                this.blendCol = {
                    r: this.color.r,
                    g: this.color.g,
                    b: this.color.b,
                    a: 1 - this.blending,
                };
            } else {
                this.blendCol = {
                    r: average.r,
                    g: average.g,
                    b: average.b,
                    a: average.a,
                };
            }

            this.mixr = this.blendCol.r;
            this.mixg = this.blendCol.g;
            this.mixb = this.blendCol.b;
        }

        this.localColOld = {r: this.mixr, g: this.mixg, b: this.mixb, a: this.blendCol.a};

        this.redrawBounds = null;
        this.drawBuffer = [];

        if (this.blending < 1 || this.blendCol.a > 0) {
            const bounds = this.prepDot(x, y, localSize);
            if (bounds) {
                this.updateRedrawBounds(bounds);
                this.drawBuffer.push({
                    x: x,
                    y: y,
                    size: localSize,
                    opacity: localOpacity,
                    x1: bounds.x1,
                    y1: bounds.y1,
                    x2: bounds.x2,
                    y2: bounds.y2,
                    r: BB.mix(this.color.r, this.mixr, this.blending),
                    g: BB.mix(this.color.g, this.mixg, this.blending),
                    b: BB.mix(this.color.b, this.mixb, this.blending),
                })
            }
        }

        this.copyFromCanvas(this.redrawBounds);
        this.drawBuffer.forEach(item => {
            this.drawDot(item);
        });
        this.drawBuffer = [];

        this.bezierLine = new BB.BezierLine();
        this.bezierLine.add(x, y, 0, function () {
        });

        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
        this.lastInput2 = BB.copyObj(this.lastInput);

        if (this.redrawBounds && !this.isTesting) {
            this.drawChangedCells();
        }
    }

    goLine (x: number, y: number, p: number, isCoalesced: boolean): void {
        if (!this.isDrawing) {
            return;
        }
        this.continueLine(x, y, this.lastInput.pressure, isCoalesced);

        this.lastInput2 = BB.copyObj(this.lastInput);
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;

        if (this.redrawBounds && !this.isTesting) {
            this.drawChangedCells();
        }
    }

    endLine (): void {
        if (this.bezierLine) {
            this.continueLine(null, null, this.lastInput.pressure, false);
        }

        this.isDrawing = false;
        this.bezierLine = null;

        if (this.redrawBounds) {
            this.drawChangedCells();
        }

        if (this.historyEntry && this.history && this.cells.find(item => !!item)) {
            this.historyEntry.actions.push({
                action: "drawCells",
                params: [this.cells],
            });
            this.history.push(this.historyEntry);
            this.historyEntry = null;
        }
        this.cells = null;
    }

    /**
     * draw cells onto context
     * @param cells
     */
    drawCells (cells: (ImageData | null)[]): void {
        const cellsW = this.getCellsWidth();
        cells.forEach((imageData, index) => {
            if (!imageData) {
                return;
            }
            const cellOffsetX = (index % cellsW) * cellSize;
            const cellOffsetY = Math.floor(index / cellsW) * cellSize;
            this.context.putImageData(imageData, cellOffsetX, cellOffsetY);
        });
    }

    drawLineSegment (x1: number, y1: number, x2: number, y2: number): void {
        this.lastInput.x = x2;
        this.lastInput.y = y2;

        if (this.isDrawing || x1 === undefined) {
            return;
        }

        const totalCells = Math.ceil(this.context.canvas.width / cellSize) * Math.ceil(this.context.canvas.height / cellSize);
        this.cells = '0'.repeat(totalCells).split('').map(item => null);
        this.redrawBounds = null;
        this.drawBuffer = [];

        this.copyFromCanvas(this.prepDot(x1, y1, Math.max(0.1, this.size)));
        let average = this.getAverage(x1, y1, Math.max(0.1, this.size));

        if (average.a === 0) {
            this.blendCol = {
                r: this.color.r,
                g: this.color.g,
                b: this.color.b,
                a: 1 - this.blending,
            };
        } else {
            this.blendCol = {
                r: average.r,
                g: average.g,
                b: average.b,
                a: average.a,
            };
        }

        this.mixr = this.color.r * (1 - this.blendCol.a) + (this.blending * this.blendCol.r + this.color.r * (1 - this.blending)) * this.blendCol.a;
        this.mixg = this.color.g * (1 - this.blendCol.a) + (this.blending * this.blendCol.g + this.color.g * (1 - this.blending)) * this.blendCol.a;
        this.mixb = this.color.b * (1 - this.blendCol.a) + (this.blending * this.blendCol.b + this.color.b * (1 - this.blending)) * this.blendCol.a;


        const p = 1;
        const localOpacity = (this.settingOpacityPressure) ? (this.opacity * p * p) : this.opacity;
        const localSize = (this.settingSizePressure) ? Math.max(0.1, p * this.size) : Math.max(0.1, this.size);


        const mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
        const eX = (x2 - x1) / mouseDist;
        const eY = (y2 - y1) / mouseDist;
        const bdist = this.calcSpacing(localSize);
        for (let loopDist = 0; loopDist <= mouseDist; loopDist += bdist) {
            const bounds = this.prepDot(x1 + eX * loopDist, y1 + eY * loopDist, localSize);
            if (bounds) {
                this.copyFromCanvas(bounds);
                this.drawBuffer.push({
                    x: x1 + eX * loopDist,
                    y: y1 + eY * loopDist,
                    size: localSize,
                    opacity: localOpacity,
                    x1: bounds.x1,
                    y1: bounds.y1,
                    x2: bounds.x2,
                    y2: bounds.y2,
                    r: BB.mix(this.color.r, this.mixr, this.blending),
                    g: BB.mix(this.color.g, this.mixg, this.blending),
                    b: BB.mix(this.color.b, this.mixb, this.blending),
                })
            }
        }
        this.drawBuffer.forEach(item => {
            this.drawDot(item);
        });
        this.drawBuffer = [];

        if (this.history && this.cells.find(item => !!item)) {
            this.drawCells(this.cells);
            this.historyEntry = {
                tool: ["brush", "BlendBrush"],
                actions: [{
                    action: "drawCells",
                    params: [this.cells],
                }],
            };
            this.history.push(this.historyEntry);
            this.historyEntry = null;
        }
        this.cells = null;
    }
}
