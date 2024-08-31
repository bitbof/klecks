import { Options } from '../../ui/components/options';
import { LANG } from '../../../language/language';
import { BB } from '../../../bb/bb';
import { IVector2D } from '../../../bb/bb-types';
import { PointerListener } from '../../../bb/input/pointer-listener';

type TCurvePoint = {
    el: HTMLElement;
    pointerListener: PointerListener;
    setPos: (newX: number, newY: number) => void;
};

export type TCurvesInput = {
    r: [number, number][];
    g: [number, number][];
    b: [number, number][];
};

export function getDefaultCurvesInput(): TCurvesInput {
    return BB.copyObj({
        r: [
            [0, 0],
            [1 / 3, 1 / 3],
            [2 / 3, 2 / 3],
            [1, 1],
        ],
        g: [
            [0, 0],
            [1 / 3, 1 / 3],
            [2 / 3, 2 / 3],
            [1, 1],
        ],
        b: [
            [0, 0],
            [1 / 3, 1 / 3],
            [2 / 3, 2 / 3],
            [1, 1],
        ],
    });
}

export class CurvesInput {
    private readonly rootEl: HTMLElement;
    private readonly p0: TCurvePoint;
    private readonly p1: TCurvePoint;
    private readonly p2: TCurvePoint;
    private readonly p3: TCurvePoint;
    private readonly modeButtons: Options<string>;

    // ----------------------------------- public -----------------------------------
    constructor(p: { curves: TCurvesInput; callback: (val: TCurvesInput) => void }) {
        this.rootEl = BB.el({
            css: {
                position: 'relative',
                marginBottom: '10px',
            },
        });
        this.rootEl.oncontextmenu = () => false;
        let mode = 'All';
        let curves = p.curves;
        this.modeButtons = new Options({
            optionArr: [
                {
                    id: 'All',
                    label: LANG('filter-curves-all'),
                },
                {
                    id: 'Red',
                    label: LANG('red'),
                },
                {
                    id: 'Green',
                    label: LANG('green'),
                },
                {
                    id: 'Blue',
                    label: LANG('blue'),
                },
            ],
            initId: 'All',
            onChange: (id) => {
                mode = id;
                if (mode === 'All') {
                    curves = getDefaultCurvesInput();
                }
                let curve = curves.r;
                if (mode === 'Green') {
                    curve = curves.g;
                }
                if (mode === 'Blue') {
                    curve = curves.b;
                }
                this.p0.setPos(0, areaH - curve[0][1] * areaH);
                this.p1.setPos(curve[1][0] * areaW, areaH - curve[1][1] * areaH);
                this.p2.setPos(curve[2][0] * areaW, areaH - curve[2][1] * areaH);
                this.p3.setPos(areaW, areaH - curve[3][1] * areaH);

                update();
            },
        });
        this.rootEl.append(this.modeButtons.getElement());

        const curveArea = BB.el({
            parent: this.rootEl,
            className: 'kl-curves-graph',
            css: {
                position: 'relative',
                marginTop: '10px',
            },
        });

        const areaW = 300,
            areaH = 100;
        const canvas = BB.canvas(areaW, areaH);
        let ctx = BB.ctx(canvas);
        curveArea.append(canvas);

        const fit = (v: number): number => {
            return Math.max(0, Math.min(1, v));
        };

        const createPoint = (
            x: number,
            y: number,
            callback: (p: IVector2D) => void,
            lock?: boolean,
        ): TCurvePoint => {
            const gripSize = 14;
            let internalY = y,
                internalX = x;
            const pointEl = BB.el({
                className: 'kl-curves-graph__grip',
                css: {
                    left: x - gripSize / 2 + 'px',
                    top: y - gripSize / 2 + 'px',
                    width: gripSize + 'px',
                    height: gripSize + 'px',
                    borderRadius: gripSize + 'px',
                },
            });

            const update = () => {
                BB.css(pointEl, {
                    left: x - gripSize / 2 + 'px',
                    top: y - gripSize / 2 + 'px',
                });
            };

            const pointerListener = new BB.PointerListener({
                target: pointEl,
                onPointer: (event) => {
                    event.eventPreventDefault();
                    if (event.type === 'pointerdown') {
                        internalX = x;
                        internalY = y;
                    }
                    if (event.button === 'left' && event.type === 'pointermove') {
                        if (!lock) {
                            internalX += event.dX;
                        }
                        x = Math.max(0, Math.min(areaW, internalX));
                        internalY += event.dY;
                        y = Math.max(0, Math.min(areaH, internalY));
                        update();
                        callback({
                            x: x,
                            y: y,
                        });
                    }
                },
            });

            curveArea.append(pointEl);

            const setPos = (newX: number, newY: number): void => {
                x = newX;
                y = newY;
                internalY = y;
                internalX = x;
                BB.css(pointEl, {
                    left: x - gripSize / 2 + 'px',
                    top: y - gripSize / 2 + 'px',
                });
            };

            return {
                el: pointEl,
                setPos,
                pointerListener,
            };
        };

        const updateControl = (i: number, x: number, y: number) => {
            if (mode === 'All') {
                curves.r[i] = [fit(x / areaW), fit(1 - y / areaH)];
                curves.g[i] = [fit(x / areaW), fit(1 - y / areaH)];
                curves.b[i] = [fit(x / areaW), fit(1 - y / areaH)];
            }
            if (mode === 'Red') {
                curves.r[i] = [fit(x / areaW), fit(1 - y / areaH)];
            }
            if (mode === 'Green') {
                curves.g[i] = [fit(x / areaW), fit(1 - y / areaH)];
            }
            if (mode === 'Blue') {
                curves.b[i] = [fit(x / areaW), fit(1 - y / areaH)];
            }
        };

        this.p0 = createPoint(
            0,
            areaH,
            (val: IVector2D) => {
                updateControl(0, val.x, val.y);
                update();
            },
            true,
        );
        this.p1 = createPoint(areaW / 3, (areaH / 3) * 2, (val: IVector2D) => {
            updateControl(1, val.x, val.y);
            update();
        });
        this.p2 = createPoint((areaW / 3) * 2, areaH / 3, (val: IVector2D) => {
            updateControl(2, val.x, val.y);
            update();
        });
        this.p3 = createPoint(
            areaW,
            0,
            (val: IVector2D) => {
                updateControl(3, val.x, val.y);
                update();
            },
            true,
        );

        const update = () => {
            ctx = BB.ctx(canvas);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const outCurves: TCurvesInput = {
                r: [],
                g: [],
                b: [],
            };
            for (let i = 0; i < curves.r.length; i++) {
                outCurves.r.push(curves.r[i]);
                outCurves.g.push(curves.g[i]);
                outCurves.b.push(curves.b[i]);
            }

            const drawCurve = (curve: [number, number][]) => {
                ctx.beginPath();
                const spline = new BB.SplineInterpolator(curve);
                for (let i = 0; i < 100; i++) {
                    let y = spline.interpolate(i / 100);
                    y = Math.max(0, Math.min(1, y));

                    if (i === 0) {
                        ctx.moveTo((i / 100) * areaW, areaH - y * areaH);
                    } else {
                        ctx.lineTo((i / 100) * areaW, areaH - y * areaH);
                    }
                }
                ctx.stroke();
            };

            ctx.save();
            if (mode === 'All') {
                ctx.strokeStyle = 'black';
                drawCurve(outCurves.r);
            } else {
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = 'red';
                drawCurve(outCurves.r);
                ctx.strokeStyle = 'green';
                drawCurve(outCurves.g);
                ctx.strokeStyle = 'blue';
                drawCurve(outCurves.b);
            }
            ctx.restore();
            p.callback(outCurves);
        };

        update();
    }

    // ---- interface ----
    getElement(): HTMLElement {
        return this.rootEl;
    }

    getModeButtons(): Options<string> {
        return this.modeButtons;
    }

    destroy(): void {
        this.p0.pointerListener.destroy();
        this.p1.pointerListener.destroy();
        this.p2.pointerListener.destroy();
        this.p3.pointerListener.destroy();
    }
}
