import { BB } from '../../bb/bb';
import { IHistoryEntry, KlHistory, THistoryInnerActions } from '../history/kl-history';
import { KL } from '../kl';
import { IRGB, TPressureInput } from '../kl-types';
import { IVector2D } from '../../bb/bb-types';
import { BezierLine } from '../../bb/math/line';
import { ERASE_COLOR } from './erase-color';
import { throwIfNull } from '../../bb/base/base';

export interface IPixelBrushHistoryEntry extends IHistoryEntry {
    tool: ['brush', 'PixelBrush'];
    actions: THistoryInnerActions<PixelBrush>[];
}

export class PixelBrush {
    private history: KlHistory | undefined;
    private historyEntry: IPixelBrushHistoryEntry | undefined;
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private settingHasSizePressure: boolean = true;
    private settingHasOpacityPressure: boolean = false;
    private settingSize: number = 0.5;
    private settingSpacing: number = 0.9;
    private settingOpacity: number = 1;
    private settingColor: IRGB = {} as IRGB;
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
        p1: IVector2D,
        p2: IVector2D,
        p3: IVector2D,
        p4: IVector2D,
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

    private plotCubicBezierLine(p1: IVector2D, p2: IVector2D, p3: IVector2D, p4: IVector2D): void {
        const isOverThreshold = this.cubicCurveOverThreshold(p1, p2, p3, p4, 0.1);

        p1.x = Math.floor(p1.x);
        p1.y = Math.floor(p1.y);
        p4.x = Math.floor(p4.x);
        p4.y = Math.floor(p4.y);

        const dist = BB.dist(p1.x, p1.y, p4.x, p4.y);
        if (!isOverThreshold || dist < 7) {
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
        this.context.save();
        if (this.settingIsEraser) {
            this.context.fillStyle = this.settingUseDither ? this.ditherPattern : '#fff';
            if (this.settingLockLayerAlpha) {
                this.context.globalCompositeOperation = 'source-atop';
            } else {
                this.context.globalCompositeOperation = 'destination-out';
            }
        } else {
            this.context.fillStyle = this.settingUseDither
                ? this.ditherPattern
                : this.settingColorStr;
            if (this.settingLockLayerAlpha) {
                this.context.globalCompositeOperation = 'source-atop';
            }
        }
        this.context.globalAlpha = this.settingUseDither ? 1 : opacity;
        this.context.fillRect(
            Math.round(x + -size),
            Math.round(y + -size),
            Math.round(size * 2),
            Math.round(size * 2),
        );
        this.context.restore();
    }

    private continueLine(x: number | null, y: number | null, size: number, pressure: number): void {
        if (this.bezierLine === null) {
            this.bezierLine = new BB.BezierLine();
            this.bezierLine.add(this.lastInput.x, this.lastInput.y, 0, () => {});
        }

        this.context.save();

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
            p1: IVector2D;
            p2: IVector2D;
            p3: IVector2D;
            p4: IVector2D;
        }): void => {
            this.plotCubicBezierLine(controlObj.p1, controlObj.p2, controlObj.p3, controlObj.p4);
        };

        if (Math.round(this.settingSize * 2) === 1) {
            if (x === null || y === null) {
                this.bezierLine.addFinal(4, undefined, controlCallback);
            } else {
                this.bezierLine.add(x, y, 4, undefined, controlCallback);
            }
        } else {
            const localSpacing = size * this.settingSpacing;

            if (x === null || y === null) {
                this.bezierLine.addFinal(localSpacing, dotCallback);
            } else {
                this.bezierLine.add(x, y, localSpacing, dotCallback);
            }
        }

        this.context.restore();
    }

    /**
     * bresenheim line drawing
     */
    private plotLine(x0: number, y0: number, x1: number, y1: number, skipFirst: boolean): void {
        this.context.save();

        if (this.settingIsEraser) {
            this.context.fillStyle = this.settingUseDither ? this.ditherPattern : '#fff';
            if (this.settingLockLayerAlpha) {
                this.context.globalCompositeOperation = 'source-atop';
            } else {
                this.context.globalCompositeOperation = 'destination-out';
            }
        } else {
            this.context.fillStyle = this.settingUseDither
                ? this.ditherPattern
                : this.settingColorStr;
            if (this.settingLockLayerAlpha) {
                this.context.globalCompositeOperation = 'source-atop';
            }
        }
        this.context.globalAlpha = this.settingUseDither ? 1 : this.settingOpacity;

        x0 = Math.floor(x0);
        y0 = Math.floor(y0);
        x1 = Math.floor(x1);
        y1 = Math.floor(y1);

        const dX = Math.abs(x1 - x0);
        const sX = x0 < x1 ? 1 : -1;
        const dY = -Math.abs(y1 - y0);
        const sY = y0 < y1 ? 1 : -1;
        let err = dX + dY;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (skipFirst) {
                skipFirst = false;
            } else {
                this.context.fillRect(x0, y0, 1, 1);
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

        this.context.restore();
    }

    // ----------------------------------- public -----------------------------------
    constructor() {
        this.ditherCanvas = BB.canvas(4, 4);
        this.ditherCtx = BB.ctx(this.ditherCanvas);
    }

    // ---- interface ----

    startLine(x: number, y: number, p: number): void {
        this.historyEntry = {
            tool: ['brush', 'PixelBrush'],
            actions: [
                {
                    action: 'sizePressure',
                    params: [this.settingHasSizePressure],
                },
                {
                    action: 'opacityPressure',
                    params: [this.settingHasOpacityPressure],
                },
                {
                    action: 'setSize',
                    params: [this.settingSize],
                },
                {
                    action: 'setSpacing',
                    params: [this.settingSpacing],
                },
                {
                    action: 'setOpacity',
                    params: [this.settingOpacity],
                },
                {
                    action: 'setColor',
                    params: [this.settingColor],
                },
                {
                    action: 'setLockAlpha',
                    params: [this.settingLockLayerAlpha],
                },
                {
                    action: 'setIsEraser',
                    params: [this.settingIsEraser],
                },
                {
                    action: 'setUseDither',
                    params: [this.settingUseDither],
                },
            ],
        };

        if (this.settingUseDither) {
            this.updateDither();
        }

        p = Math.max(0, Math.min(1, p));
        const localOpacity = this.settingHasOpacityPressure
            ? this.settingOpacity * p * p
            : this.settingOpacity;
        const localSize = this.settingHasSizePressure
            ? Math.max(0.5, p * this.settingSize)
            : Math.max(0.5, this.settingSize);

        this.inputIsDrawing = true;
        this.drawDot(x, y, localSize, localOpacity);
        this.lineToolLastDot = localSize * this.settingSpacing;
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.lastInput.pressure = p;
        this.lastInput2 = BB.copyObj(this.lastInput);

        this.historyEntry.actions!.push({
            action: 'startLine',
            params: [x, y, p],
        });
    }

    goLine(x: number, y: number, p: number): void {
        if (!this.inputIsDrawing) {
            return;
        }
        this.historyEntry!.actions!.push({
            action: 'goLine',
            params: [x, y, p],
        });

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
    }

    endLine(x: number, y: number): void {
        const localSize = this.settingHasSizePressure
            ? Math.max(0.1, this.lastInput.pressure * this.settingSize)
            : Math.max(0.1, this.settingSize);
        this.continueLine(null, null, localSize, this.lastInput.pressure);

        //debug
        //drawDot(lastInput.x, lastInput.y, 3, 1);
        //drawDot(x, y, 10, 0.1);

        this.inputIsDrawing = false;

        this.bezierLine = null;

        if (this.historyEntry) {
            this.historyEntry.actions!.push({
                action: 'endLine',
                params: [x, y],
            });
            this.history?.push(this.historyEntry);
            this.historyEntry = undefined;
        }
    }

    //cheap n' ugly
    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        this.lastInput.x = x2;
        this.lastInput.y = y2;
        this.lastInput.pressure = 1;

        if (this.inputIsDrawing || x1 === undefined) {
            return;
        }

        if (this.settingUseDither) {
            this.updateDither();
        }

        if (Math.round(this.settingSize * 2) === 1) {
            this.plotLine(x1, y1, x2, y2, true);
        } else {
            // const angle = BB.pointsToAngleDeg({x: x1, y: y1}, {x: x2, y: y2});
            const mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
            const eX = (x2 - x1) / mouseDist;
            const eY = (y2 - y1) / mouseDist;
            let loopDist;
            const bdist = this.settingSize * this.settingSpacing;
            this.lineToolLastDot = this.settingSize * this.settingSpacing;
            for (loopDist = this.lineToolLastDot; loopDist <= mouseDist; loopDist += bdist) {
                this.drawDot(
                    x1 + eX * loopDist,
                    y1 + eY * loopDist,
                    this.settingSize,
                    this.settingOpacity,
                );
            }
        }

        const historyEntry: IPixelBrushHistoryEntry = {
            tool: ['brush', 'PixelBrush'],
            actions: [
                {
                    action: 'sizePressure',
                    params: [this.settingHasSizePressure],
                },
                {
                    action: 'opacityPressure',
                    params: [this.settingHasOpacityPressure],
                },
                {
                    action: 'setSize',
                    params: [this.settingSize],
                },
                {
                    action: 'setSpacing',
                    params: [this.settingSpacing],
                },
                {
                    action: 'setOpacity',
                    params: [this.settingOpacity],
                },
                {
                    action: 'setColor',
                    params: [this.settingColor],
                },
                {
                    action: 'setLockAlpha',
                    params: [this.settingLockLayerAlpha],
                },
                {
                    action: 'setIsEraser',
                    params: [this.settingIsEraser],
                },
                {
                    action: 'setUseDither',
                    params: [this.settingUseDither],
                },
                {
                    action: 'drawLineSegment',
                    params: [x1, y1, x2, y2],
                },
            ],
        };
        this.history?.push(historyEntry);
    }

    //IS
    isDrawing(): boolean {
        return this.inputIsDrawing;
    }

    //SET
    setColor(c: IRGB): void {
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

    setHistory(l: KlHistory): void {
        this.history = l;
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
