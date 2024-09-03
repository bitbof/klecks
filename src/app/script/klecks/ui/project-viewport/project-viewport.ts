import { TMixMode } from '../../kl-types';
import { BB } from '../../../bb/bb';
import { throwIfNull } from '../../../bb/base/base';
import { theme } from '../../../theme/theme';
import { Matrix, inverse, compose } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { matrixToTuple } from '../../../bb/math/matrix-to-tuple';

function fixScale(scale: number, pixels: number): number {
    return Math.round(pixels * scale) / pixels;
}

// width, height - viewport size
export type TProjectViewportLayerFunc = (
    viewportTransform: TViewportTransformXY,
    viewportWidth: number,
    viewportHeight: number,
) => CanvasImageSource | { image: CanvasImageSource; transform: Matrix }; // image drawn with ctx.setTransform(transform)

export type TProjectViewportProject = {
    width: number;
    height: number;
    layers: {
        image: CanvasImageSource | TProjectViewportLayerFunc;
        isVisible: boolean;
        opacity: number;
        mixModeStr: TMixMode;
        hasClipping: boolean;
    }[];
};

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

export type TProjectViewportParams = {
    width: number;
    height: number;
    project: TProjectViewportProject;
    transform: TViewportTransform;
    drawBackground?: boolean;
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
    private transform: TViewportTransform;

    private project: TProjectViewportProject;
    private useNativeResolution: boolean;

    private pattern: CanvasPattern;
    private resFactor: number;
    private readonly drawBackground: boolean;
    private doResize: boolean = true;
    private readonly doFillParent: boolean;
    private readonly renderAfter:
        | undefined
        | ((ctx: CanvasRenderingContext2D, transform: TViewportTransformXY) => void);

    private onIsDark = (): void => {
        this.pattern = throwIfNull(
            this.ctx.createPattern(BB.createCheckerCanvas(10, theme.isDark()), 'repeat'),
        );
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
        this.drawBackground = p.drawBackground ?? true;
        this.doFillParent = !!p.fillParent;
        this.renderAfter = p.renderAfter;

        this.transform = {
            ...p.transform,
        };

        this.resFactor = this.useNativeResolution ? devicePixelRatio : 1;
        this.canvas = BB.canvas(this.width * this.resFactor, this.height * this.resFactor);
        this.ctx = BB.ctx(this.canvas);
        BB.css(this.canvas, {
            width: this.doFillParent ? '100%' : this.width + 'px',
            height: this.doFillParent ? '100%' : this.height + 'px',
            imageRendering:
                Math.round(devicePixelRatio) !== devicePixelRatio ? undefined : 'pixelated',
            display: 'block',
        });
        window.addEventListener('resize', this.resizeListener);

        this.pattern = throwIfNull(
            this.ctx.createPattern(BB.createCheckerCanvas(10, theme.isDark()), 'repeat'),
        );
        theme.addIsDarkListener(this.onIsDark);

        // this.render();
    }

    render(optimizeForAnimation?: boolean): void {
        const isDark = theme.isDark();
        const transform = {
            ...this.transform,
            x: this.transform.x,
            y: this.transform.y,
            scale: this.transform.scale,
        };

        if (this.doResize) {
            this.doResize = false;
            this.resFactor = this.useNativeResolution ? devicePixelRatio : 1;
            this.canvas.width = Math.round(this.width * this.resFactor);
            this.canvas.height = Math.round(this.height * this.resFactor);
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

        this.ctx.save();

        if (
            renderedTransform.scaleX >= 4 ||
            (renderedTransform.scaleX === 1 && renderedTransform.angleDeg === 0)
        ) {
            this.ctx.imageSmoothingEnabled = false;
        } else {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'low'; // art.scale >= 1 ? 'low' : 'medium';
        }
        // this.ctx.imageSmoothingEnabled = false;

        if (this.drawBackground) {
            this.ctx.fillStyle = isDark ? 'rgb(33, 33, 33)' : 'rgb(158,158,158)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = this.pattern;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // this.ctx.scale(this.resFactor, this.resFactor);
        this.ctx.translate(renderedTransform.x, renderedTransform.y);
        this.ctx.scale(renderedTransform.scaleX, renderedTransform.scaleY);
        this.ctx.rotate((renderedTransform.angleDeg / 180) * Math.PI);

        if (this.drawBackground) {
            this.ctx.save();

            this.ctx.fillStyle = theme.isDark() ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
            const scaledPixelX = 1 / renderedTransform.scaleX;
            const scaledPixelY = 1 / renderedTransform.scaleY;
            this.ctx.fillRect(
                -scaledPixelX,
                -scaledPixelY,
                this.project.width + scaledPixelX * 2,
                this.project.height + scaledPixelY * 2,
            );

            this.ctx.fillStyle = this.pattern;
            try {
                // setTransform got browser support since 2018-2020. catch if fails.
                this.pattern.setTransform(inverse(renderedMat));
            } catch (e) {
                /* */
            }
            this.ctx.fillRect(0, 0, this.project.width, this.project.height);

            this.ctx.restore();
        }

        this.project.layers.forEach((layer) => {
            if (!layer.isVisible || !layer.opacity) {
                return;
            }
            this.ctx.save();
            this.ctx.globalCompositeOperation = layer.mixModeStr;
            this.ctx.globalAlpha = layer.opacity;

            let image: CanvasImageSource = {} as CanvasImageSource;
            if (typeof layer.image === 'function') {
                const res = layer.image(renderedTransform, this.canvas.width, this.canvas.height);
                if ('image' in res && 'transform' in res) {
                    image = res.image;
                    this.ctx.setTransform(...matrixToTuple(compose(renderedMat, res.transform)));
                } else {
                    image = res;
                }
            } else {
                image = layer.image;
            }
            this.ctx.drawImage(image, 0, 0); // , this.project.width, this.project.height);
            this.ctx.restore();
        });

        this.renderAfter?.(this.ctx, renderedTransform);

        this.ctx.restore();
    }

    setSize(width: number, height: number): void {
        this.doResize = true;
        this.width = width;
        this.height = height;

        BB.css(this.canvas, {
            width: this.doFillParent ? '100%' : this.width + 'px',
            height: this.doFillParent ? '100%' : this.height + 'px',
        });
    }

    setTransform(transform: TViewportTransform): void {
        this.transform = { ...transform };
    }

    setProject(project: TProjectViewportProject): void {
        this.project = project;
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
        theme.removeIsDarkListener(this.onIsDark);
        window.removeEventListener('resize', this.resizeListener);
    }
}
