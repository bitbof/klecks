import { IRGB } from '../kl-types';
import { TKlCanvasLayer } from './kl-canvas';
import { BB } from '../../bb/bb';

export class Eyedropper {
    private readonly pickCanvas: HTMLCanvasElement; // canvas to draw into for color picker

    // ----------------------------------- public -----------------------------------
    constructor() {
        this.pickCanvas = BB.canvas(1, 1);
    }

    getColorAt(x: number, y: number, layers: TKlCanvasLayer[]): IRGB {
        x = Math.floor(x);
        y = Math.floor(y);
        const ctx = BB.ctx(this.pickCanvas);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 1, 1);
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer.isVisible || layer.opacity === 0) {
                continue;
            }
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.mixModeStr;
            ctx.drawImage(layer.canvas, -x, -y);
        }
        ctx.restore();
        const imData = ctx.getImageData(0, 0, 1, 1);
        return new BB.RGB(imData.data[0], imData.data[1], imData.data[2]);
    }

    reset(): void {
        // todo
    }
}
