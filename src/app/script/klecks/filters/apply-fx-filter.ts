import { TFxCanvas, TWrappedTexture } from '../../fx-canvas/fx-canvas-types';
import { BB } from '../../bb/bb';
import { drawSelectionMask } from '../../bb/base/canvas';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { integerBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { MultiPolygon } from 'polygon-clipping';
import { KlHistory } from '../history/kl-history';
import { getSharedFx } from '../../fx-canvas/shared-fx';

export function applyFxFilter(
    context: CanvasRenderingContext2D,
    selection: MultiPolygon | undefined,
    applyFn: (fxCanvas: TFxCanvas) => void,
    klHistory: KlHistory,
): boolean {
    const fxCanvas = getSharedFx();
    if (!fxCanvas) {
        return false; // todo more specific error?
    }

    let maskTexture: TWrappedTexture | undefined;
    if (selection) {
        const maskCanvas = BB.canvas(context.canvas.width, context.canvas.height);
        const maskContext = BB.ctx(maskCanvas);
        drawSelectionMask(selection, maskContext);
        maskTexture = fxCanvas.texture(maskCanvas);
        BB.freeCanvas(maskCanvas);
    }
    const originalTexture = fxCanvas.texture(context.canvas);
    fxCanvas.draw(originalTexture);
    applyFn(fxCanvas);
    if (maskTexture) {
        fxCanvas.multiplyAlpha().mask(maskTexture, originalTexture, true).unmultiplyAlpha();
        maskTexture.destroy();
    }
    originalTexture.destroy();
    fxCanvas.update();
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.drawImage(fxCanvas, 0, 0);

    klHistory.push(
        getPushableLayerChange(
            klHistory.getComposed(),
            canvasToLayerTiles(
                context.canvas,
                selection ? integerBounds(getMultiPolyBounds(selection)) : undefined,
            ),
        ),
    );
    return true;
}
