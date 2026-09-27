import { BB } from '../../bb/bb';
import { TPressureInput, TRgb } from '../kl-types';
import { ERASE_COLOR } from './erase-color';
import { KlHistory } from '../history/kl-history';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { intersectBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { TIndexBounds, TVector2D } from '../../bb/bb-types';

type TChemyMode = 'fill' | 'stroke';

// Max distance (px) of a dropped point from the simplified path. Measured as a distance, so points far apart
// need to be closer to a straight line than points close together.
const SIMPLIFY_TOLERANCE = 0.25;
// Limits cost of checking dropped points on long straight lines
const MAX_DROPPED_POINTS = 64;

function distToSegment(p: TVector2D, a: TVector2D, b: TVector2D): number {
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const lenSq = abX * abX + abY * abY;
    const t = lenSq === 0 ? 0 : BB.clamp(((p.x - a.x) * abX + (p.y - a.y) * abY) / lenSq, 0, 1);
    return BB.dist(p.x, p.y, a.x + abX * t, a.y + abY * t);
}

export class ChemyBrush {
    private context: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
    private settingColor: TRgb = {} as TRgb;
    private settingSize: number = 0.25; // radius - 0.5 - 99999
    private settingOpacity: number = 1; // 0-1
    private settingLockLayerAlpha: boolean = false;
    private settingIsEraser: boolean = false;
    private settingMode: TChemyMode = 'fill';
    private settingXSymmetry: boolean = false;
    private settingYSymmetry: boolean = false;
    private settingGradient: boolean = false;

    private isDrawing: boolean = false;

    private klHistory: KlHistory = {} as KlHistory;

    private copyCanvas: HTMLCanvasElement = {} as HTMLCanvasElement;
    // simplified path. Excludes the latest point, which is not settled yet.
    private path: TVector2D[] = [];
    private latestPoint: TVector2D | undefined;
    // points dropped since the last point of path
    private droppedPoints: TVector2D[] = [];
    private minY: number = 0;
    private maxY: number = 0;
    private completeRedrawBounds: TIndexBounds | undefined;

    private selection: MultiPolygon | undefined;
    private selectionPath: Path2D | undefined;
    private selectionBounds: TIndexBounds | undefined;

    private updateCompleteRedrawBounds(x: number, y: number): void {
        let bounds: TIndexBounds = { type: 'index', x1: x, y1: y, x2: x, y2: y };
        if (this.settingXSymmetry) {
            bounds = BB.updateBounds(bounds, {
                type: 'index',
                x1: -x + this.copyCanvas.width,
                y1: y,
                x2: -x + this.copyCanvas.width,
                y2: y,
            });
        }
        if (this.settingYSymmetry) {
            bounds = BB.updateBounds(bounds, {
                type: 'index',
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

    /**
     * Adds point to path, while dropping points that would barely change the shape.
     * The latest point is kept separate, because whether it can be dropped depends on the next point.
     */
    private addPoint(point: TVector2D): void {
        if (this.latestPoint) {
            const anchor = this.path.at(-1)!;
            const canDrop =
                this.droppedPoints.length < MAX_DROPPED_POINTS &&
                distToSegment(this.latestPoint, anchor, point) <= SIMPLIFY_TOLERANCE &&
                this.droppedPoints.every(
                    (dropped) => distToSegment(dropped, anchor, point) <= SIMPLIFY_TOLERANCE,
                );
            if (canDrop) {
                this.droppedPoints.push(this.latestPoint);
            } else {
                this.path.push(this.latestPoint);
                this.droppedPoints = [];
            }
        }
        this.latestPoint = point;
    }

    private getDrawnPath(): TVector2D[] {
        return this.latestPoint ? [...this.path, this.latestPoint] : this.path;
    }

    private drawShape(): void {
        this.context.save();
        this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        this.context.drawImage(this.copyCanvas, 0, 0);
        this.selectionPath && this.context.clip(this.selectionPath);

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

        const drawnPath = this.getDrawnPath();
        if (drawnPath.length > 1) {
            // path
            const path = new Path2D();
            drawnPath.forEach((item, index) => {
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
                const startAtTop = drawnPath[0].x > drawnPath.at(-1)!.x;
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

    setHistory(klHistory: KlHistory): void {
        this.klHistory = klHistory;
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

    setColor(c: TRgb): void {
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
        this.selection = this.klHistory.getComposed().selection.value;
        this.selectionPath = this.selection ? getSelectionPath2d(this.selection) : undefined;
        this.selectionBounds = this.selection
            ? getMultiPolyBounds(this.selection, 'index')
            : undefined;
        this.isDrawing = true;
        this.path = [{ x, y }];
        this.latestPoint = undefined;
        this.droppedPoints = [];
        this.minY = y;
        this.maxY = y;
        this.copyCanvas = BB.canvas(this.context.canvas.width, this.context.canvas.height);
        BB.ctx(this.copyCanvas).drawImage(this.context.canvas, 0, 0);
        this.completeRedrawBounds = undefined;
        this.updateCompleteRedrawBounds(x, y);
    }

    goLine(points: TPressureInput[]): void {
        if (!this.isDrawing) {
            return;
        }

        points.forEach(({ x, y }) => {
            this.minY = Math.min(this.minY, y);
            this.maxY = Math.max(this.maxY, y);
            this.addPoint({ x, y });
            this.updateCompleteRedrawBounds(x, y);
        });
        this.drawShape();
    }

    endLine(): void {
        this.isDrawing = false;
        this.completeRedrawBounds = BB.indexBoundsInArea(
            this.completeRedrawBounds,
            this.copyCanvas.width,
            this.copyCanvas.height,
        );
        if (this.selectionBounds) {
            this.completeRedrawBounds = intersectBounds(
                this.completeRedrawBounds,
                this.selectionBounds,
            );
        }
        if (this.getDrawnPath().length > 1 && this.completeRedrawBounds) {
            const layerData = canvasToLayerTiles(this.context.canvas, this.completeRedrawBounds);
            this.klHistory.push(getPushableLayerChange(this.klHistory.getComposed(), layerData));
        }
        this.path = [];
        this.latestPoint = undefined;
        this.droppedPoints = [];
        this.copyCanvas = {} as HTMLCanvasElement;
    }

    drawLineSegment(x1: number, y1: number, x2: number, y2: number): void {
        // might make sense for stroke
    }
}
