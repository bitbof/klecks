import { BB } from '../../../bb/bb';
import { FreeTransform } from './free-transform';
import { IKlBasicLayer } from '../../kl-types';
import { IRect } from '../../../bb/bb-types';
import { Preview } from '../project-viewport/preview';
import { TProjectViewportProject } from '../project-viewport/project-viewport';
import { css } from '@emotion/css/dist/emotion-css.cjs';
import { IFreeTransform } from './free-transform-utils';

/**
 * a basic canvas where you can transform one layer(move around, rotate, scale)
 */
export class FreeTransformCanvas {
    private readonly rootEl: HTMLElement;
    private readonly freeTransform: FreeTransform;
    private readonly layers: IKlBasicLayer[];
    private readonly transformIndex: number;
    private readonly imageWidth: number;
    private readonly imageHeight: number;
    private readonly initTransform: IRect;
    private readonly previewLayerArr: TProjectViewportProject['layers'];
    private readonly preview: Preview;
    private readonly previewCanvas: HTMLCanvasElement;

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
        layers: IKlBasicLayer[];
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
                this.freeTransform.getElement().style.pointerEvents = m === 'edit' ? '' : 'none';
                this.freeTransform.getElement().style.opacity = m === 'edit' ? '' : '0.5';
            },
            onTransformChange: (transform) => {
                this.freeTransform.setViewportTransform(transform);
            },
            padding: 30,
        });
        this.preview.getElement().classList.add(
            css({
                overflow: 'hidden',
                marginLeft: '-20px',
                marginRight: '-20px',
            }),
        );
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
        BB.css(this.freeTransform.getElement(), {
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

    /**
     * gives you the transformation in the original scale
     */
    getTransformation(): IFreeTransform {
        return this.freeTransform.getValue();
    }

    getIsPixelated(): boolean {
        const transform = this.freeTransform.getValue();
        return BB.testShouldPixelate(
            transform,
            transform.width / this.initTransform.width,
            transform.height / this.initTransform.height,
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
