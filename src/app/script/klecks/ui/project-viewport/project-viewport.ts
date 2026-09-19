import { LayerCompositor } from '../../canvas/layer-compositor';
import { TKlLayer } from '../../kl-types';
import { BB } from '../../../bb/bb';
import { changeCanvasDimensions } from '../../../bb/base/change-canvas-dimensions';
import { css } from '../../../bb/base/base';
import { THEME } from '../../../theme/theme';
import { Matrix } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { matrixToTuple } from '../../../bb/math/matrix-to-tuple';
import { DEBUG_RENDER, DEBUG_RENDERER_ENABLED } from './debug-render';
import {
    addIsPixelatedZoomListener,
    isPixelatedZoomEnabled,
    removeIsPixelatedZoomListener,
} from '../components/pixelated-zoom-toggle';

function fixScale(scale: number, pixels: number): number {
    return Math.round(pixels * scale) / pixels;
}

// width, height - viewport size
export type TProjectViewportLayerFunc = (
    viewportTransform: TViewportTransformXY,
    viewportWidth: number,
    viewportHeight: number,
) => CanvasImageSource | { image: CanvasImageSource; transform: Matrix }; // image drawn with ctx.setTransform(transform)

export type TProjectViewportLayer = TKlLayer<CanvasImageSource | TProjectViewportLayerFunc>;

export type TProjectViewportProject = {
    width: number;
    height: number;
    layers: TProjectViewportLayer[];
};

type TRenderedImage = { image: CanvasImageSource; transform?: Matrix };

export type TViewportTransform = {
    scale: number;
    angleDeg: number;
    x: number;
    y: number;
};

export type TViewportTransformXY = {
    scaleX: number;
    scaleY: number;
    angleDeg: number;
    x: number;
    y: number;
};

// undefined -> default, 'checker' -> checkerboard, all other strings -> CSS color
export type TProjectViewportBackground = undefined | 'checker' | (string & Record<never, never>);

export type TProjectViewportParams = {
    width: number;
    height: number;
    project: TProjectViewportProject;
    transform: TViewportTransform;
    background?: TProjectViewportBackground;
    useNativeResolution?: boolean;
    renderAfter?: (ctx: CanvasRenderingContext2D, transform: TViewportTransformXY) => void;
    fillParent?: boolean;
};

/**
 *
 * Scale - size of one project-canvas pixel compared to CSS pixel
 *      -> 1 means 1 pixel in the drawing is the size of a CSS pixel
 *      -> independent of device pixel ratio, or what resolution the viewport
 *          canvas may actually have.
 * Translate - translates in CSS pixels
 * Viewport origin is top left (same as canvas)
 *
 * Order of transformations (matrix multiplication is reversed): translate, rotate, scale
 */
export class ProjectViewport {
    private width: number;
    private height: number;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly compositor = new LayerCompositor();
    private transform: TViewportTransform;
    private renderedTransform!: TViewportTransformXY;

    private project: TProjectViewportProject;
    private useNativeResolution: boolean;

    private resFactor: number;
    private background: TProjectViewportParams['background'];
    private doResize: boolean = true;
    private readonly doFillParent: boolean;
    private readonly renderAfter:
        | undefined
        | ((ctx: CanvasRenderingContext2D, transform: TViewportTransformXY) => void);

    private onIsDark = () => this.render();

    private onPixelatedZoomChange = (): void => {
        this.render();
    };

    private oldDPR = devicePixelRatio;
    private resizeListener = () => {
        if (devicePixelRatio !== this.oldDPR) {
            this.canvas.style.imageRendering =
                Math.round(devicePixelRatio) !== devicePixelRatio ? '' : 'pixelated';
            this.oldDPR = devicePixelRatio;
        }
    };

    // ----------------------------------- public -----------------------------------
    constructor(p: TProjectViewportParams) {
        this.width = p.width;
        this.height = p.height;
        this.project = p.project;
        this.useNativeResolution = !!p.useNativeResolution;
        this.background = p.background;
        this.doFillParent = !!p.fillParent;
        this.renderAfter = p.renderAfter;

        this.transform = {
            ...p.transform,
        };

        this.resFactor = this.useNativeResolution ? devicePixelRatio : 1;
        this.canvas = BB.canvas(this.width * this.resFactor, this.height * this.resFactor);
        this.ctx = BB.ctx(this.canvas);
        css(this.canvas, {
            width: this.doFillParent ? '100%' : this.width,
            height: this.doFillParent ? '100%' : this.height,
            imageRendering:
                Math.round(devicePixelRatio) !== devicePixelRatio ? undefined : 'pixelated',
            display: 'block',
            // achieves accurate mixing with all layer mix modes
            background: 'var(--kl-checkerboard-background)',
            backgroundSize: '20px',
        });
        window.addEventListener('resize', this.resizeListener);

        THEME.addIsDarkListener(this.onIsDark);
        addIsPixelatedZoomListener(this.onPixelatedZoomChange);

        // this.render();
    }

    render(optimizeForAnimation?: boolean): void {
        const isDark = THEME.isDark();
        const transform = {
            ...this.transform,
            x: this.transform.x,
            y: this.transform.y,
            scale: this.transform.scale,
        };

        if (this.doResize) {
            this.doResize = false;
            this.resFactor = this.useNativeResolution ? devicePixelRatio : 1;
            changeCanvasDimensions(
                this.canvas,
                Math.round(this.width * this.resFactor),
                Math.round(this.height * this.resFactor),
                // we'll clear later anyway
            );
        }

        const renderedTransform: TViewportTransformXY = optimizeForAnimation
            ? {
                  x: transform.x,
                  y: transform.y,
                  angleDeg: transform.angleDeg,
                  scaleX: transform.scale,
                  scaleY: transform.scale,
              }
            : {
                  x: Math.round(transform.x),
                  y: Math.round(transform.y),
                  scaleX: fixScale(transform.scale, this.project.width),
                  scaleY: fixScale(transform.scale, this.project.height),
                  angleDeg: transform.angleDeg,
              };
        const renderedMat = createMatrixFromTransform(renderedTransform);
        this.renderedTransform = renderedTransform;

        this.ctx.save();

        const isImageSmoothingEnabled =
            !isPixelatedZoomEnabled() &&
            renderedTransform.scaleX < 4 &&
            (renderedTransform.scaleX !== 1 || renderedTransform.angleDeg !== 0);
        this.ctx.imageSmoothingEnabled = isImageSmoothingEnabled;
        if (isImageSmoothingEnabled) {
            this.ctx.imageSmoothingQuality = 'low';
        }

        // draw background
        if (this.background === 'checker') {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle =
                this.background ?? (isDark ? 'rgb(33, 33, 33)' : 'rgb(158,158,158)');
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.ctx.transform(...matrixToTuple(renderedMat));
        {
            this.ctx.save();

            // outline
            this.ctx.fillStyle = THEME.isDark() ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
            const scaledPixelX = 1 / renderedTransform.scaleX;
            const scaledPixelY = 1 / renderedTransform.scaleY;
            this.ctx.fillRect(
                -scaledPixelX,
                -scaledPixelY,
                this.project.width + scaledPixelX * 2,
                this.project.height + scaledPixelY * 2,
            );

            // checkerboard
            this.ctx.clearRect(0, 0, this.project.width, this.project.height);

            this.ctx.restore();
        }

        // Resolve dynamic sources once per render so the base and its mask use the same image.
        const renderedImages = new Map<TProjectViewportLayer, TRenderedImage>();
        this.compositor.draw(
            this.ctx,
            this.project.layers,
            this.project.width,
            this.project.height,
            (ctx, layer) => {
                let renderedImage = renderedImages.get(layer);
                if (!renderedImage) {
                    if (typeof layer.image === 'function') {
                        const result = layer.image(
                            this.renderedTransform,
                            this.canvas.width,
                            this.canvas.height,
                        );
                        renderedImage =
                            'image' in result && 'transform' in result
                                ? result
                                : { image: result };
                    } else {
                        renderedImage = { image: layer.image };
                    }
                    renderedImages.set(layer, renderedImage);
                }
                if (renderedImage.transform) {
                    ctx.transform(...matrixToTuple(renderedImage.transform));
                }
                ctx.drawImage(renderedImage.image, 0, 0);
            },
        );

        this.renderAfter?.(this.ctx, renderedTransform);

        DEBUG_RENDERER_ENABLED &&
            DEBUG_RENDER.render(
                this.ctx,
                this.project.width,
                this.project.height,
                renderedTransform.scaleX,
            );

        this.ctx.restore();
    }

    setSize(width: number, height: number): void {
        this.doResize = true;
        this.width = width;
        this.height = height;

        css(this.canvas, {
            width: this.doFillParent ? '100%' : this.width,
            height: this.doFillParent ? '100%' : this.height,
        });
    }

    setTransform(transform: TViewportTransform): void {
        this.transform = { ...transform };
    }

    setProject(project: TProjectViewportProject): void {
        this.project = project;
    }

    setBackground(background?: TProjectViewportBackground): void {
        this.background = background;
        this.render();
    }

    getTransform(): TViewportTransform {
        return { ...this.transform };
    }

    setUseNativeResolution(b: boolean): void {
        this.useNativeResolution = b;
        this.doResize = true;
    }

    getUseNativeResolution(): boolean {
        return this.useNativeResolution;
    }

    getElement(): HTMLElement {
        return this.canvas;
    }

    destroy(): void {
        BB.freeCanvas(this.canvas);
        this.compositor.destroy();
        THEME.removeIsDarkListener(this.onIsDark);
        removeIsPixelatedZoomListener(this.onPixelatedZoomChange);
        window.removeEventListener('resize', this.resizeListener);
    }
}
