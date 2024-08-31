import { BB } from '../../../bb/bb';
import { PointerListener } from '../../../bb/input/pointer-listener';

/**
 * A slider that looks like this
 * ------O----
 */
export class PointSlider {
    private readonly rootEl: HTMLElement;
    private readonly sliderPoint: HTMLElement;
    private readonly pointerListener: PointerListener;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        init: number;
        width: number;
        pointSize: number;
        callback: (value: number, isFirst: boolean, isLast: boolean) => void;
    }) {
        this.rootEl = BB.el({
            css: {
                position: 'relative',
            },
        });
        const sliderLine = BB.el({
            parent: this.rootEl,
            className: 'kl-point-slider__line',
            css: {
                marginTop: parseInt('' + (p.pointSize / 2 - 1)) + 'px',
                width: p.width + 'px',
            },
        });
        this.sliderPoint = BB.el({
            parent: this.rootEl,
            className: 'kl-point-slider__point',
        });
        let sliderPos: number;
        let isDragging = false;

        //sliderPoint
        const touchAreaEl = BB.el({
            // expand clickable area
            parent: this.sliderPoint,
            css: {
                // background: 'rgba(255,0,0,0.4)',
                margin: '-7px 0 0 -7px',
                width: 'calc(100% + 14px)',
                height: 'calc(100% + 7px)',
            },
        });

        const redrawPoint = () => {
            BB.css(this.sliderPoint, {
                left: sliderPos + 'px',
            });
        };
        const getValue = () => {
            return sliderPos / (p.width - p.pointSize);
        };

        {
            let isFirst: boolean;
            sliderPos = BB.clamp(p.init * (p.width - p.pointSize), 0, p.width - p.pointSize);
            BB.css(this.sliderPoint, {
                width: p.pointSize + 'px',
                height: p.pointSize + 'px',
                borderRadius: p.pointSize + 'px',
            });
            redrawPoint();
            let imaginaryPos: number;
            this.pointerListener = new BB.PointerListener({
                target: this.sliderPoint,
                fixScribble: true,
                onPointer: (event): void => {
                    if (event.type === 'pointerdown' && event.button === 'left') {
                        isFirst = true;
                        isDragging = true;
                        imaginaryPos = sliderPos;
                        redrawPoint();
                        event.eventStopPropagation();
                    } else if (event.type === 'pointermove' && event.button === 'left') {
                        event.eventStopPropagation();
                        imaginaryPos = imaginaryPos + event.dX;
                        sliderPos = parseInt('' + BB.clamp(imaginaryPos, 0, p.width - p.pointSize));
                        redrawPoint();
                        p.callback(getValue(), isFirst, false);
                        isFirst = false;
                    }
                    if (event.type === 'pointerup') {
                        event.eventStopPropagation();
                        isDragging = false;
                        redrawPoint();
                        p.callback(getValue(), false, true);
                    }
                },
            });
        }
    }

    // ---- interface ----

    getEl(): HTMLElement {
        return this.rootEl;
    }

    setActive(isActive: boolean): void {
        this.sliderPoint.style.backgroundColor = isActive ? '#fff' : '#eaeaea';
    }

    destroy(): void {
        this.pointerListener.destroy();
    }
}
