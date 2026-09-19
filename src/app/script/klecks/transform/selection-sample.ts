import { TRect, TSize2D, TVector2D } from '../../bb/bb-types';
import { KlCanvas } from '../canvas/kl-canvas';
import { indexBoundsToRect } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { getSelectionBounds } from '../select-tool/get-selection-bounds';
import { BB } from '../../bb/bb';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';

/**
 * image sample of the selected area. Selection mask is already applied. Only contains non-transparent bounds.
 */
export type TSelectionSample = {
    image: HTMLCanvasElement;
    // Position of image on canvas, where it was sampled.
    x: number;
    y: number;

    // Offset (positive numbers) of the image within selection bounds (when transparent pixels are cropped)
    imageOffset: TVector2D;
    selectionSize: TSize2D;
};

/**
 * Create selection sample from the current selection. If none, will create of entire layer.
 * Returns undefined if all pixels fully transparent.
 */
export function createSelectionSample(
    layerIndex: number,
    klCanvas: KlCanvas,
): TSelectionSample | undefined {
    const srcLayer = klCanvas.getLayer(layerIndex);

    const klCanvasSelection = klCanvas.getSelection();
    const hasSelection = !!klCanvasSelection;
    let selectionBounds: TRect | undefined;
    let imageBounds: TRect | undefined;
    if (hasSelection) {
        selectionBounds = indexBoundsToRect(getMultiPolyBounds(klCanvasSelection, 'index'));
        imageBounds = getSelectionBounds(klCanvasSelection, srcLayer.context);
    } else {
        const width = klCanvas.getWidth();
        const height = klCanvas.getHeight();
        imageBounds = getSelectionBounds(
            klCanvas.getSelection() ?? [
                [
                    [
                        [0, 0],
                        [width, 0],
                        [width, height],
                        [0, height],
                        [0, 0],
                    ],
                ],
            ],
            srcLayer.context,
        );
        selectionBounds = imageBounds ? { ...imageBounds } : undefined;
    }

    // empty
    if (!selectionBounds || !imageBounds) {
        return undefined;
    }

    const sampleCanvas = BB.canvas(imageBounds.width, imageBounds.height);
    const sampleCtx = BB.ctx(sampleCanvas);
    sampleCtx.save();
    sampleCtx.translate(-imageBounds.x, -imageBounds.y);
    if (klCanvasSelection) {
        sampleCtx.clip(getSelectionPath2d(klCanvasSelection));
    }
    sampleCtx.drawImage(srcLayer.canvas, 0, 0);
    sampleCtx.restore();

    return {
        image: sampleCanvas,
        x: imageBounds.x,
        y: imageBounds.y,
        imageOffset: {
            x: imageBounds.x - selectionBounds.x,
            y: imageBounds.y - selectionBounds.y,
        },
        selectionSize: {
            width: selectionBounds.width,
            height: selectionBounds.height,
        },
    };
}
