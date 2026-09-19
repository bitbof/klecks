import { BB } from '../../bb/bb';
import { LayerCompositor } from './layer-compositor';
import { isLayerFill, TKlProject } from '../kl-types';
import { MultiPolygon } from 'polygon-clipping';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { scale } from 'transformation-matrix';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';

export function drawProject(
    project: TKlProject,
    factor: number = 1,
    selection?: MultiPolygon,
): HTMLCanvasElement {
    const canvas = BB.canvas(
        Math.max(1, Math.round(project.width * factor)),
        Math.max(1, Math.round(project.height * factor)),
    );
    const transformedSelection = selection
        ? transformMultiPolygon(
              selection,
              scale(canvas.width / project.width, canvas.height / project.height),
          )
        : undefined;
    const ctx = BB.ctx(canvas);
    ctx.save();
    if (transformedSelection) {
        ctx.clip(getSelectionPath2d(transformedSelection));
    }
    if (factor > 1) {
        ctx.imageSmoothingEnabled = false;
    }
    const compositor = new LayerCompositor();
    try {
        compositor.draw(ctx, project.layers, canvas.width, canvas.height, (targetCtx, layer) => {
            if (isLayerFill(layer.image)) {
                targetCtx.fillStyle = layer.image.fill;
                targetCtx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (layer.image instanceof Array) {
                throw new Error('not implemented');
            } else {
                targetCtx.drawImage(layer.image, 0, 0, canvas.width, canvas.height);
            }
        });
    } finally {
        compositor.destroy();
        ctx.restore();
    }
    return canvas;
}
