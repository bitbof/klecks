import { LayerCompositor } from '../../../canvas/layer-compositor';
import { getIconUrl } from '../../../../icon/icon';
import { BB } from '../../../../bb/bb';
import { changeCanvasDimensions } from '../../../../bb/base/change-canvas-dimensions';
import { css, Destroyer, throwIfNull } from '../../../../bb/base/base';
import { THEME } from '../../../../theme/theme';
import { renderText, TRenderTextParam } from '../../../image-operations/render-text';
import { KlCanvas, TKlCanvasLayer } from '../../../canvas/kl-canvas';
import { KlSlider } from '../../components/kl-slider';
import { PointerListener } from '../../../../bb/input/pointer-listener';
import { LANG } from '../../../../language/language';
import { c } from '../../../../bb/base/c';
import { TVector2D } from '../../../../bb/bb-types';
import { KeyListener } from '../../../../bb/input/key-listener';
import { getSelectionPath2d } from '../../../../bb/multi-polygon/get-selection-path-2d';

const toolZoomInImg = getIconUrl('tool-zoom-in');
const toolZoomOutImg = getIconUrl('tool-zoom-out');
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
    private offset: TVector2D = { x: 0, y: 0 };
    private interval: ReturnType<typeof setInterval> | undefined;
    private readonly selectionPath: Path2D | undefined;

    private width: number;
    private height: number;
    private zoomFac: number = 0;
    private scale: number = 1;

    private readonly layerArr: TKlCanvasLayer[] = [];
    private readonly layerIndex: number;

    private readonly textCanvas: HTMLCanvasElement;
    private readonly textCtx: CanvasRenderingContext2D;

    private readonly targetCanvas: HTMLCanvasElement;
    private readonly targetCtx: CanvasRenderingContext2D;

    private readonly layersCanvas: HTMLCanvasElement;
    private readonly layersCtx: CanvasRenderingContext2D;

    private readonly compositor = new LayerCompositor();

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
    private readonly destroyer = new Destroyer();

    private readonly onDarkChange = () => {
        this.checkerPattern = throwIfNull(
            this.previewCtx.createPattern(BB.createCheckerCanvas(8, THEME.isDark()), 'repeat'),
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

    // Move text by x y
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
        const selection = p.klCanvas.getSelection();
        this.selectionPath = selection ? new Path2D(getSelectionPath2d(selection)) : undefined;

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

        this.layerArr = p.klCanvas.getLayers();
        this.textCanvas = BB.canvas(p.klCanvas.getWidth(), p.klCanvas.getHeight());
        this.textCtx = BB.ctx(this.textCanvas);
        this.targetCanvas = BB.canvas(this.width, this.height);
        this.targetCtx = BB.ctx(this.targetCanvas);
        this.layersCanvas = BB.canvas(this.width, this.height);
        this.layersCtx = BB.ctx(this.layersCanvas);
        this.previewCanvas = BB.canvas(this.width, this.height); // the one that is visible
        this.previewCtx = BB.ctx(this.previewCanvas);
        css(this.previewCanvas, {
            display: 'block',
        });
        this.previewWrapper = BB.el({
            parent: this.rootEl,
            css: {
                position: 'relative',
                width: this.width,
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
            this.previewCtx.createPattern(BB.createCheckerCanvas(8, THEME.isDark()), 'repeat'),
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

        THEME.addIsDarkListener(this.onDarkChange);

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
                    clearInterval(this.interval);
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
                e.event?.preventDefault();
                this.changeZoomFac(-e.deltaY);
            },
            useDirtyWheel: true,
        });

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
            className: 'kl-button',
            content: `<img height="20" src="${toolZoomInImg}">`,
            title: LANG('zoom-in'),
            destroyer: this.destroyer,
            onClick: () => this.changeZoomFac(1),
            css: {
                fontWeight: 'bold',
            },
        });
        this.zoomOutBtn = BB.el({
            tagName: 'button',
            className: 'kl-button',
            content: `<img height="20" src="${toolZoomOutImg}">`,
            title: LANG('zoom-out'),
            destroyer: this.destroyer,
            onClick: () => this.changeZoomFac(-1),
            css: {
                fontWeight: 'bold',
            },
        });

        this.eventCapture = BB.el({
            css: {
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
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
        const bounds = renderText(
            this.textCanvas,
            {
                ...this.text,
                x: this.text.x,
                y: this.text.y,
                angleRad: this.rotationSlider.getValue(),
            },
            this.selectionPath,
        );

        // transform offset
        const transformedOffset = BB.Vec2.mul(
            BB.rotate(this.offset.x, this.offset.y, (-angleRad / Math.PI) * 180),
            1 / this.scale,
        );

        // --- determine transformation of viewport ---
        // text should always be visible
        bounds.x -= 3;
        bounds.y -= 3;
        bounds.width += 6;
        bounds.height += 6;
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
        this.scale = Math.min(4, this.scale * 2 ** this.zoomFac);

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

        const isDark = THEME.isDark();

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

            this.compositor.draw(
                this.layersCtx,
                this.layerArr,
                this.width,
                this.height,
                (ctx, layer) => {
                    const layerIndex = this.layerArr.indexOf(layer);
                    if (layerIndex === this.layerIndex) {
                        ctx.drawImage(this.targetCanvas, 0, 0);
                    } else {
                        ctx.save();
                        ctx.translate(this.width / 2, this.height / 2);
                        ctx.scale(this.scale, this.scale);
                        ctx.rotate(angleRad);
                        ctx.drawImage(this.layerArr[layerIndex].canvas, -centerX, -centerY);
                        ctx.restore();
                    }
                },
            );
        }

        this.layersCtx.restore();

        // --- final composite ---
        this.previewCtx.save();
        this.previewCtx.fillStyle = this.checkerPattern;
        this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.drawImage(this.layersCanvas, 0, 0);
        this.previewCtx.restore();

        if (this.selectionPath) {
            const selectionPath = new Path2D();
            selectionPath.addPath(
                this.selectionPath,
                new DOMMatrix()
                    .translate(this.width / 2, this.height / 2)
                    .scale(this.scale)
                    .rotate((angleRad / Math.PI) * 180)
                    .translate(-centerX, -centerY),
            );

            this.previewCtx.save();
            this.previewCtx.setLineDash([4]);
            this.previewCtx.lineWidth = 1;
            this.previewCtx.strokeStyle = '#000';
            this.previewCtx.stroke(selectionPath);
            this.previewCtx.lineDashOffset = 4;
            this.previewCtx.strokeStyle = '#fff';
            this.previewCtx.stroke(selectionPath);
            this.previewCtx.restore();
        }

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
        // prevents: Failed to execute 'drawImage' on 'CanvasRenderingContext2D':
        // The image argument is a canvas element with a width or height of 0.
        width = Math.max(1, width);
        height = Math.max(1, height);

        if (width === this.width && height === this.height) {
            return;
        }

        this.width = width;
        this.height = height;

        changeCanvasDimensions(this.targetCanvas, this.width, this.height);
        changeCanvasDimensions(this.layersCanvas, this.width, this.height);
        changeCanvasDimensions(this.previewCanvas, this.width, this.height);

        this.previewWrapper.style.width = this.width + 'px';

        this.render();
    }

    destroy(): void {
        clearInterval(this.interval);

        this.rotationSlider.destroy();
        this.destroyer.destroy();
        this.eventCapture.remove();
        this.previewPointerListener.destroy();
        this.keyListener.destroy();
        this.compositor.destroy();
        THEME.removeIsDarkListener(this.onDarkChange);
    }
}
