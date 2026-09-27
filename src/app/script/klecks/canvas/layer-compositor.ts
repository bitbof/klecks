import { createCanvas } from '../../bb/base/create-canvas';
import { ctx, freeCanvas } from '../../bb/base/canvas';
import { changeCanvasDimensions } from '../../bb/base/change-canvas-dimensions';
import type { TKlLayer } from '../kl-types';
import { getClippingGroups } from './get-clipping-groups';

type TCompositeLayer = Omit<TKlLayer<unknown>, 'image'>;
type TDrawLayer<GLayer> = (target: CanvasRenderingContext2D, layer: GLayer) => void;

// Owns one lazily allocated scratch canvas. Callers own the output and drawing coordinates.
export class LayerCompositor {
    private canvas?: HTMLCanvasElement;

    // Returns the compositor's reusable scratch canvas.
    private drawGroup<GLayer extends TCompositeLayer>(
        layers: readonly GLayer[],
        width: number,
        height: number,
        drawLayer: TDrawLayer<GLayer>,
    ): HTMLCanvasElement {
        this.canvas ??= createCanvas(width, height);
        changeCanvasDimensions(this.canvas, width, height, { ensureCleared: true });
        if (!layers[0].isVisible) {
            return this.canvas;
        }
        const target = ctx(this.canvas);
        const draw = (layer: GLayer, mode: GlobalCompositeOperation): void => {
            target.save();
            try {
                target.globalAlpha = layer.opacity;
                target.globalCompositeOperation = mode;
                drawLayer(target, layer);
            } finally {
                target.restore();
            }
        };
        layers.forEach((layer) => {
            if (layer.isVisible && layer.opacity) {
                draw(layer, layer.mixModeStr);
            }
        });
        draw(layers[0], 'destination-atop');
        return this.canvas;
    }

    // ----------------------------------- public -----------------------------------

    draw<GLayer extends TCompositeLayer>(
        targetCtx: CanvasRenderingContext2D,
        layers: readonly GLayer[],
        clippingCanvasWidth: number,
        clippingCanvasHeight: number,
        drawLayer: TDrawLayer<GLayer>,
    ): void {
        for (const group of getClippingGroups(layers)) {
            const base = group[0];
            if (!base.isVisible || base.opacity === 0) {
                continue;
            }
            targetCtx.save();
            try {
                targetCtx.globalCompositeOperation = base.mixModeStr;
                targetCtx.globalAlpha = base.opacity;
                if (group.length === 1) {
                    drawLayer(targetCtx, base);
                } else {
                    const image = this.drawGroup(
                        group,
                        clippingCanvasWidth,
                        clippingCanvasHeight,
                        drawLayer,
                    );
                    targetCtx.globalAlpha = 1;
                    targetCtx.drawImage(image, 0, 0);
                }
            } finally {
                targetCtx.restore();
            }
        }
    }

    // Merges into the bottom layer's pixels while retaining its layer properties.
    // Returns true if drawing was needed.
    merge<GLayer extends TCompositeLayer>(
        bottomCtx: CanvasRenderingContext2D,
        bottomLayer: GLayer,
        topLayer: GLayer,
        drawLayer: TDrawLayer<GLayer>,
    ): boolean {
        const hasClipping = topLayer.hasClipping && !bottomLayer.hasClipping;
        if (
            !topLayer.isVisible ||
            topLayer.opacity === 0 ||
            (hasClipping && (!bottomLayer.isVisible || bottomLayer.opacity === 0))
        ) {
            return false;
        }

        const { width, height } = bottomCtx.canvas;
        if (hasClipping) {
            bottomCtx.save();
            try {
                const sourceCanvas = this.drawGroup(
                    [{ ...bottomLayer, opacity: 1 }, topLayer],
                    width,
                    height,
                    drawLayer,
                );
                bottomCtx.globalCompositeOperation = 'source-over';
                bottomCtx.globalAlpha = 1;
                bottomCtx.clearRect(0, 0, width, height);
                bottomCtx.drawImage(sourceCanvas, 0, 0);
            } finally {
                bottomCtx.restore();
            }
        } else {
            this.draw(bottomCtx, [topLayer], width, height, drawLayer);
        }
        return true;
    }

    destroy(): void {
        if (this.canvas) {
            freeCanvas(this.canvas);
            this.canvas = undefined;
        }
    }
}
