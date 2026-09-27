import { TFxCanvas, TWrappedTexture } from '../../../fx-canvas/fx-canvas-types';
import { TProjectViewportLayerFunc, TViewportTransformXY } from './project-viewport';
import { BB } from '../../../bb/bb';
import { changeCanvasDimensions } from '../../../bb/base/change-canvas-dimensions';
import { getSharedFx } from '../../../fx-canvas/shared-fx';
import { throwIfNull } from '../../../bb/base/base';
import { applyToPoint, compose, inverse, Matrix, scale, translate } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { matrixToTuple } from '../../../bb/math/matrix-to-tuple';
import { MultiPolygon } from 'polygon-clipping';
import { drawSelectionMask, identityTransform } from '../../../bb/base/canvas';
import { transformMultiPolygon } from '../../../bb/multi-polygon/transform-multi-polygon';

type TPostMix = {
    opacity: number;
    operation: GlobalCompositeOperation;
};

export type TFxPreviewRendererParams = {
    original: Exclude<CanvasImageSource, VideoFrame | HTMLOrSVGImageElement> | HTMLImageElement;
    onUpdate: (fxCanvas: TFxCanvas, transform: TViewportTransformXY) => TFxCanvas;
    postMix?: TPostMix; // mix the result with the original
    selection?: MultiPolygon;
    isMaskingWithEmptyOriginal?: boolean;
};

export class FxPreviewRenderer {
    private readonly original: TFxPreviewRendererParams['original'];
    private readonly onUpdate: TFxPreviewRendererParams['onUpdate'];
    private readonly texture: TWrappedTexture;
    private maskCanvas: HTMLCanvasElement | undefined;
    private maskTexture: TWrappedTexture | undefined = undefined;
    private unfilteredTexture: TWrappedTexture | undefined = undefined;
    private readonly textureSource: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly fxCanvas: TFxCanvas;
    private postMix: TPostMix | undefined;
    private readonly selection: MultiPolygon | undefined;
    private readonly isMaskingWithEmptyOriginal: boolean;

    private ensureViewportSize(width: number, height: number): { width: number; height: number } {
        width = Math.max(1, Math.round(width));
        height = Math.max(1, Math.round(height));

        if (
            !this.fxCanvas.getIsInitialized() ||
            this.fxCanvas.canvas.width !== width ||
            this.fxCanvas.canvas.height !== height
        ) {
            this.fxCanvas.initialize(width, height);
        }
        changeCanvasDimensions(this.textureSource, width, height);
        if (this.selection) {
            if (!this.maskCanvas) {
                this.maskCanvas = BB.canvas(width, height);
            } else {
                changeCanvasDimensions(this.maskCanvas, width, height, { ensureCleared: true });
            }
        }

        return { width, height };
    }

    private updateMask(viewportMat: Matrix): TWrappedTexture | undefined {
        if (!this.selection || !this.maskCanvas) {
            return undefined;
        }

        const ctx = BB.ctx(this.maskCanvas);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'black';
        const transformedSelection = transformMultiPolygon(this.selection, viewportMat);
        drawSelectionMask(transformedSelection, ctx);

        if (this.maskTexture) {
            this.maskTexture.loadContentsOf(this.maskCanvas);
        } else {
            this.maskTexture = this.fxCanvas.texture(this.maskCanvas);
        }
        return this.maskTexture;
    }

    private getImageToFxTransform(
        viewportTransform: TViewportTransformXY,
        width: number,
        height: number,
    ): { matrix: Matrix; transform: TViewportTransformXY } {
        const viewportMat = createMatrixFromTransform(viewportTransform);
        const viewportToImageMat = inverse(viewportMat);
        const visibleWidth =
            Math.abs(viewportToImageMat.a) * width + Math.abs(viewportToImageMat.c) * height;
        const visibleHeight =
            Math.abs(viewportToImageMat.b) * width + Math.abs(viewportToImageMat.d) * height;

        if (visibleWidth > width || visibleHeight > height) {
            return { matrix: viewportMat, transform: viewportTransform };
        }

        const viewportCenterInImage = applyToPoint(viewportToImageMat, {
            x: width / 2,
            y: height / 2,
        });
        const imageOriginX = Math.round(viewportCenterInImage.x - width / 2);
        const imageOriginY = Math.round(viewportCenterInImage.y - height / 2);
        const transform: TViewportTransformXY = {
            scaleX: 1,
            scaleY: 1,
            angleDeg: 0,
            x: -imageOriginX,
            y: -imageOriginY,
        };
        return {
            matrix: translate(transform.x, transform.y),
            transform,
        };
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TFxPreviewRendererParams) {
        this.original = p.original;
        this.onUpdate = p.onUpdate;
        this.textureSource = BB.canvas(1, 1);
        this.ctx = BB.ctx(this.textureSource);
        this.fxCanvas = throwIfNull(getSharedFx());
        this.texture = this.fxCanvas.texture(this.original);
        this.texture.setSampling('linear', 'nearest');
        this.postMix = p.postMix;
        this.selection = p.selection;
        this.isMaskingWithEmptyOriginal = !!p.isMaskingWithEmptyOriginal;
    }

    render: TProjectViewportLayerFunc = (viewportTransform, viewportWidth, viewportHeight) => {
        const viewportSize = this.ensureViewportSize(viewportWidth, viewportHeight);
        const imageToFx = this.getImageToFxTransform(
            viewportTransform,
            viewportSize.width,
            viewportSize.height,
        );
        const adjustedDrawMatrix = compose(
            imageToFx.matrix,
            scale(
                this.original.width / viewportSize.width,
                this.original.height / viewportSize.height,
            ),
        );
        const maskTexture = this.updateMask(imageToFx.matrix);

        this.fxCanvas.drawTransformed(this.texture, adjustedDrawMatrix);
        if (maskTexture && !this.isMaskingWithEmptyOriginal) {
            if (this.unfilteredTexture) {
                this.fxCanvas.copyTo(this.unfilteredTexture);
            } else {
                this.unfilteredTexture = this.fxCanvas.contents();
            }
        }

        this.onUpdate(this.fxCanvas, imageToFx.transform);
        if (maskTexture) {
            this.fxCanvas
                .multiplyAlpha()
                .mask(
                    maskTexture,
                    this.isMaskingWithEmptyOriginal ? undefined : this.unfilteredTexture,
                    true,
                )
                .unmultiplyAlpha();
        }
        this.fxCanvas.maskRect(adjustedDrawMatrix).update();

        if (this.postMix) {
            // original
            this.ctx.save();
            this.ctx.setTransform(...identityTransform);
            this.ctx.clearRect(0, 0, this.textureSource.width, this.textureSource.height);
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.setTransform(...matrixToTuple(imageToFx.matrix));
            this.ctx.drawImage(this.original, 0, 0);
            this.ctx.restore();

            // mix with filtered
            this.ctx.save();
            this.ctx.setTransform(...identityTransform);
            this.ctx.globalAlpha = this.postMix.opacity;
            this.ctx.globalCompositeOperation = this.postMix.operation;
            this.ctx.drawImage(this.fxCanvas.canvas, 0, 0);
            this.ctx.restore();
            return {
                image: this.textureSource,
                transform: inverse(imageToFx.matrix),
            };
        }

        return {
            image: this.fxCanvas.canvas,
            transform: inverse(imageToFx.matrix),
        };
    };

    setPostMix(postMix: TPostMix): void {
        this.postMix = postMix;
    }

    destroy(): void {
        BB.freeCanvas(this.textureSource);
        this.maskCanvas && BB.freeCanvas(this.maskCanvas);
        this.texture.destroy();
        this.maskTexture?.destroy();
        this.unfilteredTexture?.destroy();
    }
}
