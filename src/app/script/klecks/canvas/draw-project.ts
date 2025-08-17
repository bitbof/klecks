import { BB } from '../../bb/bb';
import { isLayerFill, TKlProject } from '../kl-types';

export function drawProject(project: TKlProject, factor: number): HTMLCanvasElement {
    const resultCanvas = BB.canvas(
        Math.max(1, Math.round(project.width * factor)),
        Math.max(1, Math.round(project.height * factor)),
    );
    const ctx = BB.ctx(resultCanvas);
    ctx.save();
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
