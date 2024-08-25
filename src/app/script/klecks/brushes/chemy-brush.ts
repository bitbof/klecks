import { BB } from '../../bb/bb';
import { IRGB } from '../kl-types';
import { IBounds } from '../../bb/bb-types';
import { IHistoryEntry, KlHistory, THistoryInnerActions } from '../history/kl-history';
import { ERASE_COLOR } from './erase-color';

export interface IChemyBrushHistoryEntry extends IHistoryEntry {
    tool: ['brush', 'ChemyBrush'];
    actions: THistoryInnerActions<ChemyBrush>[];
}

type TChemyMode = 'fill' | 'stroke';

export class ChemyBrush {
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private settingColor: IRGB = {} as IRGB;
    private settingSize: number = 0.25; // radius - 0.5 - 99999
    private settingOpacity: number = 1; // 0-1
    private settingLockLayerAlpha: boolean = false;
    private settingIsEraser: boolean = false;
    private settingMode: TChemyMode = 'fill';
    private settingDistort: number = 0; // 0 - 1
    private settingXSymmetry: boolean = false;
    private settingYSymmetry: boolean = false;
    private settingGradient: boolean = false;

    private isDrawing: boolean = false;

    private history: KlHistory | undefined;

    private copyCanvas: HTMLCanvasElement = {} as HTMLCanvasElement;
    private path: { x: number; y: number }[] = [];
    private minY: number = 0;
    private maxY: number = 0;
    private completeRedrawBounds: IBounds | undefined;

    private updateCompleteRedrawBounds(x: number, y: number): void {
        let bounds = { x1: x, y1: y, x2: x, y2: y };
        if (this.settingXSymmetry) {
            bounds = BB.updateBounds(bounds, {
                x1: -x + this.copyCanvas.width,
                y1: y,
                x2: -x + this.copyCanvas.width,
                y2: y,
            });
        }
        if (this.settingYSymmetry) {
            bounds = BB.updateBounds(bounds, {
                x1: x,
                y1: -y + this.copyCanvas.height,
                x2: x,
                y2: -y + this.copyCanvas.height,
            });
        }
        const buffer = this.settingMode === 'stroke' ? this.settingSize + 1 : 1;
        bounds.x1 = Math.floor(bounds.x1 - buffer);
        bounds.y1 = Math.floor(bounds.y1 - buffer);
        bounds.x2 = Math.ceil(bounds.x2 + buffer);
        bounds.y2 = Math.ceil(bounds.y2 + buffer);

        this.completeRedrawBounds = BB.updateBounds(this.completeRedrawBounds, bounds);
    }

    private drawShape(): void {
        this.context.save();
        this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        this.context.drawImage(this.copyCanvas, 0, 0);

        const color = { ...this.settingColor };
        if (this.settingIsEraser) {
            color.r = ERASE_COLOR;
            color.g = ERASE_COLOR;
            color.b = ERASE_COLOR;
            if (this.settingLockLayerAlpha) {
                this.context.globalCompositeOperation = 'source-atop';
            } else {
                this.context.globalCompositeOperation = 'destination-out';
            }
        } else {
            if (this.settingLockLayerAlpha) {
                this.context.globalCompositeOperation = 'source-atop';
            }
        }

        if (this.path.length > 1) {
            // path
            const path = new Path2D();
            this.path.forEach((item, index) => {
                if (index === 0) {
                    path.moveTo(item.x, item.y);
                } else {
                    path.lineTo(item.x, item.y);
                }
            });

            let style: string | CanvasGradient = BB.ColorConverter.toRgbaStr({
                r: color.r,
                g: color.g,
                b: color.b,
                a: this.settingOpacity,
            });
            if (this.settingGradient) {
                const startAtTop = this.path[0].x > this.path[this.path.length - 1].x;
                const gradient = this.context.createLinearGradient(
                    0,
                    startAtTop ? this.minY : this.maxY,
                    0,
                    startAtTop ? this.maxY : this.minY,
                );
                gradient.addColorStop(
                    0,
                    BB.ColorConverter.toRgbaStr({
                        r: color.r,
                        g: color.g,
                        b: color.b,
                        a: this.settingOpacity,
                    }),
                );
                gradient.addColorStop(
                    1,
                    BB.ColorConverter.toRgbaStr({
                        r: color.r,
                        g: color.g,
                        b: color.b,
                        a: 0,
                    }),
                );
                style = gradient;
            }

            // setup params
            if (this.settingMode === 'fill') {
                this.context.fillStyle = style;
            } else {
                this.context.lineWidth = this.settingSize * 2;
                this.context.lineJoin = 'bevel';
                this.context.strokeStyle = style;
            }

            // draw
            const draw = () => {
                if (this.settingMode === 'fill') {
                    this.context.fill(path);
                } else {
                    this.context.stroke(path);
                }
            };

            draw();
            if (this.settingXSymmetry) {
                this.context.save();
                this.context.translate(this.context.canvas.width / 2, 0);
                this.context.scale(-1, 1);
                this.context.translate(-this.context.canvas.width / 2, 0);
                draw();
                this.context.restore();
            }
            if (this.settingYSymmetry) {
                this.context.save();
                this.context.translate(0, this.context.canvas.height / 2);
                this.context.scale(1, -1);
                this.context.translate(0, -this.context.canvas.height / 2);
                draw();
                this.context.restore();
                if (this.settingXSymmetry) {
                    this.context.save();
                    this.context.translate(
                        this.context.canvas.width / 2,
                        this.context.canvas.height / 2,
                    );
                    this.context.scale(-1, -1);
                    this.context.translate(
                        -this.context.canvas.width / 2,
                        -this.context.canvas.height / 2,
                    );
                    draw();
                    this.context.restore();
                }
            }
        }

        this.context.restore();
    }

    // ----------------------------------- public -----------------------------------
    constructor() {}

    setHistory(h: KlHistory): void {
        this.history = h;
    }

    getSize(): number {
        return this.settingMode === 'stroke' ? this.settingSize : 0;
    }

    setSize(s: number): void {
        this.settingSize = s;
    }

    getOpacity(): number {
        return this.settingOpacity;
    }

    setOpacity(o: number): void {
        this.settingOpacity = o;
    }

    setColor(c: IRGB): void {
        this.settingColor = BB.copyObj(c);
    }

    setContext(c: CanvasRenderingContext2D) {
        this.context = c;
    }

    setMode(mode: TChemyMode): void {
        this.settingMode = mode;
    }

    getMode(): TChemyMode {
        return this.settingMode;
    }

    setDistort(distort: number): void {
        this.settingDistort = BB.clamp(distort, 0, 1);
    }

    getDistort(): number {
        return this.settingDistort;
    }

    setXSymmetry(b: boolean): void {
        this.settingXSymmetry = b;
    }

    getXSymmetry(): boolean {
        return this.settingXSymmetry;
    }

    setYSymmetry(b: boolean): void {
        this.settingYSymmetry = b;
    }

    getYSymmetry(): boolean {
        return this.settingYSymmetry;
    }

    setGradient(b: boolean): void {
        this.settingGradient = b;
    }

    getGradient(): boolean {
        return this.settingGradient;
    }

    getLockAlpha(): boolean {
        return this.settingLockLayerAlpha;
    }

    setLockAlpha(b: boolean): void {
        this.settingLockLayerAlpha = b;
    }

    getIsEraser(): boolean {
        return this.settingIsEraser;
    }

    setIsEraser(b: boolean): void {
        this.settingIsEraser = b;
    }

    getIsDrawing(): boolean {
        return this.isDrawing;
    }

    startLine(x: number, y: number): void {
        this.isDrawing = true;
        this.path = [{ x, y }];
        this.minY = y;
        this.maxY = y;
        this.copyCanvas = BB.canvas(this.context.canvas.width, this.context.canvas.height);
        BB.ctx(this.copyCanvas).drawImage(this.context.canvas, 0, 0);
        this.completeRedrawBounds = undefined;
        this.updateCompleteRedrawBounds(x, y);
    }

    goLine(x: number, y: number): void {
        if (!this.isDrawing) {
            return;
        }

        const pos = { x, y };
        if (this.settingDistort > 0) {
            pos.x += (Math.random() - 0.5) * this.settingDistort * 80;
            pos.y += (Math.random() - 0.5) * this.settingDistort * 80;
        }

        this.minY = Math.min(this.minY, pos.y);
        this.maxY = Math.max(this.maxY, pos.y);
        this.path.push(pos);
        this.updateCompleteRedrawBounds(x, y);
        this.drawShape();
    }

    endLine(): void {
        this.isDrawing = false;
        this.completeRedrawBounds = BB.boundsInArea(
            this.completeRedrawBounds,
            this.copyCanvas.width,
            this.copyCanvas.height,
        );
        if (this.path.length > 1 && this.completeRedrawBounds) {
            const historyCanvas = BB.canvas(
                this.completeRedrawBounds.x2 - this.completeRedrawBounds.x1 + 1,
                this.completeRedrawBounds.y2 - this.completeRedrawBounds.y1 + 1,
            );
            const historyCtx = BB.ctx(historyCanvas);
            historyCtx.drawImage(
                this.context.canvas,
                -this.completeRedrawBounds.x1,
                -this.completeRedrawBounds.y1,
            );

            this.history?.push({
                tool: ['brush', 'ChemyBrush'],
                actions: [
                    {
                        action: 'drawImage',
                        params: [
                            historyCanvas, // faster than getting image data (measured on 2018 lenovo chromebook)
                            this.completeRedrawBounds.x1,
                            this.completeRedrawBounds.y1,
                        ],
                    },
                ],
            } as IChemyBrushHistoryEntry);
        }
        this.path = [];
        this.copyCanvas = {} as HTMLCanvasElement;
    }

    drawImage(im: HTMLCanvasElement, x: number, y: number): void {
        this.context.save();
        this.context.clearRect(x, y, im.width, im.height);
        this.context.drawImage(im, x, y);
        this.context.restore();
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        // might make sense for stroke
    }
}
