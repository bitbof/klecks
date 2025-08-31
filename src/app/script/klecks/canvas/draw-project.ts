import { BB } from '../../bb/bb';
import { isLayerFill, TKlProject } from '../kl-types';
import { MultiPolygon } from 'polygon-clipping';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { scale } from 'transformation-matrix';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';

export function drawProject(
    project: TKlProject,
    factor: number,
    selection?: MultiPolygon,
): HTMLCanvasElement {
    const resultCanvas = BB.canvas(
        Math.max(1, Math.round(project.width * factor)),
        Math.max(1, Math.round(project.height * factor)),
    );
    const transformedSelection = selection
        ? transformMultiPolygon(
              selection,
              scale(resultCanvas.width / project.width, resultCanvas.height / project.height),
          )
        : undefined;

    const ctx = BB.ctx(resultCanvas);
    ctx.save();
    if (transformedSelection) {
        ctx.clip(getSelectionPath2d(transformedSelection));
    }
    if (factor > 1) {
        ctx.imageSmoothingEnabled = false;
    }
    for (let i = 0; i < project.layers.length; i++) {
        const layer = project.layers[i];
        if (!layer.isVisible || layer.opacity === 0) {
            continue;
        }
        ctx.globalAlpha = layer.opacity;
        const mixModeStr = layer.mixModeStr;
        ctx.globalCompositeOperation = mixModeStr !== undefined ? mixModeStr : 'source-over';
        if (isLayerFill(layer.image)) {
            ctx.fillStyle = layer.image.fill;
            ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
        } else if (layer.image instanceof Array) {
            throw new Error('not implemented');
        } else {
            ctx.drawImage(layer.image, 0, 0, resultCanvas.width, resultCanvas.height);
        }
    }
    ctx.restore();
    return resultCanvas;
}
