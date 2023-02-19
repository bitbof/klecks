import {BB} from '../../bb/bb';
import {IHistoryEntry, KlHistoryInterface, THistoryInnerActions} from '../history/kl-history';
import {KL} from '../kl';
import {IRGB, TPressureInput} from '../kl-types';

export interface ISketchyBrushHistoryEntry extends IHistoryEntry {
    tool: ['brush', 'SketchyBrush'];
    actions: THistoryInnerActions<SketchyBrush>[];
}

const sampleCanvas = BB.canvas(32, 32);
const sampleCtx = BB.ctx(sampleCanvas);

export class SketchyBrush {

    private context: CanvasRenderingContext2D;
    private settingColor: IRGB;
    private settingSize: number = 1;
    private settingOpacity: number = 0.2;
    private settingBlending: number = 0.5;
    private settingScale: number = 1;
    private lastX: number = 0;
    private lastY: number = 0;
    private inputIsDrawing: boolean = false;
    private lastInput: TPressureInput = {x: 0, y: 0, pressure: 0};
    private history: KlHistoryInterface = new KL.DecoyKlHistory();
    private historyEntry: ISketchyBrushHistoryEntry | undefined;
    private sketchySeed: number = 0;
    private points: [number, number][] = []; // x y
    private count: number = 0;
    private readonly mixmode = [
        (c1: IRGB, c2: IRGB) => {
            return c1;
        },
        (c1: IRGB, c2: IRGB) => { // why
            const result = new BB.RGB(c1.r, c1.g, c1.b);
            result.r *= c2.r / 255;
            result.g *= c2.g / 255;
            result.b *= c2.b / 255;
            return result;
        },
    ];


    private rand (): number {
        this.sketchySeed++;
        return Math.sin(6324634.2345 * Math.cos(this.sketchySeed * 5342.3423)) * 0.5 + 0.5;
    }

    // ---- public ----
    constructor () {}

    // ---- interface ----

    setHistory (l: KlHistoryInterface): void {
        this.history = l;
    }

    setSeed (s: number): void {
        this.sketchySeed = parseInt('' + s);
    }

    getSeed (): number {
        return parseInt('' + this.sketchySeed);
    }

    getSize (): number {
        return this.settingSize / 2;
    }

    setColor (c: IRGB): void {
        this.settingColor = c;
    }

    getOpacity (): number {
        return this.settingOpacity;
    }

    setOpacity (o: number): void {
        this.settingOpacity = o;
    }

    getBlending (): number {
        return this.settingBlending;
    }

    setBlending (b: number): void {
        this.settingBlending = b;
    }

    setSize (s: number): void {
        this.settingSize = s * 2;
    }

    getScale (): number {
        return this.settingScale;
    }

    setScale (s: number): void {
        this.settingScale = s;
    }

    setContext (c: CanvasRenderingContext2D): void {
        this.context = c;
    }

    startLine (x: number, y: number, pressure: number, shift?: boolean): void {
        if (shift && this.lastInput.x) {
            this.inputIsDrawing = true;
            this.endLine();
        } else {
            this.inputIsDrawing = true;
            this.lastX = x;
            this.lastY = y;
            this.lastInput.x = x;
            this.lastInput.y = y;
            this.historyEntry = {
                tool: ['brush', 'SketchyBrush'],
                actions: [
                    {
                        action: 'setScale',
                        params: [this.settingScale],
                    },
                    {
                        action: 'setSize',
                        params: [this.settingSize / 2],
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
                        action: 'setBlending',
                        params: [this.settingBlending],
                    },
                    {
                        action: 'startLine',
                        params: [x, y, pressure],
                    },
                ],
            };
        }

    }

    goLine (p_x: number, p_y: number, pressure: number, preMixedColor: IRGB): void {
        if (!this.inputIsDrawing || (p_x === this.lastInput.x && p_y === this.lastInput.y)) {
            return;
        }

        let e, b, a, g;
        const x = parseInt('' + p_x);
        const y = parseInt('' + p_y);
        this.points.push([x, y]);

        let mixr = this.settingColor.r;
        let mixg = this.settingColor.g;
        let mixb = this.settingColor.b;

        if (preMixedColor !== null) {
            mixr = preMixedColor.r;
            mixg = preMixedColor.g;
            mixb = preMixedColor.b;
        } else {
            if (this.settingBlending !== 0) {
                if (x + 5 >= 0 && y + 5 >= 0 && x - 5 < this.context.canvas.width - 1 && y - 5 < this.context.canvas.height - 1) {
                    mixr = 0;
                    mixg = 0;
                    mixb = 0;
                    const mixx = Math.min(this.context.canvas.width - 1, Math.max(0, x - 5));
                    const mixy = Math.min(this.context.canvas.height - 1, Math.max(0, y - 5));
                    let mixw = Math.min(this.context.canvas.width - 1, Math.max(0, x + 5));
                    let mixh = Math.min(this.context.canvas.height - 1, Math.max(0, y + 5));
                    mixw -= mixx;
                    mixh -= mixy;

                    if (mixw > 0 && mixh > 0) {
                        const imdat = this.context.getImageData(mixx, mixy, mixw, mixh);
                        let countmix = 0;
                        for (let i = 0; i < imdat.data.length; i += 4) {
                            mixr += imdat.data[i + 0];
                            mixg += imdat.data[i + 1];
                            mixb += imdat.data[i + 2];
                            countmix++;
                        }
                        mixr /= countmix;
                        mixg /= countmix;
                        mixb /= countmix;
                    }

                    const mixed = this.mixmode[0](new BB.RGB(mixr, mixg, mixb), this.settingColor);
                    mixr = parseInt('' + BB.mix(this.settingColor.r, mixed.r, this.settingBlending));
                    mixg = parseInt('' + BB.mix(this.settingColor.g, mixed.g, this.settingBlending));
                    mixb = parseInt('' + BB.mix(this.settingColor.b, mixed.b, this.settingBlending));
                }
            }
        }

        this.context.save();
        this.context.strokeStyle = 'rgba(' + mixr + ', ' + mixg + ', ' + mixb + ', ' + this.settingOpacity + ')';
        this.context.lineWidth = this.settingSize;

        this.context.beginPath();
        this.context.moveTo(this.lastX, this.lastY);
        this.context.lineTo(x, y);

        for (e = 0; e < this.points.length; e++) {
            b = this.points[e][0] - this.points[this.count][0];
            a = this.points[e][1] - this.points[this.count][1];
            g = b * b + a * a;
            if (g < 4000 * this.settingScale * this.settingScale && this.rand() > g / 2000 / this.settingScale / this.settingScale) {
                this.context.moveTo(this.points[this.count][0] + (b * 0.3), this.points[this.count][1] + (a * 0.3));
                this.context.lineTo(this.points[e][0] - (b * 0.3), this.points[e][1] - (a * 0.3));
            }
        }

        this.context.stroke();
        this.context.restore();


        this.count++;
        this.lastX = x;
        this.lastY = y;
        this.lastInput.x = x;
        this.lastInput.y = y;
        this.historyEntry!.actions!.push({
            action: 'goLine',
            params: [p_x, p_y, pressure, {r: mixr, g: mixg, b: mixb}],
        });
    }

    endLine (): void {
        this.inputIsDrawing = false;
        this.count = 0;
        this.points = [];
        if (this.historyEntry) {
            this.historyEntry.actions!.push({
                action: 'endLine',
                params: [],
            });
            this.history.push(this.historyEntry);
            this.historyEntry = undefined;
        }
    }
    //cheap n' ugly

    drawLineSegment (x1: number, y1: number, x2: number, y2: number): void {
        this.lastInput.x = x2;
        this.lastInput.y = y2;

        if (this.inputIsDrawing || x1 === undefined) {
            return;
        }


        this.context.save();
        this.context.lineWidth = this.settingSize;

        let mixr = this.settingColor.r, mixg = this.settingColor.g, mixb = this.settingColor.b;
        if (x1 + 5 >= 0 && y1 + 5 >= 0 && x1 - 5 < this.context.canvas.width - 1 && y1 - 5 < this.context.canvas.height - 1) {
            mixr = 0;
            mixg = 0;
            mixb = 0;
            const mixx = Math.min(this.context.canvas.width - 1, Math.max(0, x1 - 5));
            const mixy = Math.min(this.context.canvas.height - 1, Math.max(0, y1 - 5));
            let mixw = Math.min(this.context.canvas.width - 1, Math.max(0, x1 + 5));
            let mixh = Math.min(this.context.canvas.height - 1, Math.max(0, y1 + 5));
            mixw -= mixx;
            mixh -= mixy;
            if (mixw > 0 && mixh > 0) {
                const w = Math.min(sampleCanvas.width, mixw);
                const h = Math.min(sampleCanvas.height, mixh);
                sampleCtx.save();
                sampleCtx.globalCompositeOperation = 'copy';
                sampleCtx.drawImage(this.context.canvas, mixx, mixy, mixw, mixh, 0, 0, w, h);
                sampleCtx.restore();

                const imdat = sampleCtx.getImageData(mixx, mixy, mixw, mixh);
                let countmix = 0;
                for (let i = 0; i < imdat.data.length; i += 4) {
                    mixr += imdat.data[i + 0];
                    mixg += imdat.data[i + 1];
                    mixb += imdat.data[i + 2];
                    countmix++;
                }
                mixr /= countmix;
                mixg /= countmix;
                mixb /= countmix;
            }
        }
        const mixed = this.mixmode[0](new BB.RGB(mixr, mixg, mixb), this.settingColor);
        mixr = parseInt('' + (this.settingBlending * mixed.r + this.settingColor.r * (1 - this.settingBlending)));
        mixg = parseInt('' + (this.settingBlending * mixed.g + this.settingColor.g * (1 - this.settingBlending)));
        mixb = parseInt('' + (this.settingBlending * mixed.b + this.settingColor.b * (1 - this.settingBlending)));
        this.context.strokeStyle = 'rgba(' + mixr + ', ' + mixg + ', ' + mixb + ', ' + this.settingOpacity + ')';
        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.stroke();
        this.context.strokeStyle = 'rgba(' + mixr + ', ' + mixg + ', ' + mixb + ', ' + this.settingOpacity + ')';
        this.context.restore();

        const historyEntry: ISketchyBrushHistoryEntry = {
            tool: ['brush', 'SketchyBrush'],
            actions: [
                {
                    action: 'setScale',
                    params: [this.settingScale],
                },
                {
                    action: 'setSize',
                    params: [this.settingSize / 2],
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
                    action: 'setBlending',
                    params: [this.settingBlending],
                },
                {
                    action: 'drawLineSegment',
                    params: [x1, y1, x2, y2],
                },
            ],
        };
        this.history.push(historyEntry);
    }


    isDrawing (): boolean {
        return this.inputIsDrawing;
    }
}
