import { BB } from '../../../../bb/bb';
import { css } from '../../../../bb/base/base';
import { TRect } from '../../../../bb/bb-types';
import { PointerListener } from '../../../../bb/input/pointer-listener';

export type TResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export type TCropperEvent =
    | { type: 'start' }
    | { type: 'move'; dX: number; dY: number }
    | {
          type: 'resize';
          dX: number;
          dY: number;
          direction: TResizeDirection;
          isSymmetric: boolean;
      };

const directionToCursor: Record<TResizeDirection, string> = {
    n: 'ns-resize',
    ne: 'nesw-resize',
    e: 'ew-resize',
    se: 'nwse-resize',
    s: 'ns-resize',
    sw: 'nesw-resize',
    w: 'ew-resize',
    nw: 'nwse-resize',
};

const resizeDirectionArr = Object.keys(directionToCursor) as TResizeDirection[];

export type TCropperParams = {
    width: number;
    height: number;
    value: TRect;
    processEvent: (change: TCropperEvent) => TRect;
    toRendered: (crop: TRect) => TRect;
    showThirds?: boolean;
    onChange?: (crop: TRect) => void;
};

export class Cropper {
    private readonly rootEl: HTMLDivElement;
    private readonly moveEl: HTMLDivElement;
    private readonly maskElArr: HTMLDivElement[];
    private readonly selectionEl: HTMLDivElement;
    private readonly thirdsElArr: HTMLDivElement[];
    private readonly handleElMap: Record<TResizeDirection, HTMLDivElement>;
    private readonly pointerListenerArr: PointerListener[] = [];
    private readonly processEvent: (change: TCropperEvent) => TRect;
    private readonly toRendered: (crop: TRect) => TRect;
    private readonly onChange: ((crop: TRect) => void) | undefined;

    private width: number;
    private height: number;
    private crop: TRect;
    private readonly handleSize: number = 80;
    private readonly handleInset: number = 15;
    private readonly debugShowHandles: boolean = false;
    private readonly debugShowOverflow: boolean = false;
    private showThirds: boolean;

    /**
     * Clips render geometry to one pixel outside the viewport. The logical crop rect is untouched.
     */
    private clipRect(rect: TRect): TRect {
        const x1 = BB.clamp(rect.x, -1, this.width + 1);
        const y1 = BB.clamp(rect.y, -1, this.height + 1);
        const x2 = BB.clamp(rect.x + rect.width, -1, this.width + 1);
        const y2 = BB.clamp(rect.y + rect.height, -1, this.height + 1);

        return {
            x: x1,
            y: y1,
            width: Math.max(0, x2 - x1),
            height: Math.max(0, y2 - y1),
        };
    }

    private postProcessRenderedCrop(rect: TRect): TRect {
        const result = { ...rect };
        // align with viewport pixels
        const x1 = Math.round(result.x);
        const y1 = Math.round(result.y);
        const x2 = Math.round(result.x + result.width);
        const y2 = Math.round(result.y + result.height);
        result.x = x1;
        result.y = y1;
        result.width = x2 - x1;
        result.height = y2 - y1;
        // min size 2x2
        if (result.width < 2) {
            result.x -= Math.ceil((2 - result.width) / 2);
            result.width = 2;
        }
        if (result.height < 2) {
            result.y -= Math.ceil((2 - result.height) / 2);
            result.height = 2;
        }
        return result;
    }

    private setElementRect(el: HTMLElement, rect: TRect): void {
        css(el, {
            left: rect.x + 'px',
            top: rect.y + 'px',
            width: Math.max(0, rect.width) + 'px',
            height: Math.max(0, rect.height) + 'px',
        });
    }

    private setClippedElementRect(el: HTMLElement, rect: TRect): void {
        this.setElementRect(el, this.clipRect(rect));
    }

    private updatePointerEvents(activeEl: HTMLElement | undefined): void {
        [this.moveEl, ...Object.values(this.handleElMap)].forEach((el) => {
            el.style.pointerEvents = activeEl === undefined || el === activeEl ? '' : 'none';
        });
    }

    private processAndApply(event: TCropperEvent): void {
        this.crop = this.processEvent(event);
        this.onChange?.({ ...this.crop });
        this.render();
    }

    protected render(): void {
        css(this.rootEl, {
            width: this.width + 'px',
            height: this.height + 'px',
            overflow: this.debugShowOverflow ? 'visible' : 'hidden',
        });

        const renderedCrop = this.postProcessRenderedCrop(this.toRendered(this.crop));
        const renderCropRect = this.clipRect(renderedCrop);
        const x1 = Math.max(0, renderCropRect.x);
        const y1 = Math.max(0, renderCropRect.y);
        const x2 = Math.min(this.width, renderCropRect.x + renderCropRect.width);
        const y2 = Math.min(this.height, renderCropRect.y + renderCropRect.height);

        if (x2 <= x1 || y2 <= y1) {
            this.setElementRect(this.maskElArr[0], {
                x: 0,
                y: 0,
                width: this.width,
                height: this.height,
            });
            this.maskElArr.slice(1).forEach((el) => {
                this.setElementRect(el, { x: 0, y: 0, width: 0, height: 0 });
            });
        } else {
            this.setElementRect(this.maskElArr[0], {
                x: 0,
                y: 0,
                width: this.width,
                height: y1,
            });
            this.setElementRect(this.maskElArr[1], {
                x: 0,
                y: y2,
                width: this.width,
                height: this.height - y2,
            });
            this.setElementRect(this.maskElArr[2], {
                x: 0,
                y: y1,
                width: x1,
                height: y2 - y1,
            });
            this.setElementRect(this.maskElArr[3], {
                x: x2,
                y: y1,
                width: this.width - x2,
                height: y2 - y1,
            });
        }

        this.setElementRect(this.moveEl, renderCropRect);
        this.setElementRect(this.selectionEl, renderCropRect);

        resizeDirectionArr.forEach((direction) => {
            const el = this.handleElMap[direction];
            el.style.background = this.debugShowHandles
                ? direction.length === 2
                    ? 'rgba(0, 128, 0, 0.5)'
                    : 'rgba(0, 0, 255, 0.5)'
                : 'transparent';
        });

        this.thirdsElArr.forEach((el) => {
            el.style.display = this.showThirds ? 'block' : 'none';
        });

        const thirdsRectArr: TRect[] = [
            {
                x: renderedCrop.x + renderedCrop.width / 3,
                y: renderedCrop.y,
                width: 1,
                height: renderedCrop.height,
            },
            {
                x: renderedCrop.x + (renderedCrop.width * 2) / 3,
                y: renderedCrop.y,
                width: 1,
                height: renderedCrop.height,
            },
            {
                x: renderedCrop.x,
                y: renderedCrop.y + renderedCrop.height / 3,
                width: renderedCrop.width,
                height: 1,
            },
            {
                x: renderedCrop.x,
                y: renderedCrop.y + (renderedCrop.height * 2) / 3,
                width: renderedCrop.width,
                height: 1,
            },
        ];
        this.thirdsElArr.forEach((el, index) => {
            this.setClippedElementRect(el, thirdsRectArr[index]);
        });

        const sourceRect = renderedCrop;
        const outward = this.handleSize - this.handleInset;
        // limit inward, for better usability (easier to move small crop) and prevent overlap
        const insetX = Math.min(this.handleInset, Math.max(0, sourceRect.width - 50));
        const insetY = Math.min(this.handleInset, Math.max(0, sourceRect.height - 50));
        const handleRectMap: Record<TResizeDirection, TRect> = {
            nw: {
                x: sourceRect.x - outward,
                y: sourceRect.y - outward,
                width: outward + insetX,
                height: outward + insetY,
            },
            n: {
                x: sourceRect.x + insetX,
                y: sourceRect.y - outward,
                width: sourceRect.width - insetX * 2,
                height: outward + insetY,
            },
            ne: {
                x: sourceRect.x + sourceRect.width - insetX,
                y: sourceRect.y - outward,
                width: outward + insetX,
                height: outward + insetY,
            },
            e: {
                x: sourceRect.x + sourceRect.width - insetX,
                y: sourceRect.y + insetY,
                width: outward + insetX,
                height: sourceRect.height - insetY * 2,
            },
            se: {
                x: sourceRect.x + sourceRect.width - insetX,
                y: sourceRect.y + sourceRect.height - insetY,
                width: outward + insetX,
                height: outward + insetY,
            },
            s: {
                x: sourceRect.x + insetX,
                y: sourceRect.y + sourceRect.height - insetY,
                width: sourceRect.width - insetX * 2,
                height: outward + insetY,
            },
            sw: {
                x: sourceRect.x - outward,
                y: sourceRect.y + sourceRect.height - insetY,
                width: outward + insetX,
                height: outward + insetY,
            },
            w: {
                x: sourceRect.x - outward,
                y: sourceRect.y + insetY,
                width: outward + insetX,
                height: sourceRect.height - insetY * 2,
            },
        };

        resizeDirectionArr.forEach((direction) => {
            this.setClippedElementRect(this.handleElMap[direction], handleRectMap[direction]);
        });
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TCropperParams) {
        this.width = p.width;
        this.height = p.height;
        this.processEvent = p.processEvent;
        this.toRendered = p.toRendered;
        this.crop = { ...p.value };
        this.showThirds = p.showThirds ?? false;
        this.onChange = p.onChange;

        this.rootEl = BB.el({
            css: {
                position: 'relative',
                touchAction: 'none',
                userSelect: 'none',
            },
        });

        this.maskElArr = Array.from({ length: 4 }, () => {
            return BB.el({
                parent: this.rootEl,
                css: {
                    position: 'absolute',
                    background: 'rgba(0, 0, 0, 0.5)',
                },
            });
        });

        this.moveEl = BB.el({
            parent: this.rootEl,
            css: {
                position: 'absolute',
                cursor: 'move',
            },
        });

        this.selectionEl = BB.el({
            parent: this.rootEl,
            css: {
                position: 'absolute',
                pointerEvents: 'none',
                zIndex: '1',
            },
        });

        (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
            const isHorizontal = side === 'top' || side === 'bottom';
            BB.el({
                parent: this.selectionEl,
                css: {
                    position: 'absolute',
                    left: isHorizontal ? '0' : side === 'left' ? '-1px' : '100%',
                    top: isHorizontal ? (side === 'top' ? '-1px' : '100%') : '0',
                    width: isHorizontal ? '100%' : '1px',
                    height: isHorizontal ? '1px' : '100%',
                    background: isHorizontal
                        ? 'repeating-linear-gradient(90deg, white 0 4px, black 4px 8px)'
                        : 'repeating-linear-gradient(180deg, white 0 4px, black 4px 8px)',
                },
            });
        });

        this.thirdsElArr = Array.from({ length: 4 }, () => {
            return BB.el({
                parent: this.rootEl,
                css: {
                    position: 'absolute',
                    background: '#0ff',
                    pointerEvents: 'none',
                    zIndex: '1',
                },
            });
        });

        this.handleElMap = {} as Record<TResizeDirection, HTMLDivElement>;
        resizeDirectionArr.forEach((direction) => {
            this.handleElMap[direction] = BB.el({
                parent: this.rootEl,
                css: {
                    position: 'absolute',
                    cursor: directionToCursor[direction],
                },
            });
        });

        this.pointerListenerArr.push(
            new PointerListener({
                target: this.moveEl,
                fixScribble: true,
                onPointer: (event) => {
                    event.eventPreventDefault();
                    if (event.type === 'pointerdown') {
                        this.updatePointerEvents(this.moveEl);
                        this.processEvent({ type: 'start' });
                    }
                    if (event.type === 'pointermove' && event.button === 'left') {
                        this.processAndApply({ type: 'move', dX: event.dX, dY: event.dY });
                    }
                    if (event.type === 'pointerup') {
                        this.updatePointerEvents(undefined);
                    }
                },
            }),
        );

        resizeDirectionArr.forEach((direction) => {
            this.pointerListenerArr.push(
                new PointerListener({
                    target: this.handleElMap[direction],
                    fixScribble: true,
                    onPointer: (event) => {
                        event.eventPreventDefault();
                        if (event.type === 'pointerdown') {
                            this.updatePointerEvents(this.handleElMap[direction]);
                            this.processEvent({ type: 'start' });
                        }
                        if (event.type === 'pointermove' && event.button === 'left') {
                            this.processAndApply({
                                type: 'resize',
                                direction,
                                dX: event.dX,
                                dY: event.dY,
                                isSymmetric: event.shiftKey,
                            });
                        }
                        if (event.type === 'pointerup') {
                            this.updatePointerEvents(undefined);
                        }
                    },
                }),
            );
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): TRect {
        return { ...this.crop };
    }

    setWidth(width: number): void {
        this.width = width;
        this.render();
    }

    setHeight(height: number): void {
        this.height = height;
        this.render();
    }

    setValue(value: TRect): void {
        this.crop = { ...value };
        this.render();
    }

    setShowThirds(showThirds: boolean): void {
        this.showThirds = showThirds;
        this.render();
    }

    destroy(): void {
        this.pointerListenerArr.forEach((pointerListener) => pointerListener.destroy());
    }
}
