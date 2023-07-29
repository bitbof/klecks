import {BB} from '../../../bb/bb';
import {KlCanvasPreview} from '../../canvas-ui/canvas-preview';
import {FreeTransform} from './free-transform';
import {IKlBasicLayer} from '../../kl-types';
import {IRect} from '../../../bb/bb-types';

/**
 * a basic canvas where you can transform one layer(move around, rotate, scale)
 *
 * DOM Structure:
 * div
 *      innerWrapper
 *          klCanvasPreview
 *          transform.div
 *
 */
export class FreeTransformCanvas {

    private readonly rootEl: HTMLElement;
    private readonly freeTransform: FreeTransform;
    private readonly layers: IKlBasicLayer[];
    private readonly transformIndex: number;
    private readonly imageWidth: number;
    private readonly imageHeight: number;
    private readonly initTransform: IRect;
    private readonly scale: number;
    private readonly previewLayerArr: IKlBasicLayer[];
    private readonly klCanvasPreview: KlCanvasPreview;

    private updatePreview (): void {
        if (!this.freeTransform) {
            return;
        }

        const transform = this.freeTransform.getTransform();
        if (this.scale < 1) {
            transform.x *= this.scale;
            transform.y *= this.scale;
            transform.width *= this.scale;
            transform.height *= this.scale;
        }

        const destCanvas = this.previewLayerArr[this.transformIndex].image;
        const ctx = BB.ctx((destCanvas as HTMLCanvasElement));
        ctx.save();
        ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);
        BB.drawTransformedImageWithBounds(
            ctx,
            this.layers[this.transformIndex].image,
            transform,
            undefined,
            BB.testShouldPixelate(
                transform,
                transform.width / this.initTransform.width,
                transform.height / this.initTransform.height
            ),
        );
        ctx.restore();
        this.klCanvasPreview.render();
    }


    // ---- public ----
    constructor (
        p: {
            elementWidth: number;
            elementHeight: number;
            imageWidth: number;
            imageHeight: number;
            layers: IKlBasicLayer[];
            transformIndex: number;
        }
    ) {
        this.imageWidth = p.imageWidth;
        this.imageHeight = p.imageHeight;
        const previewFit = BB.fitInto(
            p.imageWidth,
            this.imageHeight,
            p.elementWidth - 20,
            p.elementHeight - 60,
            1
        );
        this.scale = previewFit.width / p.imageWidth;

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


        const innerWrapper = BB.el({
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: previewFit.width + 'px',
                height: previewFit.height + 'px',
            },
        });
        this.rootEl.append(innerWrapper);

        this.previewLayerArr = this.layers.map(item => {
            return {
                image: item.image,
                isVisible: item.isVisible,
                mixModeStr: item.mixModeStr,
                opacity: item.opacity,
            };
        });
        this.previewLayerArr[this.previewLayerArr.length - 1].image = BB.canvas(
            this.scale > 1 ? this.imageWidth : previewFit.width,
            this.scale > 1 ? this.imageHeight : previewFit.height,
        );
        this.klCanvasPreview = new KlCanvasPreview({
            width: previewFit.width,
            height: previewFit.height,
            layers: this.previewLayerArr,
        });
        innerWrapper.append(this.klCanvasPreview.getElement());

        {
            let transformSize = {
                width: this.layers[this.transformIndex].image.width * this.scale,
                height: this.layers[this.transformIndex].image.height * this.scale,
            };
            if (transformSize.width > previewFit.width || transformSize.height > previewFit.height) {
                transformSize = BB.fitInto(
                    this.layers[this.transformIndex].image.width,
                    this.layers[this.transformIndex].image.height,
                    previewFit.width,
                    previewFit.height,
                    1
                );
            }
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
                scale: this.scale,
                callback: () => {
                    this.updatePreview();
                },
            });
        }
        BB.css(this.freeTransform.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
        });
        innerWrapper.append(this.freeTransform.getElement());
        setTimeout(() => this.updatePreview(), 0);
    }


    // ---- interface ----
    move (dX: number, dY: number): void {
        this.freeTransform.move(dX, dY);
    }

    reset (): void {
        const w = this.layers[this.transformIndex].image.width;
        const h = this.layers[this.transformIndex].image.height;

        this.freeTransform.setSize(w, h);
        this.freeTransform.setPos({x: w / 2, y: h / 2});
        this.freeTransform.setAngleDeg(0);
        this.updatePreview();
    }

    setTransformFit (): void {

        const fit = BB.fitInto(
            this.layers[this.transformIndex].image.width,
            this.layers[this.transformIndex].image.height,
            this.imageWidth,
            this.imageHeight,
            1
        );

        this.freeTransform.setSize(fit.width, fit.height);
        this.freeTransform.setPos({x: fit.width / 2, y: fit.height / 2});
        this.freeTransform.setAngleDeg(0);
        this.updatePreview();
    }

    setTransformCenter (): void {
        this.freeTransform.setPos({x: this.imageWidth / 2, y: this.imageHeight / 2});
        this.freeTransform.setAngleDeg(0);
        this.updatePreview();
    }

    /**
     * gives you the transformation in the original scale
     */
    getTransformation (): any { // todo
        if (!this.freeTransform) {
            return false;
        }
        return this.freeTransform.getTransform();
    }

    getIsPixelated (): boolean {
        const transform = this.freeTransform.getTransform();
        return BB.testShouldPixelate(
            transform,
            transform.width / this.initTransform.width,
            transform.height / this.initTransform.height
        );
    }

    getElement (): HTMLElement {
        return this.rootEl;
    }

    destroy (): void {
        this.freeTransform.destroy();
        this.klCanvasPreview.destroy();
    }
}
