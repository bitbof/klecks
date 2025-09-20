import { BB } from '../../../bb/bb';
import { FreeTransform } from './free-transform';
import { TKlBasicLayer } from '../../kl-types';
import { TRect } from '../../../bb/bb-types';
import { Preview } from '../project-viewport/preview';
import { TProjectViewportProject } from '../project-viewport/project-viewport';
import { TFreeTransform } from './free-transform-utils';
import { css } from '../../../bb/base/base';

/**
 * a basic canvas where you can transform one layer(move around, rotate, scale)
 */
export class FreeTransformCanvas {
    private readonly rootEl: HTMLElement;
    private readonly freeTransform: FreeTransform;
    private readonly layers: TKlBasicLayer[];
    private readonly transformIndex: number;
    private readonly imageWidth: number;
    private readonly imageHeight: number;
    private readonly initTransform: TRect;
    private readonly previewLayerArr: TProjectViewportProject['layers'];
    private readonly preview: Preview;
    private readonly previewCanvas: HTMLCanvasElement;
    private algorithm: 'pixelated' | 'smooth' = 'smooth';

    private updatePreview(): void {
        const transform = this.freeTransform.getValue();

        const ctx = BB.ctx(this.previewCanvas);
        ctx.save();
        ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        BB.drawTransformedImageWithBounds(
            ctx,
            this.layers[this.transformIndex].image,
            transform,
            undefined,
            this.algorithm === 'pixelated' ||
                BB.testShouldPixelate(
                    transform,
                    transform.width / this.initTransform.width,
                    transform.height / this.initTransform.height,
                ),
        );
        ctx.restore();
        this.preview.render();
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        elementWidth: number;
        elementHeight: number;
        imageWidth: number;
        imageHeight: number;
        layers: TKlBasicLayer[];
        transformIndex: number;
    }) {
        this.imageWidth = p.imageWidth;
        this.imageHeight = p.imageHeight;

        this.rootEl = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: p.elementWidth + 'px',
                height: p.elementHeight + 'px',
            },
        });
        this.rootEl.oncontextmenu = () => {
            return false;
        };
        this.layers = p.layers;
        this.transformIndex = p.transformIndex;

        this.previewLayerArr = this.layers.map((item) => {
            return {
                image: item.image,
                isVisible: item.isVisible,
                mixModeStr: item.mixModeStr ?? 'source-over',
                opacity: item.opacity,
                hasClipping: false,
            };
        });
        this.previewCanvas = BB.canvas(this.imageWidth, this.imageHeight);
        this.previewLayerArr[this.previewLayerArr.length - 1].image = this.previewCanvas;

        this.preview = new Preview({
            width: p.elementWidth,
            height: p.elementHeight,
            project: {
                width: p.imageWidth,
                height: p.imageHeight,
                layers: this.previewLayerArr,
            },
            hasEditMode: true,
            onModeChange: (m) => {
                css(this.freeTransform.getElement(), {
                    pointerEvents: m === 'edit' ? '' : 'none',
                    opacity: m === 'edit' ? '' : '0.5',
                });
            },
            onTransformChange: (transform) => {
                this.freeTransform.setViewportTransform(transform);
            },
            padding: 30,
        });
        css(this.preview.getElement(), {
            overflow: 'hidden',
            marginLeft: '-20px',
            marginRight: '-20px',
        });
        this.rootEl.append(this.preview.getElement());

        {
            this.initTransform = {
                x: this.imageWidth / 2,
                y: this.imageHeight / 2,
                width: this.layers[this.transformIndex].image.width,
                height: this.layers[this.transformIndex].image.height,
            };
            this.freeTransform = new FreeTransform({
                x: this.initTransform.x,
                y: this.initTransform.y,
                width: this.initTransform.width,
                height: this.initTransform.height,
                angleDeg: 0,
                isConstrained: true,
                snapX: [0, this.imageWidth],
                snapY: [0, this.imageHeight],
                viewportTransform: this.preview.getTransform(),
                callback: () => {
                    this.updatePreview();
                },
            });
            this.preview.getElement().append(this.freeTransform.getElement());
        }
        css(this.freeTransform.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
        });
        setTimeout(() => this.updatePreview(), 0);
    }

    // ---- interface ----
    move(dX: number, dY: number): void {
        this.freeTransform.move(dX, dY);
    }

    reset(): void {
        const w = this.layers[this.transformIndex].image.width;
        const h = this.layers[this.transformIndex].image.height;

        this.freeTransform.setSize(w, h);
        this.freeTransform.setPos({ x: w / 2, y: h / 2 });
        this.freeTransform.setAngleDeg(0);
        this.updatePreview();
    }

    setTransformFit(): void {
        const fit = BB.fitInto(
            this.layers[this.transformIndex].image.width,
            this.layers[this.transformIndex].image.height,
            this.imageWidth,
            this.imageHeight,
            1,
        );

        this.freeTransform.setSize(fit.width, fit.height);
        this.freeTransform.setPos({ x: fit.width / 2, y: fit.height / 2 });
        this.freeTransform.setAngleDeg(0);
        this.updatePreview();
    }

    setTransformCenter(): void {
        this.freeTransform.setPos({
            x: this.imageWidth / 2,
            y: this.imageHeight / 2,
        });
        this.freeTransform.setAngleDeg(0);
        this.updatePreview();
    }

    setAlgorithm(algo: 'pixelated' | 'smooth'): void {
        this.algorithm = algo;
        this.updatePreview();
    }

    /**
     * gives you the transformation in the original scale
     */
    getTransformation(): TFreeTransform {
        return this.freeTransform.getValue();
    }

    getIsPixelated(): boolean {
        const transform = this.freeTransform.getValue();
        return (
            this.algorithm === 'pixelated' ||
            BB.testShouldPixelate(
                transform,
                transform.width / this.initTransform.width,
                transform.height / this.initTransform.height,
            )
        );
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.freeTransform.destroy();
        this.preview.destroy();
        BB.freeCanvas(this.previewCanvas);
    }
}
