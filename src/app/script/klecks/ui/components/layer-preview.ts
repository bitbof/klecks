import { BB } from '../../../bb/bb';
import { changeCanvasDimensions } from '../../../bb/base/change-canvas-dimensions';
import { LANG } from '../../../language/language';
import { TSize2D } from '../../../bb/bb-types';
import { THEME } from '../../../theme/theme';
import { css, throwIfNull } from '../../../bb/base/base';
import { KlCanvas, TKlCanvasLayer } from '../../canvas/kl-canvas';
import { KlHistory } from '../../history/kl-history';
import { getIconSvg } from '../../../icon/icon';
import { FloatingLayerPreview } from './floating-layer-preview';

/**
 * Previews currently active layer
 * thumbnail (hover shows bigger preview), layer name, opacity
 *
 * internally listens to kl history. updates when there's a change.
 * but you need to update it when the active layer changed. (different canvas object)
 *
 * update visibility for performance
 */
export class LayerPreview {
    private readonly rootEl: HTMLElement;
    private readonly contentWrapperEl: HTMLElement;
    private readonly height: number;
    private readonly klHistory: KlHistory;
    private readonly klCanvas: KlCanvas;
    private isPreviewVisible: boolean;
    private floatingLayerPreview: FloatingLayerPreview;

    private readonly checkEl: HTMLInputElement;

    private readonly clippingIconEl: SVGSVGElement;
    private readonly nameWrapperEl: HTMLElement;
    private readonly nameLabelEl: HTMLElement;
    private readonly opacityEl: HTMLElement;
    private lastDrawnSize: TSize2D;

    private readonly canvasSize: number;
    private readonly canvas: HTMLCanvasElement;
    private readonly canvasCtx: CanvasRenderingContext2D;

    private animationCount: number; // >0 means it's animating
    private readonly animationLength: number;

    private readonly animationCanvas: HTMLCanvasElement;
    private readonly animationCanvasCtx: CanvasRenderingContext2D;
    private animationCanvasCheckerPattern: CanvasPattern = {} as CanvasPattern;

    private readonly largeCanvasSize: number;
    private readonly largeCanvas: HTMLCanvasElement;
    private readonly largeCanvasCtx: CanvasRenderingContext2D;

    private updateCheckerPatterns(): void {
        const checker = BB.createCheckerCanvas(4, THEME.isDark());
        this.animationCanvasCheckerPattern = throwIfNull(
            this.animationCanvasCtx.createPattern(checker, 'repeat'),
        );
    }

    private updateClippingIconColor(): void {
        this.clippingIconEl.style.color = THEME.isDark() ? '#ccc' : 'var(--kl-color)';
    }

    private animate(): void {
        if (this.animationCount === 0) {
            return;
        }

        this.animationCount--;

        this.canvasCtx.save();
        this.canvasCtx.globalAlpha =
            ((this.animationLength - this.animationCount) / this.animationLength) ** 2;
        this.canvasCtx.drawImage(this.animationCanvas, 0, 0);
        this.canvasCtx.restore();

        if (this.animationCount > 0) {
            requestAnimationFrame(() => this.animate());
        }
    }

    private getLayer(): TKlCanvasLayer {
        const composed = this.klHistory.getComposed();
        const layerId = composed.activeLayerId;
        return this.klCanvas.getLayer(composed.layerMap[layerId].index);
    }

    /**
     * is always instant
     */
    private drawLargeCanvas(): void {
        const layer = this.getLayer();
        if (!layer) {
            return;
        }
        const layerCanvas = layer.canvas;

        const canvasDimensions = BB.fitInto(
            layerCanvas.width,
            layerCanvas.height,
            this.largeCanvasSize,
            this.largeCanvasSize,
            1,
        );
        const newWidth = Math.round(canvasDimensions.width);
        const newHeight = Math.round(canvasDimensions.height);
        changeCanvasDimensions(this.largeCanvas, newWidth, newHeight, { ensureCleared: true });
        this.largeCanvasCtx.save();
        if (this.largeCanvas.width > layerCanvas.width) {
            this.largeCanvasCtx.imageSmoothingEnabled = false;
        } else {
            this.largeCanvasCtx.imageSmoothingEnabled = true;
            this.largeCanvasCtx.imageSmoothingQuality = 'high';
        }
        this.largeCanvasCtx.drawImage(
            layerCanvas,
            0,
            0,
            this.largeCanvas.width,
            this.largeCanvas.height,
        );
        this.largeCanvasCtx.restore();
    }

    private updateLabel(): void {
        const layer = this.getLayer();
        if (!this.isPreviewVisible || !layer) {
            return;
        }

        const layerIsVisible = layer.isVisible;
        this.checkEl.parentElement!.title = layerIsVisible
            ? LANG('layers-active-layer-visible')
            : LANG('layers-active-layer-hidden');
        this.checkEl.checked = layerIsVisible;
        this.checkEl.style.boxShadow = layerIsVisible ? '' : '0 0 0 1px red';

        this.clippingIconEl.style.display = layer.hasClipping ? '' : 'none';
        css(this.nameWrapperEl, {
            paddingLeft: layer.hasClipping ? 21 : 10,
        });

        this.nameLabelEl.textContent = layer.name;
        if (layer.isVisible) {
            this.opacityEl.innerHTML =
                LANG('opacity') + '<br>' + Math.round(layer.opacity * 100) + '%';
        } else {
            this.opacityEl.innerHTML =
                LANG('opacity') + '<br><s>' + Math.round(layer.opacity * 100) + '%</s>';
        }
    }

    private draw(isInstant: boolean): void {
        // cross-fade done via 2 canvases (old and new state)
        // both have checkerboard background drawn on them, both fully opaque
        // -> no "lighter" is needed for accurate cross-fading

        const layer = this.getLayer();
        if (!this.isPreviewVisible || !layer) {
            return;
        }
        this.updateLabel();

        const layerCanvas = layer.canvas;

        if (
            layerCanvas.width !== this.lastDrawnSize.width ||
            layerCanvas.height !== this.lastDrawnSize.height
        ) {
            const canvasDimensions = BB.fitInto(
                layerCanvas.width,
                layerCanvas.height,
                this.canvasSize,
                this.canvasSize,
                1,
            );
            changeCanvasDimensions(
                this.canvas,
                Math.round(canvasDimensions.width),
                Math.round(canvasDimensions.height),
            );
            changeCanvasDimensions(this.animationCanvas, this.canvas.width, this.canvas.height);

            isInstant = true; // can't animate when size changed
        }

        this.animationCanvasCtx.save();
        this.animationCanvasCtx.imageSmoothingEnabled = false;
        this.animationCanvasCtx.fillStyle = this.animationCanvasCheckerPattern;
        this.animationCanvasCtx.fillRect(
            0,
            0,
            this.animationCanvas.width,
            this.animationCanvas.height,
        );
        this.animationCanvasCtx.drawImage(
            layerCanvas,
            0,
            0,
            this.animationCanvas.width,
            this.animationCanvas.height,
        );
        this.animationCanvasCtx.restore();

        if (isInstant) {
            this.animationCount = 0;
            this.canvasCtx.save();
            this.canvasCtx.drawImage(this.animationCanvas, 0, 0);
            this.canvasCtx.restore();
        } else {
            this.animationCount = this.animationLength;
            this.animate();
        }

        this.lastDrawnSize.width = layerCanvas.width;
        this.lastDrawnSize.height = layerCanvas.height;
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        onClick: () => void; // when clicking on layer name
        klRootEl: HTMLElement;
        floatingLayerPreview: FloatingLayerPreview;
        klHistory: KlHistory;
        klCanvas: KlCanvas;
    }) {
        // internally redraws with in an interval. checks history is something changed
        // this update will be animated
        // it will not be animated if the resolution changed
        // also redraws when you call updateLayer - not animated

        // syncs via updateLayer, and internally updates layer opacity via a hack

        this.rootEl = BB.el({
            className: 'kl-layer-preview',
        });
        this.klHistory = p.klHistory;
        this.klCanvas = p.klCanvas;
        this.floatingLayerPreview = p.floatingLayerPreview;
        this.isPreviewVisible = true;
        this.height = 40;
        this.canvasSize = this.height - 10;
        this.largeCanvasSize = 300;
        this.lastDrawnSize = {
            width: 0,
            height: 0,
        };
        this.animationCanvas = BB.canvas(); // to help animate the transition
        this.animationCanvasCtx = BB.ctx(this.animationCanvas);
        this.animationLength = 30;
        this.animationCount = 0;

        // --- setup dom ---
        this.contentWrapperEl = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
                height: this.height,
            },
        });

        const checkWrapper = BB.el({
            css: {
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                width: 23,
                flexShrink: 0,
            },
        });
        this.checkEl = BB.el({
            parent: checkWrapper,
            tagName: 'input',
            css: {
                pointerEvents: 'none',
            },
            props: {
                type: 'checkbox',
                disabled: true,
                name: 'layer-visible',
            },
        });

        const canvasWrapperEl = BB.el({
            css: {
                //background: '#f00',
                minWidth: this.height,
                height: this.height,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            },
        });
        this.canvas = BB.canvas(this.canvasSize, this.canvasSize);
        this.canvasCtx = BB.ctx(this.canvas);
        this.canvas.title = LANG('layers-active-layer');
        const nameWrapper = (this.nameWrapperEl = BB.el({
            css: {
                //background: '#ff0',
                flexGrow: 1,
                paddingLeft: 10,
                fontSize: 13,
                overflow: 'hidden',
                position: 'relative',
            },
        }));
        this.clippingIconEl = getIconSvg('layer-clipping', {
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 16,
            height: 16,
            display: 'none',
        });
        nameWrapper.append(this.clippingIconEl);
        this.nameLabelEl = BB.el({
            content: '',
            css: {
                float: 'left',
                whiteSpace: 'nowrap',
            },
        });
        const clickableEl = BB.el({
            css: {
                // background: 'rgba(0,255,0,0.6)',
                position: 'absolute',
                left: 10,
                top: 0,
                width: 90,
                height: '100%',
            },
        });

        this.clippingIconEl.addEventListener('click', () => p.onClick(), { passive: false });
        clickableEl.addEventListener('click', () => p.onClick(), { passive: false });
        this.canvas.addEventListener('click', () => p.onClick(), { passive: false });
        checkWrapper.addEventListener('click', () => p.onClick(), { passive: false });

        this.opacityEl = BB.el({
            content: LANG('opacity') + '<br>100%',
            css: {
                minWidth: 60,
                fontSize: 12,
                textAlign: 'center',
            },
        });

        this.largeCanvas = BB.canvas(this.largeCanvasSize, this.largeCanvasSize);
        this.largeCanvasCtx = BB.ctx(this.largeCanvas);

        canvasWrapperEl.append(this.canvas);
        nameWrapper.append(this.nameLabelEl, clickableEl);
        this.contentWrapperEl.append(checkWrapper, canvasWrapperEl, nameWrapper, this.opacityEl);
        this.rootEl.append(this.contentWrapperEl);

        this.updateCheckerPatterns();
        this.updateClippingIconColor();
        THEME.addIsDarkListener(() => {
            this.updateCheckerPatterns();
            this.updateClippingIconColor();
            this.draw(true);
        });

        let previousLayerId = '';
        let timeout: number | undefined;
        this.klHistory.addListener(() => {
            // label should update instantly
            this.updateLabel();
            const activeLayerId = this.klHistory.getComposed().activeLayerId;
            if (activeLayerId !== previousLayerId) {
                // layer changed, draw instantly
                this.draw(true);
                timeout = undefined;
            } else {
                // layer didn't change, can update slowly
                timeout ??= setTimeout(() => {
                    timeout = undefined;
                    this.draw(false);
                }, 500);
            }
            previousLayerId = activeLayerId;
        });

        const pointerListener = new BB.PointerListener({
            target: this.canvas,
            onEnterLeave: (b) => {
                if (b) {
                    this.drawLargeCanvas();
                    const bounds = this.rootEl.getBoundingClientRect();
                    this.floatingLayerPreview.show(this.largeCanvas, bounds.top + this.height / 2);
                } else {
                    this.floatingLayerPreview.hide();
                }
            },
        });

        this.draw(true);
    }

    // ---- interface ----

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(b: boolean): void {
        if (this.isPreviewVisible === b) {
            return;
        }
        this.isPreviewVisible = b;
        this.contentWrapperEl.style.display = this.isPreviewVisible ? 'flex' : 'none';
        this.rootEl.style.marginBottom = this.isPreviewVisible ? '' : '10px';
        this.draw(true);
    }
}
