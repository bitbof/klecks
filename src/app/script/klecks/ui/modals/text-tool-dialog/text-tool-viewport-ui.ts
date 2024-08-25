import { BB } from '../../../../bb/bb';
import { throwIfNull } from '../../../../bb/base/base';
import { theme } from '../../../../theme/theme';
import { renderText, TRenderTextParam } from '../../../image-operations/render-text';
import { KlCanvas } from '../../../canvas/kl-canvas';
import { KlSlider } from '../../components/kl-slider';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { LANG } from '../../../../language/language';
import toolZoomInImg from '/src/app/img/ui/tool-zoom-in.svg';
import toolZoomOutImg from '/src/app/img/ui/tool-zoom-out.svg';
import { c } from '../../../../bb/base/c';
import { IVector2D } from '../../../../bb/bb-types';
import { KeyListener } from '../../../../bb/input/key-listener';

type TViewportParams = Pick<TRenderTextParam, 'x' | 'y' | 'angleRad'>;

type TViewportUIParams = {
    text: TRenderTextParam;
    klCanvas: KlCanvas;
    layerIndex: number;
    onDragEnd: () => void;
};

export class TextToolViewportUI {
    private readonly rootEl: HTMLElement;
    private readonly inputsRootEl: HTMLElement;
    private readonly previewWrapper: HTMLElement;
    private text: TRenderTextParam;
    private offset: IVector2D = { x: 0, y: 0 };
    private interval: ReturnType<typeof setInterval> | undefined;

    private width: number;
    private height: number;
    private zoomFac: number = 0;
    private scale: number = 1;

    private readonly layerArr: ReturnType<KlCanvas['getLayersFast']> = [];
    private readonly layerIndex: number;

    private readonly textCanvas: HTMLCanvasElement;
    private readonly textCtx: CanvasRenderingContext2D;

    private readonly targetCanvas: HTMLCanvasElement;
    private readonly targetCtx: CanvasRenderingContext2D;

    private readonly layersCanvas: HTMLCanvasElement;
    private readonly layersCtx: CanvasRenderingContext2D;

    private readonly previewCanvas: HTMLCanvasElement;
    private readonly previewCtx: CanvasRenderingContext2D;

    private readonly emptyCanvas: HTMLCanvasElement;
    private readonly emptyCanvasLight: HTMLCanvasElement;

    private checkerPattern: CanvasPattern;

    private readonly rotationSlider: KlSlider;
    private readonly zoomInBtn: HTMLButtonElement;
    private readonly zoomOutBtn: HTMLButtonElement;

    private readonly eventCapture: HTMLElement;

    private readonly previewPointerListener: PointerListener;
    private readonly keyListener: KeyListener;

    private readonly onDarkChange = () => {
        this.checkerPattern = throwIfNull(
            this.previewCtx.createPattern(BB.createCheckerCanvas(8, theme.isDark()), 'repeat'),
        );
        this.render();
    };

    private canZoom(d: number): boolean {
        return this.zoomFac !== Math.min(2, Math.max(-2, this.zoomFac + d));
    }

    private changeZoomFac(d: number): void {
        this.zoomFac = Math.min(2, Math.max(-2, this.zoomFac + d));
        this.render();
        this.zoomInBtn.disabled = !this.canZoom(1);
        this.zoomOutBtn.disabled = !this.canZoom(-1);
    }

    /** Move text by x y **/
    private move(x: number, y: number): void {
        const rotated = BB.rotate(x, y, (-this.rotationSlider.getValue() / Math.PI) * 180);
        this.text.x += rotated.x / this.scale;
        this.text.y += rotated.y / this.scale;
        this.render();
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TViewportUIParams) {
        this.rootEl = c();
        this.text = p.text;
        this.layerIndex = p.layerIndex;

        const isSmallWidth = window.innerWidth < 550;
        const isSmallHeight = window.innerHeight < 630;

        // --- preview ---
        // Text drawn on klCanvas-sized canvas: textCanvas
        // LayerArr[target].canvas & textCanvas then drawn on targetCanvas
        //      they are transformed. canvas size of final preview
        // All layers and targetCanvas drawn on layersCanvas. transformed and size of final preview
        // Checkerboard, layersCanvas, and outline then drawn on previewCanvas

        this.width = isSmallWidth ? 340 : 540;
        this.height = isSmallWidth ? (isSmallHeight ? 210 : 260) : isSmallHeight ? 230 : 350;

        this.layerArr = p.klCanvas.getLayersFast();
        this.textCanvas = BB.canvas(p.klCanvas.getWidth(), p.klCanvas.getHeight());
        this.textCtx = BB.ctx(this.textCanvas);
        this.targetCanvas = BB.canvas(this.width, this.height);
        this.targetCtx = BB.ctx(this.targetCanvas);
        this.layersCanvas = BB.canvas(this.width, this.height);
        this.layersCtx = BB.ctx(this.layersCanvas);
        this.previewCanvas = BB.canvas(this.width, this.height); // the one that is visible
        this.previewCtx = BB.ctx(this.previewCanvas);
        BB.css(this.previewCanvas, {
            display: 'block',
        });
        this.previewWrapper = BB.el({
            parent: this.rootEl,
            css: {
                position: 'relative',
                width: this.width + 'px',
                cursor: 'move',
                touchAction: 'none',
            },
        });
        BB.el({
            // inset shadow on preview
            parent: this.previewWrapper,
            className: 'kl-text-preview-wrapper',
        });
        this.previewWrapper.append(this.previewCanvas);
        this.checkerPattern = throwIfNull(
            this.previewCtx.createPattern(BB.createCheckerCanvas(8, theme.isDark()), 'repeat'),
        );
        this.emptyCanvas = BB.canvas(1, 1);
        this.emptyCanvasLight = BB.canvas(1, 1);
        {
            let ctx = BB.ctx(this.emptyCanvas);
            ctx.fillRect(0, 0, 1, 1);

            ctx = BB.ctx(this.emptyCanvasLight);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 1, 1);
        }

        theme.addIsDarkListener(this.onDarkChange);

        this.previewCanvas.oncontextmenu = (e) => e.preventDefault();
        let dragged = false;
        let isDown = false;
        let offsetDragged = false;
        this.previewPointerListener = new BB.PointerListener({
            target: this.previewCanvas,
            onPointer: (e) => {
                // drag detect
                if (e.type === 'pointerdown') {
                    dragged = false;
                    isDown = true;
                }
                if (e.type === 'pointermove' && isDown) {
                    dragged = true;
                }
                if (e.type === 'pointerup') {
                    if (isDown && dragged && e.pointerType === 'mouse') {
                        // With touch/pen it would be annoying to focus again,
                        // because it probably pops out the keyboard.
                        p.onDragEnd();
                    }
                    dragged = false;
                    isDown = false;
                }

                if (e.type === 'pointermove' && e.button === 'left') {
                    e.eventPreventDefault();
                    this.offset = { x: 0, y: 0 };
                    this.move(-e.dX, -e.dY);
                }
                if (e.type === 'pointerdown' && e.button === 'right') {
                    document.body.append(this.eventCapture);
                }
                if (e.type === 'pointerup') {
                    setTimeout(() => this.eventCapture.remove(), 20);
                }
                if (e.type === 'pointermove' && e.button === 'right') {
                    offsetDragged = true;
                    e.eventPreventDefault();
                    this.offset.x -= e.dX;
                    this.offset.y -= e.dY;
                    this.render();
                }
                if (e.type === 'pointerup' && offsetDragged) {
                    let count = 0;
                    this.interval = setInterval(() => {
                        if (count > 8) {
                            clearInterval(this.interval);
                            this.offset = { x: 0, y: 0 };
                            this.render();
                        }
                        this.offset = {
                            x: this.offset.x * 0.6,
                            y: this.offset.y * 0.6,
                        };
                        this.render();
                        count++;
                    }, 10);

                    this.offset = {
                        x: this.offset.x * 0.6,
                        y: this.offset.y * 0.6,
                    };
                    this.render();
                }
            },
            onWheel: (e) => {
                this.changeZoomFac(-e.deltaY);
            },
        });

        const wheelPrevent = (event: WheelEvent): void => event.preventDefault();
        this.previewCanvas.addEventListener('wheel', wheelPrevent, { passive: false });

        this.rotationSlider = new KlSlider({
            label: LANG('filter-transform-rotation'),
            width: 150,
            height: 30,
            min: -Math.PI,
            max: Math.PI,
            value: p.text.angleRad,
            resolution: 225,
            // eventResMs: 1000 / 30,
            toValue: (deg) => (deg * Math.PI) / 180,
            toDisplayValue: (rad) => (rad / Math.PI) * 180,
            onChange: () => {
                this.offset = { x: 0, y: 0 };
                this.render();
            },
            unit: '°',
        });

        this.zoomInBtn = BB.el({
            tagName: 'button',
            content: `<img height="20" src="${toolZoomInImg}">`,
            title: LANG('zoom-in'),
            onClick: () => this.changeZoomFac(1),
            css: {
                fontWeight: 'bold',
            },
        });
        this.zoomOutBtn = BB.el({
            tagName: 'button',
            content: `<img height="20" src="${toolZoomOutImg}">`,
            title: LANG('zoom-out'),
            onClick: () => this.changeZoomFac(-1),
            css: {
                fontWeight: 'bold',
            },
        });

        this.eventCapture = BB.el({
            css: {
                position: 'absolute',
                left: '0',
                top: '0',
                right: '0',
                bottom: '0',
                zIndex: '999',
                cursor: 'move',
            },
        });
        this.eventCapture.oncontextmenu = (e) => e.preventDefault();

        this.keyListener = new BB.KeyListener({
            onDown: (keyStr) => {
                if (BB.isInputFocused(true)) {
                    return;
                }
                const factor = this.keyListener.isPressed('shift') ? 4 : 1;
                if (keyStr === 'left') {
                    this.move(-factor, 0);
                }
                if (keyStr === 'right') {
                    this.move(factor, 0);
                }
                if (keyStr === 'up') {
                    this.move(0, -factor);
                }
                if (keyStr === 'down') {
                    this.move(0, factor);
                }
            },
        });

        this.inputsRootEl = c(',flex,gap-5', [
            this.rotationSlider.getElement(),
            c(),
            this.zoomInBtn,
            this.zoomOutBtn,
        ]);
    }

    render(): void {
        // try to draw very much like klCanvasWorkspace

        const angleRad = this.rotationSlider.getValue();

        // --- draw text ---
        this.textCtx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
        const bounds = renderText(this.textCanvas, {
            ...this.text,
            x: this.text.x,
            y: this.text.y,
            angleRad: this.rotationSlider.getValue(),
        });

        // transform offset
        const transformedOffset = BB.Vec2.mul(
            BB.rotate(this.offset.x, this.offset.y, (-angleRad / Math.PI) * 180),
            1 / this.scale,
        );

        // --- determine transformation of viewport ---
        // text should always be visible
        bounds.width = Math.max(bounds.width, 1);
        bounds.height = Math.max(bounds.height, 1);
        const rotatedXY = BB.rotate(bounds.x, bounds.y, (-angleRad / Math.PI) * 180);
        const rotatedWH = BB.rotate(bounds.width, bounds.height, (-angleRad / Math.PI) * 180);
        const centerX = this.text.x + rotatedXY.x + rotatedWH.x / 2 + transformedOffset.x;
        const centerY = this.text.y + rotatedXY.y + rotatedWH.y / 2 + transformedOffset.y;

        const padding = 100;
        const fitBounds = BB.fitInto(
            bounds.width,
            bounds.height,
            this.width - padding,
            this.height - padding,
        );
        this.scale = Math.min(1, fitBounds.width / bounds.width);
        this.scale = Math.min(4, this.scale * Math.pow(2, this.zoomFac));

        // --- compose text and target layer ---
        this.targetCtx.save();

        if (this.scale >= 4) {
            this.targetCtx.imageSmoothingEnabled = false;
        } else {
            this.targetCtx.imageSmoothingEnabled = true;
            this.targetCtx.imageSmoothingQuality = this.scale >= 1 ? 'low' : 'medium';
        }

        this.targetCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.targetCtx.translate(this.width / 2, this.height / 2);
        this.targetCtx.scale(this.scale, this.scale);
        this.targetCtx.rotate(angleRad);
        this.targetCtx.drawImage(this.layerArr[this.layerIndex].canvas, -centerX, -centerY);
        this.targetCtx.drawImage(this.textCanvas, -centerX, -centerY);
        this.targetCtx.restore();

        const isDark = theme.isDark();

        // --- layers ---
        this.layersCtx.save();

        this.layersCtx.fillStyle = isDark ? 'rgb(33,33,33)' : 'rgb(158,158,158)';
        this.layersCtx.fillRect(0, 0, this.width, this.height);

        {
            // bg
            this.layersCtx.save();

            this.layersCtx.translate(this.width / 2, this.height / 2);
            this.layersCtx.scale(this.scale, this.scale);
            this.layersCtx.rotate(angleRad);

            this.layersCtx.imageSmoothingEnabled = false;

            //outline
            const borderSize = 1 / this.scale;
            this.layersCtx.globalAlpha = isDark ? 0.25 : 0.2;
            this.layersCtx.drawImage(
                isDark ? this.emptyCanvasLight : this.emptyCanvas,
                -centerX - borderSize,
                -centerY - borderSize,
                this.textCanvas.width + borderSize * 2,
                this.textCanvas.height + borderSize * 2,
            );
            this.layersCtx.globalAlpha = 1;

            //erase
            this.layersCtx.globalCompositeOperation = 'destination-out';
            this.layersCtx.drawImage(
                this.emptyCanvas,
                -centerX,
                -centerY,
                this.textCanvas.width,
                this.textCanvas.height,
            );

            this.layersCtx.restore();
        }

        {
            // individual layers

            if (this.scale >= 4) {
                this.layersCtx.imageSmoothingEnabled = false;
            } else {
                this.layersCtx.imageSmoothingEnabled = true;
                this.layersCtx.imageSmoothingQuality = this.scale >= 1 ? 'low' : 'medium';
            }

            // layers below
            this.layersCtx.save();
            this.layersCtx.translate(this.width / 2, this.height / 2);
            this.layersCtx.scale(this.scale, this.scale);
            this.layersCtx.rotate(angleRad);
            for (let i = 0; i < this.layerIndex; i++) {
                if (this.layerArr[i].isVisible && this.layerArr[i].opacity > 0) {
                    this.layersCtx.globalAlpha = this.layerArr[i].opacity;
                    this.layersCtx.globalCompositeOperation = this.layerArr[i].mixModeStr;
                    this.layersCtx.drawImage(this.layerArr[i].canvas, -centerX, -centerY);
                }
            }
            this.layersCtx.restore();

            // target layer
            this.layersCtx.globalAlpha =
                this.layerArr[this.layerIndex].opacity *
                (this.layerArr[this.layerIndex].isVisible ? 1 : 0);
            this.layersCtx.globalCompositeOperation = this.layerArr[this.layerIndex].mixModeStr;
            this.layersCtx.drawImage(this.targetCanvas, 0, 0);

            // layers above
            this.layersCtx.save();
            this.layersCtx.translate(this.width / 2, this.height / 2);
            this.layersCtx.scale(this.scale, this.scale);
            this.layersCtx.rotate(angleRad);
            for (let i = this.layerIndex + 1; i < this.layerArr.length; i++) {
                if (this.layerArr[i].isVisible && this.layerArr[i].opacity > 0) {
                    this.layersCtx.globalAlpha = this.layerArr[i].opacity;
                    this.layersCtx.globalCompositeOperation = this.layerArr[i].mixModeStr;
                    this.layersCtx.drawImage(this.layerArr[i].canvas, -centerX, -centerY);
                }
            }
            this.layersCtx.restore();
        }

        this.layersCtx.restore();

        // --- final composite ---
        this.previewCtx.save();
        this.previewCtx.fillStyle = this.checkerPattern;
        this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.drawImage(this.layersCanvas, 0, 0);
        this.previewCtx.restore();

        // bounds
        this.previewCtx.save();
        this.previewCtx.globalCompositeOperation = 'difference';
        this.previewCtx.strokeStyle = '#fff';
        this.previewCtx.lineWidth = 0.5;
        this.previewCtx.translate(-this.offset.x, -this.offset.y);
        this.previewCtx.strokeRect(
            Math.round(this.width / 2 - (bounds.width / 2) * this.scale) + 0.5,
            Math.round(this.height / 2 - (bounds.height / 2) * this.scale) + 0.5,
            Math.round(bounds.width * this.scale),
            Math.round(bounds.height * this.scale),
        );
        this.previewCtx.restore();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getInputsElement(): HTMLElement {
        return this.inputsRootEl;
    }

    getValues(): TViewportParams {
        return {
            x: this.text.x,
            y: this.text.y,
            angleRad: this.rotationSlider.getValue(),
        };
    }

    setText(text: Omit<TRenderTextParam, 'x' | 'y' | 'angleRad'>): void {
        const x = this.text.x;
        const y = this.text.y;
        const angleRad = this.text.angleRad;
        this.text = {
            ...text,
            x,
            y,
            angleRad,
        };
        this.render();
    }

    setSize(width: number, height: number): void {
        if (width === this.width && height === this.height) {
            return;
        }

        this.width = width;
        this.height = height;

        this.targetCanvas.width = this.width;
        this.targetCanvas.height = this.height;

        this.layersCanvas.width = this.width;
        this.layersCanvas.height = this.height;

        this.previewCanvas.width = this.width;
        this.previewCanvas.height = this.height;

        this.previewWrapper.style.width = this.width + 'px';

        this.render();
    }

    destroy(): void {
        BB.destroyEl(this.rootEl);
        BB.destroyEl(this.inputsRootEl);
        BB.destroyEl(this.previewWrapper);
        clearInterval(this.interval);

        this.rotationSlider.destroy();
        BB.destroyEl(this.zoomInBtn);
        BB.destroyEl(this.zoomOutBtn);
        this.eventCapture.remove();
        this.previewPointerListener.destroy();
        this.keyListener.destroy();
        theme.removeIsDarkListener(this.onDarkChange);
    }
}
