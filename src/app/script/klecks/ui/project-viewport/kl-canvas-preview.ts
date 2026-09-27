import { BB } from '../../../bb/bb';
import { LayerCompositor } from '../../canvas/layer-compositor';
import { TKlBasicLayer } from '../../kl-types';
import { css } from '../../../bb/base/base';

/**
 * preview of image with layers. can do mix modes and opacity.
 * creates a canvas.
 */
export class KlCanvasPreview {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D | null;
    private readonly compositor = new LayerCompositor();
    private layers: TKlBasicLayer[];

    // ----------------------------------- public -----------------------------------
    constructor(p: { width: number; height: number; layers: TKlBasicLayer[] }) {
        this.layers = p.layers;

        const scale = p.width / p.layers[0].image.width;
        const width = scale > 1 ? p.layers[0].image.width : p.width;
        const height = scale > 1 ? p.layers[0].image.height : p.height;

        this.canvas = BB.canvas(width, height);
        this.ctx = BB.ctx(this.canvas);

        css(this.canvas, {
            width: '100%',
            height: '100%',
            imageRendering: scale > 1 ? 'pixelated' : undefined,
            background: 'var(--kl-checkerboard-background)',
            backgroundSize: 16,
        });

        setTimeout(() => this.render(), 0);
    }

    getElement(): HTMLCanvasElement {
        return this.canvas;
    }

    setLayers(layers: TKlBasicLayer[]): void {
        this.layers = layers;
        this.render();
    }

    render(): void {
        if (!this.ctx) {
            return;
        }
        const ctx = this.ctx;

        ctx.save();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.compositor.draw(
            ctx,
            this.layers,
            this.canvas.width,
            this.canvas.height,
            (target, layer) => {
                if (this.canvas.width > layer.image.width) {
                    target.imageSmoothingEnabled = false;
                }
                target.drawImage(layer.image, 0, 0, this.canvas.width, this.canvas.height);
            },
        );
        ctx.restore();
    }

    destroy(): void {
        BB.freeCanvas(this.canvas);
        this.compositor.destroy();
    }
}
