import { BB } from '../../bb/bb';
import { IHistoryEntry, KlHistory, THistoryInnerActions } from '../history/kl-history';
import { TPressureInput } from '../kl-types';
import { BezierLine } from '../../bb/math/line';
import { ERASE_COLOR } from './erase-color';
import { KlCanvasContext } from '../canvas/kl-canvas';

export interface IEraserBrushHistoryEntry extends IHistoryEntry {
    tool: ['brush', 'EraserBrush'];
    actions: THistoryInnerActions<EraserBrush>[];
}

export class EraserBrush {
    private size: number = 30;
    private spacing: number = 0.4;
    private opacity: number = 1;
    private useSizePressure: boolean = true;
    private useOpacityPressure: boolean = false;
    private isTransparentBG: boolean = false;

    private history: KlHistory | undefined;
    private historyEntry: IEraserBrushHistoryEntry | undefined;
    private isBaseLayer: boolean = false;
    private context: KlCanvasContext = {} as KlCanvasContext;

    private started: boolean = false;
    private lastDot: number | undefined;
    private lastInput: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private lastInput2: TPressureInput = { x: 0, y: 0, pressure: 0 };
    private bezierLine: BezierLine | undefined;

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

        if (x === undefined || y === undefined) {
            this.bezierLine!.addFinal(bdist, bezierCallback);
        } else {
            this.bezierLine!.add(x, y, bdist, bezierCallback);
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor() {}

    // ---- interface ----
    startLine(x: number, y: number, p: number): void {
        this.historyEntry = {
            tool: ['brush', 'EraserBrush'],
            actions: [
                {
                    action: 'opacityPressure',
                    params: [this.useOpacityPressure],
                },
                {
                    action: 'sizePressure',
                    params: [this.useSizePressure],
                },
                {
                    action: 'setSize',
                    params: [this.size],
                },
                {
                    action: 'setOpacity',
                    params: [this.opacity],
                },
                {
                    action: 'setTransparentBG',
                    params: [this.isTransparentBG],
                },
                {
                    action: 'startLine',
                    params: [x, y, p],
                },
            ],
        };

        this.isBaseLayer = 0 === this.context.canvas.index;

        p = Math.max(0, Math.min(1, p));
        const localOpacity = this.useOpacityPressure ? this.opacity * p * p : this.opacity;
        const localSize = this.useSizePressure
            ? Math.max(0.1, p * this.size)
            : Math.max(0.1, this.size);

        this.started = true;
        if (localSize > 1) {
            this.drawDot(x, y, localSize, localOpacity);
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
        if (!this.started || !this.historyEntry) {
            return;
        }
        this.historyEntry.actions?.push({
            action: 'goLine',
            params: [x, y, p],
        });

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

        if (this.historyEntry) {
            this.historyEntry.actions?.push({
                action: 'endLine',
                params: [],
            });
            this.history?.push(this.historyEntry);
            this.historyEntry = undefined;
        }
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        this.isBaseLayer = 0 === this.context.canvas.index;

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
        for (loopDist = this.lastDot; loopDist <= mouseDist; loopDist += bdist) {
            this.drawDot(x1 + eX * loopDist, y1 + eY * loopDist, this.size, this.opacity);
        }

        const historyEntry: IEraserBrushHistoryEntry = {
            tool: ['brush', 'EraserBrush'],
            actions: [
                {
                    action: 'opacityPressure',
                    params: [this.useOpacityPressure],
                },
                {
                    action: 'sizePressure',
                    params: [this.useSizePressure],
                },
                {
                    action: 'setSize',
                    params: [this.size],
                },
                {
                    action: 'setOpacity',
                    params: [this.opacity],
                },
                {
                    action: 'setTransparentBG',
                    params: [this.isTransparentBG],
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
        return this.started;
    }

    //SET
    setContext(c: KlCanvasContext): void {
        this.context = c;
    }

    setHistory(l: KlHistory): void {
        this.history = l;
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
