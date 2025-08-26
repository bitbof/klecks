import { BB } from '../../bb/bb';
import { TPressureInput } from '../kl-types';
import { BezierLine } from '../../bb/math/line';
import { ERASE_COLOR } from './erase-color';
import { TKlCanvasLayer } from '../canvas/kl-canvas';
import { KlHistory } from '../history/kl-history';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { TBounds } from '../../bb/bb-types';
import { canvasAndChangedTilesToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { getChangedTiles, updateChangedTiles } from '../history/push-helpers/changed-tiles';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { boundsOverlap, integerBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';

export class EraserBrush {
    private size: number = 30;
    private spacing: number = 0.4;
    private opacity: number = 1;
    private useSizePressure: boolean = true;
    private useOpacityPressure: boolean = false;
    private isTransparentBG: boolean = false;

    private klHistory: KlHistory = {} as KlHistory;
    private isBaseLayer: boolean = false;
    private layer: TKlCanvasLayer = {} as TKlCanvasLayer;
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;

    private started: boolean = false;
    private lastDot: number | undefined;
    private lastInput: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private lastInput2: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private bezierLine: BezierLine | undefined;

    private changedTiles: boolean[] = [];

    private selection: MultiPolygon | undefined;
    private selectionPath: Path2D | undefined;
    private selectionBounds: TBounds | undefined;

    private updateChangedTiles(bounds: TBounds) {
        const boundsWithinSelection = boundsOverlap(bounds, this.selectionBounds);
        if (!boundsWithinSelection) {
            return;
        }
        this.changedTiles = updateChangedTiles(
            this.changedTiles,
            getChangedTiles(bounds, this.context.canvas.width, this.context.canvas.height),
        );
    }

    private drawDot(x: number, y: number, size: number, opacity: number): void {
        this.context.save();
        if (this.isBaseLayer) {
            if (this.isTransparentBG) {
                this.context.globalCompositeOperation = 'destination-out';
            } else {
                this.context.globalCompositeOperation = 'source-atop';
            }
        } else {
            this.context.globalCompositeOperation = 'destination-out';
        }
        const radgrad = this.context.createRadialGradient(size, size, 0, size, size, size);
        let sharpness = Math.pow(opacity, 2);
        sharpness = Math.max(0, Math.min((size - 1) / size, sharpness));
        const oFac = Math.max(0, Math.min(1, opacity));
        const localOpacity = 2 * oFac - oFac * oFac;
        radgrad.addColorStop(
            sharpness,
            `rgba(${ERASE_COLOR}, ${ERASE_COLOR}, ${ERASE_COLOR}, ` + localOpacity + ')',
        );
        radgrad.addColorStop(1, `rgba(${ERASE_COLOR}, ${ERASE_COLOR}, ${ERASE_COLOR}, 0)`);
        this.context.fillStyle = radgrad;
        this.context.translate(x - size, y - size);
        this.context.fillRect(0, 0, size * 2, size * 2);
        this.context.restore();

        this.updateChangedTiles({
            x1: Math.floor(x - size),
            y1: Math.floor(y - size),
            x2: Math.ceil(x + size),
            y2: Math.ceil(y + size),
        });
    }

    private continueLine(x: number | undefined, y: number | undefined, p: number): void {
        p = Math.max(0, Math.min(1, p));
        let localPressure;
        let localOpacity;
        let localSize = this.useSizePressure
            ? Math.max(0.1, p * this.size)
            : Math.max(0.1, this.size);

        const bdist = Math.max(1, Math.max(0.5, 1 - this.opacity) * localSize * this.spacing);

        const bezierCallback = (val: {
            x: number;
            y: number;
            t: number;
            angle?: number;
            dAngle: number;
        }): void => {
            const factor = val.t;
            localPressure = this.lastInput2.pressure * (1 - factor) + p * factor;
            localOpacity = this.useOpacityPressure
                ? this.opacity * localPressure * localPressure
                : this.opacity;
            localSize = this.useSizePressure
                ? Math.max(0.1, localPressure * this.size)
                : Math.max(0.1, this.size);

            this.drawDot(val.x, val.y, localSize, localOpacity);
        };

        this.context.save();
        this.selectionPath && this.context.clip(this.selectionPath);
        if (x === undefined || y === undefined) {
            this.bezierLine!.addFinal(bdist, bezierCallback);
        } else {
            this.bezierLine!.add(x, y, bdist, bezierCallback);
        }
        this.context.restore();
    }

    // ----------------------------------- public -----------------------------------
    constructor() {}

    // ---- interface ----
    startLine(x: number, y: number, p: number): void {
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        this.selectionBounds = this.selection
            ? integerBounds(getMultiPolyBounds(this.selection))
            : undefined;
        this.changedTiles = [];
        this.isBaseLayer = 0 === this.layer.index;

        p = Math.max(0, Math.min(1, p));
        const localOpacity = this.useOpacityPressure ? this.opacity * p * p : this.opacity;
        const localSize = this.useSizePressure
            ? Math.max(0.1, p * this.size)
            : Math.max(0.1, this.size);

        this.started = true;
        if (localSize > 1) {
            this.context.save();
            this.selectionPath && this.context.clip(this.selectionPath);
            this.drawDot(x, y, localSize, localOpacity);
            this.context.restore();
        }
        this.lastDot = localSize * this.spacing;
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
        this.lastInput2 = BB.copyObj(this.lastInput);

        this.bezierLine = new BB.BezierLine();
        this.bezierLine.add(x, y, 0, () => undefined);
    }

    goLine(x: number, y: number, p: number): void {
        if (!this.started) {
            return;
        }

        this.continueLine(x, y, this.lastInput.pressure);

        this.lastInput2 = BB.copyObj(this.lastInput);
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
    }

    endLine(): void {
        if (this.bezierLine) {
            this.continueLine(undefined, undefined, this.lastInput.pressure);
        }

        this.started = false;
        this.bezierLine = undefined;

        if (this.changedTiles.some((item) => item)) {
            this.klHistory.push(
                getPushableLayerChange(
                    this.klHistory.getComposed(),
                    canvasAndChangedTilesToLayerTiles(this.context.canvas, this.changedTiles),
                ),
            );
        }
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        this.selectionBounds = this.selection
            ? integerBounds(getMultiPolyBounds(this.selection))
            : undefined;
        this.changedTiles = [];
        this.isBaseLayer = 0 === this.layer.index;

        this.lastInput.x = x2;
        this.lastInput.y = y2;

        if (this.started || x1 === undefined) {
            return;
        }

        const mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
        const eX = (x2 - x1) / mouseDist;
        const eY = (y2 - y1) / mouseDist;
        let loopDist;
        const bdist = Math.max(1, Math.max(0.5, 1 - this.opacity) * this.size * this.spacing);
        this.lastDot = 0;
        this.context.save();
        this.selectionPath && this.context.clip(this.selectionPath);
        for (loopDist = this.lastDot; loopDist <= mouseDist; loopDist += bdist) {
            this.drawDot(x1 + eX * loopDist, y1 + eY * loopDist, this.size, this.opacity);
        }
        this.context.restore();

        if (this.changedTiles.some((item) => item)) {
            this.klHistory.push(
                getPushableLayerChange(
                    this.klHistory.getComposed(),
                    canvasAndChangedTilesToLayerTiles(this.context.canvas, this.changedTiles),
                ),
            );
        }
    }

    //IS
    isDrawing(): boolean {
        return this.started;
    }

    //SET
    setLayer(layer: TKlCanvasLayer): void {
        this.layer = layer;
        this.context = layer.context;
    }

    setHistory(klHistory: KlHistory): void {
        this.klHistory = klHistory;
    }

    setSize(s: number): void {
        this.size = s;
    }

    setOpacity(o: number): void {
        this.opacity = o;
    }

    sizePressure(b: boolean): void {
        this.useSizePressure = b;
    }

    opacityPressure(b: boolean): void {
        this.useOpacityPressure = b;
    }

    setTransparentBG(b: boolean): void {
        this.isTransparentBG = b;
    }

    //GET
    getSize(): number {
        return this.size;
    }

    getOpacity(): number {
        return this.opacity;
    }
}
