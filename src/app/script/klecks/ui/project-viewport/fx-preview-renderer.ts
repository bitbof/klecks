import { TFxCanvas, TWrappedTexture } from '../../../fx-canvas/fx-canvas-types';
import { TProjectViewportLayerFunc, TViewportTransformXY } from './project-viewport';
import { BB } from '../../../bb/bb';
import { getSharedFx } from '../../../fx-canvas/shared-fx';
import { throwIfNull } from '../../../bb/base/base';
import { TRect } from '../../../bb/bb-types';
import { applyToPoint, compose, identity, inverse, scale, translate } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { matrixToTuple } from '../../../bb/math/matrix-to-tuple';
import { MultiPolygon } from 'polygon-clipping';
import { drawSelectionMask } from '../../../bb/base/canvas';
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
    private texture: TWrappedTexture | undefined = undefined;
    private maskCanvas: HTMLCanvasElement | undefined = undefined; // prevent destroying the mask repeatedly
    private maskTexture: TWrappedTexture | undefined = undefined;
    private readonly textureSource: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private oldOnUpdateProps = {
        textureWidth: 0,
        textureHeight: 0,
        transform: {
            scaleX: 0,
            scaleY: 0,
            angleDeg: 0,
            x: 0,
            y: 0,
        },
    };
    private readonly fxCanvas: TFxCanvas;
    private postMix: TPostMix | undefined;
    private readonly selection: MultiPolygon | undefined;
    private readonly isMaskingWithEmptyOriginal: boolean;

    // ----------------------------------- public -----------------------------------
    constructor(p: TFxPreviewRendererParams) {
        this.original = p.original;
        this.onUpdate = p.onUpdate;
        this.textureSource = BB.canvas(1, 1);
        this.ctx = BB.ctx(this.textureSource);
        this.fxCanvas = throwIfNull(getSharedFx());
        this.postMix = p.postMix;
        this.selection = p.selection;
        this.isMaskingWithEmptyOriginal = !!p.isMaskingWithEmptyOriginal;
    }

    render: TProjectViewportLayerFunc = (viewportTransform, viewportWidth, viewportHeight) => {
        const viewportMat = createMatrixFromTransform(viewportTransform);
        const padding = 0; // render more than visible with padding < 0

        let clippedViewportRect: TRect; // rect in viewport coordinates which contains the canvas
        let transformMatrix = identity();
        {
            const topLeft = applyToPoint(viewportMat, { x: 0, y: 0 });
            const bottomRight = applyToPoint(viewportMat, {
                x: this.original.width,
                y: this.original.height,
            });
            bottomRight.x = Math.round(bottomRight.x);
            bottomRight.y = Math.round(bottomRight.y);
            const clippedTL = {
                x: Math.max(padding, topLeft.x),
                y: Math.max(padding, topLeft.y),
            };
            const clippedBR = {
                x: Math.min(viewportWidth - padding, bottomRight.x),
                y: Math.min(viewportHeight - padding, bottomRight.y),
            };
            clippedViewportRect = {
                x: clippedTL.x,
                y: clippedTL.y,
                width: clippedBR.x - clippedTL.x,
                height: clippedBR.y - clippedTL.y,
            };

            if (clippedViewportRect.width <= 0 || clippedViewportRect.height <= 0) {
                this.textureSource.width = 1;
                this.textureSource.height = 1;
                return this.textureSource;
            }
        }

        let resultTransform = compose(
            inverse(viewportMat),
            translate(padding, padding),
            translate(clippedViewportRect.x - padding, clippedViewportRect.y - padding),
        );

        const onUpdateProps = {
            textureWidth: Math.ceil(clippedViewportRect.width),
            textureHeight: Math.ceil(clippedViewportRect.height),
            transform: {
                scaleX: viewportTransform.scaleX,
                scaleY: viewportTransform.scaleY,
                angleDeg: viewportTransform.angleDeg,
                x: viewportTransform.x - clippedViewportRect.x,
                y: viewportTransform.y - clippedViewportRect.y,
            },
        };

        let tlOffsetX = 0;
        let tlOffsetY = 0;

        if (viewportTransform.scaleX > 1) {
            // what pixels of original canvas are actually visible
            const canvasTopLeft = applyToPoint(resultTransform, { x: 0, y: 0 });
            tlOffsetX = -canvasTopLeft.x;
            tlOffsetY = -canvasTopLeft.y;
            canvasTopLeft.x = Math.max(0, Math.floor(canvasTopLeft.x));
            canvasTopLeft.y = Math.max(0, Math.floor(canvasTopLeft.y));
            tlOffsetX += canvasTopLeft.x;
            tlOffsetY += canvasTopLeft.y;

            const canvasBottomRight = applyToPoint(resultTransform, {
                x: clippedViewportRect.width,
                y: clippedViewportRect.height,
            });
            canvasBottomRight.x = Math.min(this.original.width, Math.ceil(canvasBottomRight.x));
            canvasBottomRight.y = Math.min(this.original.height, Math.ceil(canvasBottomRight.y));

            const cw = canvasBottomRight.x - canvasTopLeft.x;
            const ch = canvasBottomRight.y - canvasTopLeft.y;

            onUpdateProps.textureWidth = cw;
            onUpdateProps.textureHeight = ch;
            onUpdateProps.transform = {
                scaleX: 1,
                scaleY: 1,
                angleDeg: 0,
                x: -canvasTopLeft.x,
                y: -canvasTopLeft.y,
            };

            resultTransform = compose(
                resultTransform,
                scale(viewportTransform.scaleX, viewportTransform.scaleY),
                translate(tlOffsetX, tlOffsetY),
            );
        }

        if (
            !this.texture ||
            JSON.stringify(onUpdateProps) !== JSON.stringify(this.oldOnUpdateProps) ||
            this.postMix
        ) {
            // update texture
            this.textureSource.width = onUpdateProps.textureWidth;
            this.textureSource.height = onUpdateProps.textureHeight;

            // draw original canvas into temp
            this.ctx.save();
            this.ctx.imageSmoothingEnabled = false;
            if (viewportTransform.scaleX > 1) {
                transformMatrix = createMatrixFromTransform(onUpdateProps.transform);
                this.ctx.setTransform(...matrixToTuple(transformMatrix));
            } else {
                transformMatrix = inverse(resultTransform);
                this.ctx.setTransform(...matrixToTuple(transformMatrix));
            }
            this.ctx.drawImage(this.original, 0, 0);
            this.ctx.restore();
            // debug
            /*BB.css(this.canvas, {
                position: 'absolute',
                left: '0',
                top: '0',
                zIndex: '1000',
                boxShadow: '0 0 0 1px #f00',
            });
            document.body.append(this.canvas);*/

            const propsDidChange =
                JSON.stringify(onUpdateProps) !== JSON.stringify(this.oldOnUpdateProps);
            if (!this.texture || propsDidChange) {
                if (this.texture) {
                    this.texture.loadContentsOf(this.textureSource);
                } else {
                    this.texture = this.fxCanvas.texture(this.textureSource);
                }
            }

            if (this.selection && (!this.maskTexture || propsDidChange)) {
                if (!this.maskCanvas) {
                    this.maskCanvas = BB.canvas(
                        onUpdateProps.textureWidth,
                        onUpdateProps.textureHeight,
                    );
                } else {
                    this.maskCanvas.width = onUpdateProps.textureWidth;
                    this.maskCanvas.height = onUpdateProps.textureHeight;
                }
                const ctx = BB.ctx(this.maskCanvas);
                const transformedSelection = transformMultiPolygon(this.selection, transformMatrix);
                drawSelectionMask(transformedSelection, ctx);
                if (this.maskTexture) {
                    this.maskTexture.loadContentsOf(this.maskCanvas);
                } else {
                    this.maskTexture = this.fxCanvas.texture(this.maskCanvas);
                }
            }

            if (!this.postMix) {
                this.textureSource.width = 1;
                this.textureSource.height = 1;
            }
        }
        this.oldOnUpdateProps = onUpdateProps;

        this.onUpdate(this.fxCanvas.draw(this.texture), onUpdateProps.transform);
        if (this.maskTexture) {
            this.fxCanvas
                .multiplyAlpha()
                .mask(
                    this.maskTexture,
                    this.isMaskingWithEmptyOriginal ? undefined : this.texture,
                    true,
                )
                .unmultiplyAlpha();
        }
        this.fxCanvas.update();

        if (this.postMix) {
            this.ctx.save();
            this.ctx.globalAlpha = this.postMix.opacity;
            this.ctx.globalCompositeOperation = this.postMix.operation;
            this.ctx.drawImage(this.fxCanvas, 0, 0);
            this.ctx.restore();
            return {
                image: this.textureSource,
                transform: resultTransform,
            };
        }

        return {
            image: this.fxCanvas,
            transform: resultTransform,
        };
    };

    setPostMix(postMix: TPostMix): void {
        this.postMix = postMix;
    }

    destroy(): void {
        BB.freeCanvas(this.textureSource);
        this.maskCanvas && BB.freeCanvas(this.maskCanvas);
        if (this.texture) {
            this.texture = this.fxCanvas.texture(this.textureSource);
            this.fxCanvas.draw(this.texture).update();
            this.texture && this.texture.destroy();
        }
        // I don't remember why the other texture is destroyed differently.
        this.maskTexture?.destroy();
    }
}
