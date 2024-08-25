import { BB } from '../../../bb/bb';
import { IKlBasicLayer } from '../../kl-types';
import { theme } from '../../../theme/theme';

/**
 * preview of image with layers. can do mix modes and opacity.
 * creates a canvas.
 */
export class KlCanvasPreview {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D | null;
    private readonly layers: IKlBasicLayer[];
    private readonly updateCheckerboard: () => void;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        width: number;
        height: number;
        layers: IKlBasicLayer[]; // items can be changed after the fact - but not the object
    }) {
        this.layers = p.layers;

        const scale = p.width / p.layers[0].image.width;
        const width = scale > 1 ? p.layers[0].image.width : p.width;
        const height = scale > 1 ? p.layers[0].image.height : p.height;

        this.canvas = BB.canvas(width, height);
        this.updateCheckerboard = () => {
            this.canvas.style.backgroundImage =
                'url(' + BB.createCheckerDataUrl(8, undefined, theme.isDark()) + ')';
        };
        this.updateCheckerboard();
        this.ctx = BB.ctx(this.canvas);

        BB.css(this.canvas, {
            width: '100%',
            height: '100%',
            imageRendering: scale > 1 ? 'pixelated' : undefined,
        });

        setTimeout(() => this.render(), 0);
        theme.addIsDarkListener(this.updateCheckerboard);
    }

    getElement(): HTMLCanvasElement {
        return this.canvas;
    }

    render(): void {
        if (!this.ctx) {
            return;
        }

        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (!layer.isVisible || layer.opacity === 0) {
                continue;
            }
            this.ctx.globalAlpha = this.layers[i].opacity;
            this.ctx.globalCompositeOperation = this.layers[i]
                .mixModeStr as GlobalCompositeOperation;
            if (this.canvas.width > this.layers[i].image.width) {
                this.ctx.imageSmoothingEnabled = false;
            }
            this.ctx.drawImage(this.layers[i].image, 0, 0, this.canvas.width, this.canvas.height);
        }
        this.ctx.restore();
    }

    destroy(): void {
        theme.removeIsDarkListener(this.updateCheckerboard);
    }
}
