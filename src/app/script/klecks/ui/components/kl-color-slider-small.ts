import { BB } from '../../../bb/bb';
import { calcSliderFalloffFactor } from './slider-falloff';
import { IRGB } from '../../kl-types';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { HSV } from '../../../bb/color/color';

/**
 * a small color slider
 */
export class KlColorSliderSmall {
    private readonly rootEl: HTMLElement;
    private color: HSV;
    private readonly svPointerListener: PointerListener;
    private readonly hPointerListener: PointerListener;
    private svPointerId: number | null;
    private hPointerId: number | null;
    private readonly width: number;
    private readonly heightSV: number;
    private readonly pointerSV: HTMLElement;
    private readonly pointerH: HTMLElement;
    private readonly canvasSV: HTMLCanvasElement;

    private updateSV(): void {
        const ctx = BB.ctx(this.canvasSV);
        if (!ctx) {
            throw new Error('couldnt create canvas');
        }
        for (let i = 0; i < this.canvasSV.height; i += 1) {
            const gradient1 = ctx.createLinearGradient(0, 0, this.canvasSV.width, 0);

            const colleft = BB.ColorConverter.toRGB(
                new BB.HSV(this.color.h, 1, 100 - (i / this.canvasSV.height) * 100.0),
            );
            const colright = BB.ColorConverter.toRGB(
                new BB.HSV(this.color.h, 100, 100 - (i / this.canvasSV.height) * 100.0),
            );
            gradient1.addColorStop(0, '#' + BB.ColorConverter.toHexString(colleft));
            gradient1.addColorStop(1, '#' + BB.ColorConverter.toHexString(colright));
            ctx.fillStyle = '#ff0000'; //needed for chrome...otherwise alpha problem
            ctx.fillStyle = gradient1;
            ctx.fillRect(0, i, this.canvasSV.width, 1);
        }
    }

    private updateSVPointer(): void {
        const left = (this.color.s / 100) * this.width - 4;
        const top = (1 - this.color.v / 100) * this.heightSV - 4;
        BB.css(this.pointerSV, {
            left: left + 'px',
            top: top + 'px',
        });
    }

    private updateHPointer(): void {
        this.pointerH.style.left = (this.color.h / 359.999) * this.width - 1 + 'px';
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        width: number;
        heightSV: number; // height of saturation/value
        heightH: number; // height of hue
        color: IRGB;
        callback: (c: IRGB) => void;
    }) {
        this.rootEl = BB.el({
            css: {
                width: p.width + 'px',
                position: 'relative',
                overflow: 'hidden',
                userSelect: 'none',
            },
        });
        this.rootEl.oncontextmenu = (e) => {
            e.preventDefault();
        };
        this.color = BB.ColorConverter.toHSV(new BB.RGB(p.color.r, p.color.g, p.color.b));
        this.width = p.width;
        this.heightSV = p.heightSV;

        this.canvasSV = BB.canvas(10, 10);
        BB.css(this.canvasSV, {
            width: this.width + 'px',
            height: this.heightSV + 'px',
            cursor: 'crosshair',
        });

        this.updateSV();

        const canvasH = BB.canvas(p.width, p.heightH);
        canvasH.style.cursor = 'ew-resize';
        (() => {
            const ctx = BB.ctx(canvasH);

            const gradH = ctx.createLinearGradient(0, 0, p.width, 0);
            for (let i = 0; i < 1; i += 0.01) {
                const col = BB.ColorConverter.toRGB(new BB.HSV(i * 360, 100, 100));
                gradH.addColorStop(
                    i,
                    'rgba(' +
                        parseInt('' + col.r) +
                        ', ' +
                        parseInt('' + col.g) +
                        ', ' +
                        parseInt('' + col.b) +
                        ', 1)',
                );
            }
            ctx.fillStyle = gradH;
            ctx.fillRect(0, 0, p.width, p.heightH);
        })();
        BB.css(this.canvasSV, {
            width: p.width + 'px',
            height: p.heightSV + 'px',
            overflow: 'hidden',
            position: 'relative',
        });
        this.canvasSV.style.cssFloat = 'left';
        canvasH.style.cssFloat = 'left';

        this.rootEl.append(this.canvasSV, canvasH);

        this.pointerSV = BB.el({
            parent: this.rootEl,
            css: {
                width: '8px',
                height: '8px',
                borderRadius: '8px',
                position: 'absolute',
                pointerEvents: 'none',
                boxShadow: '0 0 0 1px #000, inset 0 0 0 1px #fff',
            },
        });

        this.pointerH = BB.el({
            parent: this.rootEl,
            css: {
                width: '0',
                height: p.heightH + 'px',
                borderLeft: '1px solid #fff',
                borderRight: '1px solid #000',
                position: 'absolute',
                top: p.heightSV + 'px',
                pointerEvents: 'none',
            },
        });

        this.updateSVPointer();
        this.updateHPointer();

        const virtualHSV = {
            h: 0,
            s: 0,
            v: 0,
        };

        this.svPointerId = null;
        this.svPointerListener = new BB.PointerListener({
            target: this.canvasSV,
            fixScribble: true,
            onPointer: (event) => {
                if (event.type === 'pointerdown') {
                    // prevent manual slider input keeping focus on iPad
                    BB.unfocusAnyInput();

                    this.svPointerId = event.pointerId;
                    if (event.button === 'left') {
                        virtualHSV.s = (event.relX / p.width) * 100;
                        virtualHSV.v = 100 - (event.relY / p.heightSV) * 100;

                        this.color = new BB.HSV(this.color.h, virtualHSV.s, virtualHSV.v);

                        this.updateSVPointer();
                        p.callback(BB.ColorConverter.toRGB(this.color));
                    } else {
                        virtualHSV.s = this.color.s;
                        virtualHSV.v = this.color.v;
                    }
                }

                if (
                    event.type === 'pointermove' &&
                    ['left', 'right'].includes('' + event.button) &&
                    this.svPointerId === event.pointerId
                ) {
                    let factor = 1;
                    if (event.button === 'right') {
                        factor = 0.5;
                    }

                    virtualHSV.s += (event.dX / p.width) * 100 * factor;
                    virtualHSV.v -= (event.dY / p.heightSV) * 100 * factor;

                    this.color = new BB.HSV(this.color.h, virtualHSV.s, virtualHSV.v);
                    this.updateSVPointer();
                    p.callback(BB.ColorConverter.toRGB(this.color));
                }
                if (event.type === 'pointerup') {
                    this.svPointerId = null;
                }
            },
        });

        this.hPointerId = null;
        this.hPointerListener = new BB.PointerListener({
            target: canvasH,
            fixScribble: true,
            onPointer: (event) => {
                if (event.type === 'pointerdown') {
                    this.hPointerId = event.pointerId;
                    if (event.button === 'left') {
                        virtualHSV.h = (event.relX / p.width) * 359.99;

                        this.color = new BB.HSV(virtualHSV.h, this.color.s, this.color.v);
                        this.updateSV();
                        this.updateHPointer();
                        p.callback(BB.ColorConverter.toRGB(this.color));
                    } else {
                        virtualHSV.h = this.color.h;
                    }
                }

                if (
                    event.type === 'pointermove' &&
                    ['left', 'right'].includes('' + event.button) &&
                    this.hPointerId === event.pointerId
                ) {
                    const deltaY = Math.abs(event.pageY - event.downPageY!);
                    const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');

                    virtualHSV.h += (event.dX / p.width) * 359.99 * factor;

                    if (event.button === 'right') {
                        virtualHSV.h = virtualHSV.h % 359.99;
                        if (virtualHSV.h < 0) {
                            virtualHSV.h += 359.99;
                        }
                    }
                    virtualHSV.h = Math.min(359.99, virtualHSV.h);
                    this.color = new BB.HSV(virtualHSV.h, this.color.s, this.color.v);
                    this.updateSV();
                    this.updateHPointer();
                    p.callback(BB.ColorConverter.toRGB(this.color));
                }
                if (event.type === 'pointerup') {
                    this.hPointerId = null;
                }
            },
        });

        const cleardiv = BB.el({
            parent: this.rootEl,
            css: {
                clear: 'both',
            },
        });
    }

    // ---- interface ----
    setColor(c: IRGB): void {
        this.color = BB.ColorConverter.toHSV(new BB.RGB(c.r, c.g, c.b));
        this.updateSV();
        this.updateSVPointer();
        this.updateHPointer();
    }

    getColor(): IRGB {
        return BB.ColorConverter.toRGB(this.color);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    end(): void {
        this.svPointerId = null;
        this.hPointerId = null;
    }

    destroy(): void {
        this.svPointerListener.destroy();
        this.hPointerListener.destroy();
    }
}
