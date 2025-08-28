import { BB } from '../../bb/bb';
import { TPressureInput, TRgb } from '../kl-types';
import { TBounds, TRect, TVector2D } from '../../bb/bb-types';
import { BezierLine } from '../../bb/math/line';
import { ERASE_COLOR } from './erase-color';
import { throwIfNull } from '../../bb/base/base';
import { KlHistory } from '../history/kl-history';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { getChangedTiles, updateChangedTiles } from '../history/push-helpers/changed-tiles';
import { canvasAndChangedTilesToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { boundsOverlap, boundsToRect, integerBounds, updateBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';

export class PixelBrush {
    private klHistory: KlHistory = {} as KlHistory;
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private settingHasSizePressure: boolean = true;
    private settingHasOpacityPressure: boolean = false;
    private settingSize: number = 0.5;
    private settingSpacing: number = 0.9;
    private settingOpacity: number = 1;
    private settingColor: TRgb = {} as TRgb;
    private settingColorStr: string = '';
    private settingLockLayerAlpha: boolean = false;
    private settingIsEraser: boolean = false;
    private settingUseDither: boolean = true;
    private inputIsDrawing: boolean = false;
    private lineToolLastDot: number = 0;
    private lastInput: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private lastInput2: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private bezierLine: BezierLine | null = null;
    private readonly ditherArr: [number, number][] = [
        [3, 2],
        [1, 0],
        [3, 0],
        [1, 2],
        [2, 1],
        [0, 3],
        [0, 1],
        [2, 3],

        [2, 0],
        [0, 2],
        [0, 0],
        [2, 2],
        [1, 1],
        [3, 3],
        [3, 1],
        [1, 3],
    ];
    private readonly ditherCanvas: HTMLCanvasElement;
    private readonly ditherCtx: CanvasRenderingContext2D;
    private ditherPattern: CanvasPattern = {} as CanvasPattern;

    /*
        Draw brush into fresh canvas for each line,
        because otherwise chrome slows the main canvas down.
        Multiple reads on a canvas -> canvas moved to CPU. (my guess)
     */
    private canvasClone: HTMLCanvasElement = {} as HTMLCanvasElement;
    private ctxClone: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;

    // area that changed since last redraw
    private redrawBounds: TBounds | undefined;
    // changed tiles that will be pushed to history
    private historyTiles: boolean[] = [];

    private bresenheimPath: Path2D | undefined;

    private selection: MultiPolygon | undefined;
    private selectionPath: Path2D | undefined;
    private selectionBounds: TBounds | undefined;

    private updateChangedTiles(bounds: TBounds) {
        // fix bounds
        bounds = {
            x1: Math.min(bounds.x1, bounds.x2),
            y1: Math.min(bounds.y1, bounds.y2),
            x2: Math.max(bounds.x1, bounds.x2),
            y2: Math.max(bounds.y1, bounds.y2),
        };
        const boundsWithinSelection = boundsOverlap(bounds, this.selectionBounds);
        if (!boundsWithinSelection) {
            return;
        }
        const changedTiles = getChangedTiles(
            boundsWithinSelection,
            this.context.canvas.width,
            this.context.canvas.height,
        );
        this.redrawBounds = this.redrawBounds
            ? updateBounds(this.redrawBounds, boundsWithinSelection)
            : boundsWithinSelection;
        this.historyTiles = updateChangedTiles(this.historyTiles, changedTiles);
    }

    private initClone(): void {
        this.canvasClone = BB.canvas(this.context.canvas.width, this.context.canvas.height);
        this.ctxClone = BB.ctx(this.canvasClone);
        this.ctxClone.drawImage(this.context.canvas, 0, 0);
    }

    private freeClone(): void {
        BB.freeCanvas(this.canvasClone);
        this.ctxClone = {} as CanvasRenderingContext2D;
    }

    private redrawToCanvas(): void {
        if (!this.redrawBounds) {
            return;
        }
        const boundsRect = boundsToRect(this.redrawBounds, true);
        this.context.save();
        this.context.clearRect(boundsRect.x, boundsRect.y, boundsRect.width, boundsRect.height);
        this.context.drawImage(
            this.canvasClone,
            boundsRect.x,
            boundsRect.y,
            boundsRect.width,
            boundsRect.height,
            boundsRect.x,
            boundsRect.y,
            boundsRect.width,
            boundsRect.height,
        );
        this.context.restore();
        this.redrawBounds = undefined;
    }

    private updateDither(): void {
        this.ditherCtx.clearRect(0, 0, 4, 4);
        this.ditherCtx.fillStyle = this.settingIsEraser
            ? `rgb(${ERASE_COLOR},${ERASE_COLOR},${ERASE_COLOR})`
            : this.settingColorStr;
        for (
            let i = 0;
            i < Math.max(1, Math.round(this.settingOpacity * this.ditherArr.length));
            i++
        ) {
            this.ditherCtx.fillRect(this.ditherArr[i][0], this.ditherArr[i][1], 1, 1);
        }
        this.ditherPattern = throwIfNull(this.context.createPattern(this.ditherCanvas, 'repeat'));
    }

    /**
     * Tests p1->p2 or p3->p4 deviate in their direction more than max, compared to p1->p4
     */
    private cubicCurveOverThreshold(
        p1: TVector2D,
        p2: TVector2D,
        p3: TVector2D,
        p4: TVector2D,
        maxAngleRad: number,
    ): boolean {
        const d = BB.Vec2.nor({
            x: p4.x - p1.x,
            y: p4.y - p1.y,
        });
        const d2 = BB.Vec2.nor({
            x: p2.x - p1.x,
            y: p2.y - p1.y,
        });
        const d3 = BB.Vec2.nor({
            x: p4.x - p3.x,
            y: p4.y - p3.y,
        });
        // const a2 = Math.abs(BB.Vec2.angle(d, d2) % Math.PI) / Math.PI * 180;
        // const a3 = Math.abs(BB.Vec2.angle(d, d3) % Math.PI) / Math.PI * 180;

        return Math.max(BB.Vec2.dist(d, d2), BB.Vec2.dist(d, d3)) > maxAngleRad;
    }

    private plotCubicBezierLine(p1: TVector2D, p2: TVector2D, p3: TVector2D, p4: TVector2D): void {
        const isOverThreshold = this.cubicCurveOverThreshold(p1, p2, p3, p4, 0.1);

        p1.x = Math.floor(p1.x);
        p1.y = Math.floor(p1.y);
        p4.x = Math.floor(p4.x);
        p4.y = Math.floor(p4.y);

        const dist = BB.dist(p1.x, p1.y, p4.x, p4.y);
        if (!isOverThreshold || dist < 7) {
            this.updateChangedTiles({
                x1: p1.x,
                y1: p1.y,
                x2: p4.x,
                y2: p4.y,
            });
            this.plotLine(p1.x, p1.y, p4.x, p4.y, true);
            return;
        }

        const n = Math.max(2, Math.round(dist / 4));
        const pointArr = [];
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const a = Math.pow(1 - t, 3);
            const b = 3 * t * Math.pow(1 - t, 2);
            const c = 3 * Math.pow(t, 2) * (1 - t);
            const d = Math.pow(t, 3);
            pointArr.push({
                x: a * p1.x + b * p2.x + c * p3.x + d * p4.x,
                y: a * p1.y + b * p2.y + c * p3.y + d * p4.y,
            });
        }

        for (let i = 0; i < n; i++) {
            this.updateChangedTiles({
                x1: Math.round(pointArr[i].x),
                y1: Math.round(pointArr[i].y),
                x2: Math.round(pointArr[i + 1].x),
                y2: Math.round(pointArr[i + 1].y),
            });
            this.plotLine(
                Math.round(pointArr[i].x),
                Math.round(pointArr[i].y),
                Math.round(pointArr[i + 1].x),
                Math.round(pointArr[i + 1].y),
                true,
            );
        }
    }

    private drawDot(x: number, y: number, size: number, opacity: number): void {
        const rect: TRect = {
            x: Math.round(x + -size),
            y: Math.round(y + -size),
            width: Math.round(size * 2),
            height: Math.round(size * 2),
        };
        this.updateChangedTiles({
            x1: rect.x,
            y1: rect.y,
            x2: rect.x + rect.width,
            y2: rect.y + rect.height,
        });

        this.ctxClone.save();
        if (this.settingIsEraser) {
            this.ctxClone.fillStyle = this.settingUseDither ? this.ditherPattern : '#fff';
            if (this.settingLockLayerAlpha) {
                this.ctxClone.globalCompositeOperation = 'source-atop';
            } else {
                this.ctxClone.globalCompositeOperation = 'destination-out';
            }
        } else {
            this.ctxClone.fillStyle = this.settingUseDither
                ? this.ditherPattern
                : this.settingColorStr;
            if (this.settingLockLayerAlpha) {
                this.ctxClone.globalCompositeOperation = 'source-atop';
            }
        }
        this.ctxClone.globalAlpha = this.settingUseDither ? 1 : opacity;

        this.ctxClone.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctxClone.restore();
    }

    private continueLine(x: number | null, y: number | null, size: number, pressure: number): void {
        if (this.bezierLine === null) {
            this.bezierLine = new BB.BezierLine();
            this.bezierLine.add(this.lastInput.x, this.lastInput.y, 0, () => {});
        }

        this.ctxClone.save();
        this.selectionPath && this.ctxClone.clip(this.selectionPath);

        const dotCallback = (val: {
            x: number;
            y: number;
            t: number;
            angle?: number;
            dAngle: number;
        }): void => {
            const localPressure = BB.mix(this.lastInput2.pressure, pressure, val.t);
            const localOpacity =
                this.settingOpacity *
                (this.settingHasOpacityPressure ? localPressure * localPressure : 1);
            const localSize = Math.max(
                0.5,
                this.settingSize * (this.settingHasSizePressure ? localPressure : 1),
            );
            this.drawDot(val.x, val.y, localSize, localOpacity);
        };

        const controlCallback = (controlObj: {
            p1: TVector2D;
            p2: TVector2D;
            p3: TVector2D;
            p4: TVector2D;
        }): void => {
            this.plotCubicBezierLine(controlObj.p1, controlObj.p2, controlObj.p3, controlObj.p4);
        };

        if (Math.round(this.settingSize * 2) === 1) {
            this.bresenheimPath = new Path2D();
            if (x === null || y === null) {
                this.bezierLine.addFinal(4, undefined, controlCallback);
            } else {
                this.bezierLine.add(x, y, 4, undefined, controlCallback);
            }
            if (this.settingIsEraser) {
                this.ctxClone.fillStyle = this.settingUseDither ? this.ditherPattern : '#fff';
                if (this.settingLockLayerAlpha) {
                    this.ctxClone.globalCompositeOperation = 'source-atop';
                } else {
                    this.ctxClone.globalCompositeOperation = 'destination-out';
                }
            } else {
                this.ctxClone.fillStyle = this.settingUseDither
                    ? this.ditherPattern
                    : this.settingColorStr;
                if (this.settingLockLayerAlpha) {
                    this.ctxClone.globalCompositeOperation = 'source-atop';
                }
            }
            this.ctxClone.globalAlpha = this.settingUseDither ? 1 : this.settingOpacity;
            this.ctxClone.fill(this.bresenheimPath!);
            this.bresenheimPath = undefined;
        } else {
            const localSpacing = size * this.settingSpacing;

            if (x === null || y === null) {
                this.bezierLine.addFinal(localSpacing, dotCallback);
            } else {
                this.bezierLine.add(x, y, localSpacing, dotCallback);
            }
        }

        this.ctxClone.restore();
    }

    /**
     * bresenheim line drawing
     */
    private plotLine(x0: number, y0: number, x1: number, y1: number, skipFirst: boolean): void {
        x0 = Math.floor(x0);
        y0 = Math.floor(y0);
        x1 = Math.floor(x1);
        y1 = Math.floor(y1);

        const dX = Math.abs(x1 - x0);
        const sX = x0 < x1 ? 1 : -1;
        const dY = -Math.abs(y1 - y0);
        const sY = y0 < y1 ? 1 : -1;
        let err = dX + dY;

         
        while (true) {
            if (skipFirst) {
                skipFirst = false;
            } else {
                this.bresenheimPath?.rect(x0, y0, 1, 1);
            }
            if (x0 === x1 && y0 === y1) {
                break;
            }
            const e2 = 2 * err;
            if (e2 >= dY) {
                err += dY;
                x0 += sX;
            }
            if (e2 <= dX) {
                err += dX;
                y0 += sY;
            }
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor() {
        this.ditherCanvas = BB.canvas(4, 4);
        this.ditherCtx = BB.ctx(this.ditherCanvas);
    }

    // ---- interface ----

    startLine(x: number, y: number, p: number): void {
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        this.selectionBounds = this.selection
            ? integerBounds(getMultiPolyBounds(this.selection))
            : undefined;
        this.historyTiles = [];
        this.redrawBounds = undefined;
        if (this.settingUseDither) {
            this.updateDither();
        }
        this.initClone();

        p = Math.max(0, Math.min(1, p));
        const localOpacity = this.settingHasOpacityPressure
            ? this.settingOpacity * p * p
            : this.settingOpacity;
        const localSize = this.settingHasSizePressure
            ? Math.max(0.5, p * this.settingSize)
            : Math.max(0.5, this.settingSize);

        this.inputIsDrawing = true;
        this.ctxClone.save();
        this.selectionPath && this.ctxClone.clip(this.selectionPath);
        this.drawDot(x, y, localSize, localOpacity);
        this.ctxClone.restore();
        this.lineToolLastDot = localSize * this.settingSpacing;
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
        this.lastInput2 = BB.copyObj(this.lastInput);
        this.redrawToCanvas();
    }

    goLine(x: number, y: number, p: number): void {
        if (!this.inputIsDrawing) {
            return;
        }

        //debug
        //drawDot(x, y, 1, 0.5);

        const pressure = BB.clamp(p, 0, 1);
        const localSize = this.settingHasSizePressure
            ? Math.max(0.1, this.lastInput.pressure * this.settingSize)
            : Math.max(0.1, this.settingSize);

        this.continueLine(x, y, localSize, this.lastInput.pressure);

        this.lastInput2 = BB.copyObj(this.lastInput);
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = pressure;
        this.redrawToCanvas();
    }

    endLine(): void {
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        const localSize = this.settingHasSizePressure
            ? Math.max(0.1, this.lastInput.pressure * this.settingSize)
            : Math.max(0.1, this.settingSize);
        this.continueLine(null, null, localSize, this.lastInput.pressure);

        //debug
        //drawDot(lastInput.x, lastInput.y, 3, 1);
        //drawDot(x, y, 10, 0.1);

        this.inputIsDrawing = false;

        this.bezierLine = null;

        this.redrawToCanvas();
        if (this.historyTiles.some((item) => item)) {
            this.klHistory.push(
                getPushableLayerChange(
                    this.klHistory.getComposed(),
                    canvasAndChangedTilesToLayerTiles(this.canvasClone, this.historyTiles),
                ),
            );
        }
        this.freeClone();
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        this.startLine(x1, y1, 1);
        this.goLine(x2, y2, 1);
        this.endLine();
    }

    //IS
    isDrawing(): boolean {
        return this.inputIsDrawing;
    }

    //SET
    setColor(c: TRgb): void {
        if (this.settingColor === c) {
            return;
        }
        this.settingColor = c;
        this.settingColorStr =
            'rgb(' +
            this.settingColor.r +
            ',' +
            this.settingColor.g +
            ',' +
            this.settingColor.b +
            ')';
    }

    setContext(c: CanvasRenderingContext2D): void {
        this.context = c;
    }

    setHistory(klHistory: KlHistory): void {
        this.klHistory = klHistory;
    }

    setSize(s: number): void {
        this.settingSize = Math.round(s * 2) / 2;
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

    setIsEraser(b: boolean): void {
        this.settingIsEraser = b;
    }

    setUseDither(b: boolean): void {
        this.settingUseDither = b;
    }

    //GET
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

    getIsEraser(): boolean {
        return this.settingIsEraser;
    }

    getUseDither(): boolean {
        return this.settingUseDither;
    }
}
