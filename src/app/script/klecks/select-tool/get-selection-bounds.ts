import { TRect } from '../../bb/bb-types';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { intBoundsWithinArea } from '../../bb/math/math';
import { canvasBounds } from '../../bb/base/canvas';
import { MultiPolygon } from 'polygon-clipping';

// returns bounds of selection, where layer is not empty (transparent)
export function getSelectionBounds(
    selection: MultiPolygon,
    context: CanvasRenderingContext2D,
): TRect | undefined {
    const selectionBounds = getMultiPolyBounds(selection);
    // integer bounds that are within the canvas
    const canvasSelectionBounds = intBoundsWithinArea(
        selectionBounds,
        context.canvas.width,
        context.canvas.height,
        true,
    );

    // selection area outside of canvas
    if (!canvasSelectionBounds) {
        return undefined;
    }

    // bounds of where pixels are non-transparent
    return canvasBounds(context, canvasSelectionBounds);
}
