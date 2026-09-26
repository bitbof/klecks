import { BB } from '../../bb/bb';
import { TPressureInput, TRgb } from '../kl-types';
import { TIndexBounds, TRect, TVector2D } from '../../bb/bb-types';
import { LinearLine } from '../../bb/math/line';
import { ERASE_COLOR } from './erase-color';
import { throwIfNull } from '../../bb/base/base';
import { KlHistory } from '../history/kl-history';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { getChangedTiles, updateChangedTiles } from '../history/push-helpers/changed-tiles';
import { canvasAndChangedTilesToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import {
    boundsToRect,
    fixBounds,
    intersectBounds,
    rectToBounds,
    updateBounds,
} from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { DEFAULT_PIXEL_PATTERNS, TPixelPattern } from './pixel-brush-patterns';
import { PixelDiscUnion } from './pixel-brush-disc';

export type TPixelBrushTip = 'square' | 'round';

export class PixelBrush {
    private klHistory: KlHistory = {} as KlHistory;
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private settingHasSizePressure: boolean = true;
    private settingSize: number = 0.5;
    private settingSpacing: number = 0.9;
    private settingOpacity: number = 1;
    private settingColor: TRgb = {} as TRgb;
    private settingColorStr: string = '';
    private settingLockLayerAlpha: boolean = false;
    private settingIsEraser: boolean = false;
    private settingPattern: TPixelPattern = DEFAULT_PIXEL_PATTERNS[0]; // solid
    private settingTip: TPixelBrushTip = 'round';
    private inputIsDrawing: boolean = false;
    private lastInput: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private linearLine: LinearLine | null = null;
    // size 1: last plotted pixel
    private pixelLineEnd: TVector2D | undefined;
    private readonly patternCanvas: HTMLCanvasElement;
    private readonly patternCtx: CanvasRenderingContext2D;
    private fillStyle: string | CanvasPattern = '';

    /*
        Draw brush into fresh canvas for each line,
        because otherwise chrome slows the main canvas down.
        Multiple reads on a canvas -> canvas moved to CPU. (my guess)
     */
    private canvasClone: HTMLCanvasElement = {} as HTMLCanvasElement;
    private ctxClone: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    /*
        Stroke is drawn opaque into its own canvas, then composited with opacity.
        That way overlapping dots don't accumulate -> opacity instead of flow.
        Kept between strokes (cleared after each), freed via freeResources.
     */
    private strokeCanvas: HTMLCanvasElement | undefined;
    private strokeCtx: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;

    // area that changed since last redraw
    private redrawBounds: TIndexBounds | undefined;
    // area that changed during the whole stroke
    private strokeBounds: TIndexBounds | undefined;
    // changed tiles that will be pushed to history
    private historyTiles: boolean[] = [];

    private bresenheimPath: Path2D | undefined;

    // round dots of the current segment. Filled together in fillDiscs.
    private discs: TRect[] = [];
    private readonly discUnion = new PixelDiscUnion();

    private selection: MultiPolygon | undefined;
    private selectionPath: Path2D | undefined;
    private selectionBounds: TIndexBounds | undefined;

    private updateChangedTiles(bounds: TIndexBounds) {
        // fix bounds
        bounds = {
            type: 'index',
            x1: Math.min(bounds.x1, bounds.x2),
            y1: Math.min(bounds.y1, bounds.y2),
            x2: Math.max(bounds.x1, bounds.x2),
            y2: Math.max(bounds.y1, bounds.y2),
        };
        const boundsWithinSelection = intersectBounds(bounds, this.selectionBounds);
        if (!boundsWithinSelection) {
            return;
        }
        const changedTiles = getChangedTiles(
            boundsWithinSelection,
            this.context.canvas.width,
            this.context.canvas.height,
        );
        this.redrawBounds = updateBounds(this.redrawBounds, boundsWithinSelection);
        this.strokeBounds = updateBounds(this.strokeBounds, boundsWithinSelection);
        this.historyTiles = updateChangedTiles(this.historyTiles, changedTiles);
    }

    private initClone(): void {
        const width = this.context.canvas.width;
        const height = this.context.canvas.height;
        this.canvasClone = BB.canvas(width, height);
        this.ctxClone = BB.ctx(this.canvasClone);
        this.ctxClone.drawImage(this.context.canvas, 0, 0);
        if (
            !this.strokeCanvas ||
            this.strokeCanvas.width !== width ||
            this.strokeCanvas.height !== height
        ) {
            this.strokeCanvas && BB.freeCanvas(this.strokeCanvas);
            this.strokeCanvas = BB.canvas(width, height);
            this.strokeCtx = BB.ctx(this.strokeCanvas);
        }
    }

    private freeClone(): void {
        BB.freeCanvas(this.canvasClone);
        this.ctxClone = {} as CanvasRenderingContext2D;
        // cleared right away, so the next stroke can start immediately
        this.strokeCtx.clearRect(0, 0, this.strokeCtx.canvas.width, this.strokeCtx.canvas.height);
    }

    /**
     * Composites stroke onto ctx within rect.
     */
    private drawStroke(ctx: CanvasRenderingContext2D, rect: TRect): void {
        ctx.save();
        ctx.globalAlpha = this.settingOpacity;
        if (this.settingLockLayerAlpha) {
            ctx.globalCompositeOperation = 'source-atop';
        } else if (this.settingIsEraser) {
            ctx.globalCompositeOperation = 'destination-out';
        }
        ctx.drawImage(
            this.strokeCtx.canvas,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
        );
        ctx.restore();
    }

    private redrawToCanvas(): void {
        if (!this.redrawBounds) {
            return;
        }
        const boundsRect = boundsToRect(this.redrawBounds);
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
        this.drawStroke(this.context, boundsRect);
        this.redrawBounds = undefined;
    }

    private updateFillStyle(): void {
        const colorStr = this.settingIsEraser
            ? `rgb(${ERASE_COLOR},${ERASE_COLOR},${ERASE_COLOR})`
            : this.settingColorStr;
        // Always a pattern, even when solid. Filling with a plain color is slower in Firefox
        // (lower fps at size 1).
        const pattern = this.settingPattern;
        if (
            this.patternCanvas.width !== pattern.width ||
            this.patternCanvas.height !== pattern.height
        ) {
            this.patternCanvas.width = pattern.width;
            this.patternCanvas.height = pattern.height;
        }
        this.patternCtx.clearRect(0, 0, pattern.width, pattern.height);
        this.patternCtx.fillStyle = colorStr;
        pattern.data.forEach((value, i) => {
            if (value) {
                this.patternCtx.fillRect(i % pattern.width, Math.floor(i / pattern.width), 1, 1);
            }
        });
        this.fillStyle = throwIfNull(
            // InvalidStateError: The object is in an invalid state.
            this.strokeCtx.createPattern(this.patternCanvas, 'repeat'),
        );
    }

    private drawDot(x: number, y: number, size: number): void {
        const rect: TRect = {
            x: Math.round(x + -size),
            y: Math.round(y + -size),
            width: Math.round(size * 2),
            height: Math.round(size * 2),
        };
        this.updateChangedTiles(rectToBounds(rect, 'index'));

        if (this.settingTip === 'round') {
            this.discs.push(rect);
        } else {
            this.strokeCtx.save();
            this.strokeCtx.fillStyle = this.fillStyle;
            this.strokeCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
            this.strokeCtx.restore();
        }
    }

    /**
     * Round dots are dense and overlap heavily. Filling their union as one path is
     * much cheaper than filling each dot.
     */
    private fillDiscs(): void {
        const rects = this.discUnion.getRects(this.discs, {
            x: 0,
            y: 0,
            width: this.strokeCtx.canvas.width,
            height: this.strokeCtx.canvas.height,
        });
        this.discs = [];
        if (rects.length === 0) {
            return;
        }
        this.strokeCtx.beginPath();
        rects.forEach((rect) => this.strokeCtx.rect(rect.x, rect.y, rect.width, rect.height));
        this.strokeCtx.fillStyle = this.fillStyle;
        this.strokeCtx.fill();
    }

    private isPixelLine(): boolean {
        return Math.round(this.settingSize * 2) === 1;
    }

    /**
     * Size 1: batch short coalesced segments to avoid stair-stepped corners, but plot regular points immediately.
     */
    private continuePixelLine(x: number, y: number, forcePlot: boolean): void {
        const from = this.pixelLineEnd!;
        const to = { x: Math.floor(x), y: Math.floor(y) };
        const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
        if (distance === 0 || (!forcePlot && distance < 4)) {
            return;
        }
        this.plotLine(from.x, from.y, to.x, to.y, true);
        this.pixelLineEnd = to;
    }

    private fillPixelLine(): void {
        this.strokeCtx.fillStyle = this.fillStyle;
        this.strokeCtx.fill(this.bresenheimPath!);
        this.bresenheimPath = undefined;
    }

    private continueLine(point: TPressureInput, forcePlot: boolean): void {
        if (this.linearLine === null) {
            this.linearLine = new LinearLine(this.lastInput);
        }
        const pressure = BB.clamp(point.pressure, 0, 1);

        if (this.isPixelLine()) {
            this.continuePixelLine(point.x, point.y, forcePlot);
        } else {
            const size = this.settingHasSizePressure
                ? Math.max(0.1, pressure * this.settingSize)
                : Math.max(0.1, this.settingSize);
            // round tip needs dense spacing, otherwise the stroke edges become scalloped
            const localSpacing =
                this.settingTip === 'round'
                    ? Math.min(1, size * this.settingSpacing)
                    : size * this.settingSpacing;

            this.linearLine.add(point.x, point.y, localSpacing, (val) => {
                const localPressure = BB.mix(this.lastInput.pressure, pressure, val.t);
                const localSize = Math.max(
                    0.5,
                    this.settingSize * (this.settingHasSizePressure ? localPressure : 1),
                );
                this.drawDot(val.x, val.y, localSize);
            });
        }

        this.lastInput.x = point.x;
        this.lastInput.y = point.y;
        this.lastInput.pressure = pressure;
    }

    /**
     * bresenheim line drawing
     */
    private plotLine(x0: number, y0: number, x1: number, y1: number, skipFirst: boolean): void {
        this.updateChangedTiles(
            fixBounds({
                type: 'index',
                x1: x0,
                y1: y0,
                x2: x1,
                y2: y1,
            }),
        );
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
        this.patternCanvas = BB.canvas(4, 4);
        this.patternCtx = BB.ctx(this.patternCanvas);
    }

    // ---- interface ----

    startLine(x: number, y: number, p: number): void {
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        this.selectionBounds = this.selection
            ? getMultiPolyBounds(this.selection, 'index')
            : undefined;
        this.historyTiles = [];
        this.redrawBounds = undefined;
        this.strokeBounds = undefined;
        this.initClone();
        this.updateFillStyle();

        p = Math.max(0, Math.min(1, p));
        const localSize = this.settingHasSizePressure
            ? Math.max(0.5, p * this.settingSize)
            : Math.max(0.5, this.settingSize);

        this.inputIsDrawing = true;
        this.strokeCtx.save();
        this.selectionPath && this.strokeCtx.clip(this.selectionPath);
        this.drawDot(x, y, localSize);
        this.fillDiscs();
        this.strokeCtx.restore();
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
        this.pixelLineEnd = { x: Math.floor(x), y: Math.floor(y) };
        this.redrawToCanvas();
    }

    goLine(points: TPressureInput[]): void {
        if (!this.inputIsDrawing) {
            return;
        }

        this.strokeCtx.save();
        this.selectionPath && this.strokeCtx.clip(this.selectionPath);
        if (this.isPixelLine()) {
            this.bresenheimPath = new Path2D();
            // The last point is regular; preceding points are coalesced.
            points.forEach((point, index) => this.continueLine(point, index === points.length - 1));
            this.fillPixelLine();
        } else {
            points.forEach((point) => this.continueLine(point, false));
            this.fillDiscs();
        }
        this.strokeCtx.restore();

        this.redrawToCanvas();
    }

    endLine(): void {
        if (!this.inputIsDrawing) {
            return;
        }
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        if (this.isPixelLine()) {
            this.strokeCtx.save();
            this.selectionPath && this.strokeCtx.clip(this.selectionPath);
            this.bresenheimPath = new Path2D();
            this.continuePixelLine(this.lastInput.x, this.lastInput.y, true);
            this.fillPixelLine();
            this.strokeCtx.restore();
        }

        //debug
        //drawDot(lastInput.x, lastInput.y, 3, 1);
        //drawDot(x, y, 10, 0.1);

        this.inputIsDrawing = false;

        this.linearLine = null;

        this.redrawToCanvas();
        if (this.strokeBounds) {
            this.drawStroke(this.ctxClone, boundsToRect(this.strokeBounds));
        }
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
        this.goLine([{ x: x2, y: y2, pressure: 1 }]);
        this.endLine();
    }

    /**
     * Frees resources that are kept between strokes. E.g. when switching to another tool.
     */
    freeResources(): void {
        if (!this.strokeCanvas || this.inputIsDrawing) {
            return;
        }
        BB.freeCanvas(this.strokeCanvas);
        this.strokeCanvas = undefined;
        this.strokeCtx = {} as CanvasRenderingContext2D;
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

    setLockAlpha(b: boolean): void {
        this.settingLockLayerAlpha = b;
    }

    setIsEraser(b: boolean): void {
        this.settingIsEraser = b;
    }

    setPattern(pattern: TPixelPattern): void {
        this.settingPattern = pattern;
    }

    setTip(tip: TPixelBrushTip): void {
        this.settingTip = tip;
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

    getPattern(): TPixelPattern {
        return this.settingPattern;
    }

    getTip(): TPixelBrushTip {
        return this.settingTip;
    }
}
