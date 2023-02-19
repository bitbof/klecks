import {BB} from '../../bb/bb';
import {IKlProject} from '../kl-types';

export function drawProject (project: IKlProject, factor: number): HTMLCanvasElement {
    const resultCanvas = BB.canvas(
        Math.max(1, Math.round(project.width * factor)),
        Math.max(1, Math.round(project.height * factor))
    );
    const ctx = BB.ctx(resultCanvas);
    ctx.save();
    if (factor > 1) {
        ctx.imageSmoothingEnabled = false;
    }
    for (let i = 0; i < project.layers.length; i++) {
        if (project.layers[i].opacity === 0) {
            continue;
        }
        ctx.globalAlpha = project.layers[i].opacity;
        const mixModeStr = project.layers[i].mixModeStr;
        ctx.globalCompositeOperation = mixModeStr !== undefined ? mixModeStr : 'source-over';
        ctx.drawImage(project.layers[i].image, 0, 0, resultCanvas.width, resultCanvas.height);
    }
    ctx.restore();
    return resultCanvas;
}