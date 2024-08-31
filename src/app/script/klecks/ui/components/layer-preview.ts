import { BB } from '../../../bb/bb';
import { KlHistory } from '../../history/kl-history';
import { LANG } from '../../../language/language';
import { TKlCanvasLayer, TUiLayout } from '../../kl-types';
import { ISize2D } from '../../../bb/bb-types';
import { theme } from '../../../theme/theme';
import { KlCanvasLayer } from '../../canvas/kl-canvas';
import { throwIfNull } from '../../../bb/base/base';

/**
 * Previews currently active layer
 * thumbnail (hover shows bigger preview), layername, opacity
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
    private readonly history: KlHistory;
    private layerObj: TKlCanvasLayer | undefined;
    private isVisible: boolean;
    private uiState: TUiLayout;

    private readonly checkEl: HTMLInputElement;

    private readonly nameLabelEl: HTMLElement;
    private readonly opacityEl: HTMLElement;
    private lastDrawnSize: ISize2D;
    private lastDrawnState: number; // from KlHistory

    private readonly canvasSize: number;
    private readonly canvas: HTMLCanvasElement;
    private readonly canvasCtx: CanvasRenderingContext2D;

    private animationCount: number; // >0 means it's animating
    private readonly animationLength: number;

    private readonly animationCanvas: HTMLCanvasElement;
    private readonly animationCanvasCtx: CanvasRenderingContext2D;
    private animationCanvasCheckerPattern: CanvasPattern = {} as CanvasPattern;

    private largeCanvasIsVisible: boolean;
    private readonly largeCanvasWrapper: HTMLElement;
    private readonly largeCanvasSize: number;
    private readonly largeCanvas: HTMLCanvasElement;
    private readonly largeCanvasCtx: CanvasRenderingContext2D;
    private largeCanvasCheckerPattern: CanvasPattern = {} as CanvasPattern;

    private updateCheckerPatterns(): void {
        const checker = BB.createCheckerCanvas(4, theme.isDark());
        this.animationCanvasCheckerPattern = throwIfNull(
            this.animationCanvasCtx.createPattern(checker, 'repeat'),
        );
        this.largeCanvasCheckerPattern = throwIfNull(
            this.canvasCtx.createPattern(checker, 'repeat'),
        );
    }

    private animate(): void {
        if (this.animationCount === 0) {
            return;
        }

        this.animationCount--;

        this.canvasCtx.save();
        this.canvasCtx.globalAlpha = Math.pow(
            (this.animationLength - this.animationCount) / this.animationLength,
            2,
        );
        this.canvasCtx.drawImage(this.animationCanvas, 0, 0);
        this.canvasCtx.restore();

        if (this.animationCount > 0) {
            requestAnimationFrame(() => this.animate());
        }
    }

    /**
     * is always instant
     */
    private drawLargeCanvas(): void {
        if (!this.largeCanvasIsVisible || !this.layerObj) {
            return;
        }

        const layerCanvas = this.layerObj.context.canvas;

        const canvasDimensions = BB.fitInto(
            layerCanvas.width,
            layerCanvas.height,
            this.largeCanvasSize,
            this.largeCanvasSize,
            1,
        );
        this.largeCanvas.width = Math.round(canvasDimensions.width);
        this.largeCanvas.height = Math.round(canvasDimensions.height);
        this.largeCanvasCtx.save();
        if (this.largeCanvas.width > layerCanvas.width) {
            this.largeCanvasCtx.imageSmoothingEnabled = false;
        } else {
            this.largeCanvasCtx.imageSmoothingEnabled = true;
            this.largeCanvasCtx.imageSmoothingQuality = 'high';
        }
        this.largeCanvasCtx.fillStyle = this.largeCanvasCheckerPattern;
        this.largeCanvasCtx.fillRect(0, 0, this.largeCanvas.width, this.largeCanvas.height);
        this.largeCanvasCtx.drawImage(
            layerCanvas,
            0,
            0,
            this.largeCanvas.width,
            this.largeCanvas.height,
        );
        this.largeCanvasCtx.restore();

        const bounds = this.rootEl.getBoundingClientRect();
        BB.css(this.largeCanvasWrapper, {
            top: Math.max(10, bounds.top + this.height / 2 - this.largeCanvas.height / 2) + 'px',
        });
    }

    private draw(isInstant: boolean): void {
        if (!this.isVisible || !this.layerObj) {
            return;
        }

        const layerIsVisible = this.layerObj.isVisible;
        this.checkEl.parentElement!.title = layerIsVisible
            ? LANG('layers-active-layer-visible')
            : LANG('layers-active-layer-hidden');
        this.checkEl.checked = layerIsVisible;
        this.checkEl.style.boxShadow = layerIsVisible ? '' : '0 0 0 1px red';

        this.nameLabelEl.textContent = this.layerObj.name;
        if (this.layerObj.isVisible) {
            this.opacityEl.innerHTML =
                LANG('opacity') + '<br>' + Math.round(this.layerObj.opacity * 100) + '%';
        } else {
            this.opacityEl.innerHTML =
                LANG('opacity') + '<br><s>' + Math.round(this.layerObj.opacity * 100) + '%</s>';
        }

        const layerCanvas = this.layerObj.context.canvas;

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
            this.canvas.width = Math.round(canvasDimensions.width);
            this.canvas.height = Math.round(canvasDimensions.height);

            isInstant = true;
        }

        this.animationCanvas.width = this.canvas.width;
        this.animationCanvas.height = this.canvas.height;

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

        this.drawLargeCanvas();

        this.lastDrawnState = this.history.getChangeCount();
        this.lastDrawnSize.width = layerCanvas.width;
        this.lastDrawnSize.height = layerCanvas.height;
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        onClick: () => void; // when clicking on layer name
        klRootEl: HTMLElement;
        uiState: TUiLayout;
        history: KlHistory;
    }) {
        // internally redraws with in an interval. checks history is something changed
        // this update will be animated
        // it will not be animated if the resolution changed
        // also redraws when you call updateLayer - not animated

        // syncs via updateLayer, and internally updates layer opacity via a hack

        this.rootEl = BB.el({
            className: 'kl-layer-preview',
        });
        this.history = p.history;
        this.isVisible = true;
        this.height = 40;
        this.canvasSize = this.height - 10;
        this.largeCanvasSize = 300;
        this.lastDrawnState = -2;
        this.lastDrawnSize = {
            width: 0,
            height: 0,
        };
        this.animationCanvas = BB.canvas(); // to help animate the transition
        this.animationCanvasCtx = BB.ctx(this.animationCanvas);
        this.animationLength = 30;
        this.animationCount = 0;
        this.largeCanvasIsVisible = false;
        let largeCanvasAnimationTimeout: ReturnType<typeof setTimeout>;
        const largeCanvasAnimationDurationMs = 300;
        this.uiState = p.uiState;

        // --- setup dom ---
        this.contentWrapperEl = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
                height: this.height + 'px',
            },
        });

        const checkWrapper = BB.el({
            css: {
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                width: '23px',
                flexShrink: '0',
            },
        });
        this.checkEl = BB.el({
            parent: checkWrapper,
            tagName: 'input',
            css: {
                pointerEvents: 'none',
            },
            custom: {
                type: 'checkbox',
                disabled: 'true',
            },
        });

        const canvasWrapperEl = BB.el({
            css: {
                //background: '#f00',
                minWidth: this.height + 'px',
                height: this.height + 'px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            },
        });
        this.canvas = BB.canvas(this.canvasSize, this.canvasSize);
        this.canvasCtx = BB.ctx(this.canvas);
        this.canvas.title = LANG('layers-active-layer');
        const nameWrapper = BB.el({
            css: {
                //background: '#ff0',
                flexGrow: '1',
                paddingLeft: '10px',
                fontSize: '13px',
                overflow: 'hidden',
                position: 'relative',
            },
        });
        this.nameLabelEl = BB.el({
            content: '',
            css: {
                cssFloat: 'left',
                whiteSpace: 'nowrap',
            },
        });
        const clickableEl = BB.el({
            css: {
                // background: 'rgba(0,255,0,0.6)',
                position: 'absolute',
                left: '10px',
                top: '0',
                width: '90px',
                height: '100%',
            },
        });
        if (p.onClick) {
            clickableEl.addEventListener('click', () => p.onClick(), { passive: false });
            this.canvas.addEventListener('click', () => p.onClick(), { passive: false });
            checkWrapper.addEventListener('click', () => p.onClick(), { passive: false });
        }
        this.opacityEl = BB.el({
            content: LANG('opacity') + '<br>100%',
            css: {
                minWidth: '60px',
                fontSize: '12px',
                textAlign: 'center',
            },
        });

        this.largeCanvasWrapper = BB.el({
            onClick: BB.handleClick,
            css: {
                pointerEvents: 'none',
                background: '#fff',
                position: 'absolute',
                right: '280px',
                top: '10px',
                border: '1px solid #aaa',
                boxShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                transition: 'opacity ' + largeCanvasAnimationDurationMs + 'ms ease-in-out',
                userSelect: 'none',
                display: 'block',
                webkitTouchCallout: 'none',
            },
        });
        this.largeCanvas = BB.canvas(this.largeCanvasSize, this.largeCanvasSize);
        this.largeCanvasWrapper.append(this.largeCanvas);
        this.largeCanvasCtx = BB.ctx(this.largeCanvas);
        BB.css(this.largeCanvas, {
            display: 'block',
        });

        canvasWrapperEl.append(this.canvas);
        nameWrapper.append(this.nameLabelEl, clickableEl);
        this.contentWrapperEl.append(checkWrapper, canvasWrapperEl, nameWrapper, this.opacityEl);
        this.rootEl.append(this.contentWrapperEl);

        this.updateCheckerPatterns();
        theme.addIsDarkListener(() => {
            this.updateCheckerPatterns();
            this.draw(true);
        });

        // --- update logic ---

        // cross-fade done via 2 canvases (old and new state)
        // both have checkerboard background drawn on them, both fully opaque
        // -> no "lighter" is needed for accurate cross-fading

        setInterval(() => {
            if (!this.layerObj) {
                return;
            }

            const currentState = this.history.getChangeCount();
            if (currentState === this.lastDrawnState) {
                return;
            }

            //update opacity w hack
            this.layerObj.opacity = (this.layerObj.context.canvas as KlCanvasLayer).opacity;

            this.draw(false);
        }, 2000);

        const removeLargeCanvas = () => {
            this.largeCanvasWrapper.remove();
        };

        const showLargeCanvas = (b: boolean) => {
            if (this.largeCanvasIsVisible === b) {
                return;
            }

            clearTimeout(largeCanvasAnimationTimeout);
            this.largeCanvasIsVisible = b;

            if (b) {
                largeCanvasAnimationTimeout = setTimeout(() => {
                    this.drawLargeCanvas();
                    this.largeCanvasWrapper.style.opacity = '0';
                    p.klRootEl.append(this.largeCanvasWrapper);
                    setTimeout(() => {
                        this.largeCanvasWrapper.style.opacity = '1';
                    }, 20);
                }, 250);
            } else {
                this.largeCanvasWrapper.style.opacity = '0';
                largeCanvasAnimationTimeout = setTimeout(
                    removeLargeCanvas,
                    largeCanvasAnimationDurationMs + 20,
                );
            }
        };

        const pointerListener = new BB.PointerListener({
            target: this.canvas,
            onEnterLeave: (b) => {
                showLargeCanvas(b);
            },
        });
    }

    // ---- interface ----

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(b: boolean): void {
        if (this.isVisible === b) {
            return;
        }
        this.isVisible = b;
        this.contentWrapperEl.style.display = this.isVisible ? 'flex' : 'none';
        this.rootEl.style.marginBottom = this.isVisible ? '' : '10px';

        const currentState = this.history.getChangeCount();
        if (b && this.lastDrawnState !== currentState) {
            this.draw(true);
        }
    }

    //when the layer might have changed
    setLayer(klCanvasLayerObj: TKlCanvasLayer): void {
        this.layerObj = klCanvasLayerObj;
        this.draw(true);
    }

    setUiState(stateStr: TUiLayout): void {
        this.uiState = stateStr;

        if (this.uiState === 'left') {
            BB.css(this.largeCanvasWrapper, {
                left: '280px',
                right: '',
            });
        } else {
            BB.css(this.largeCanvasWrapper, {
                left: '',
                right: '280px',
            });
        }
    }
}
