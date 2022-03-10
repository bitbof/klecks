import {BB} from '../../bb/bb';
import {IKlBasicLayer} from '../kl.types';

/**
 * preview of image with layers. can do mix modes and opacity.
 * creates a canvas.
 *
 * p = {
 *     width: 123,
 *     height: 123,
 *     layers: [// can be changed after the fact
 *         {
 *             image: Canvas,
 *             opacity: 1,
 *             mixModeStr: 'source-over'
 *         }
 *     ]
 * }
 *
 * @param p
 * @constructor
 */
export function KlCanvasPreview(
    p: {
        width: number;
        height: number;
        layers: IKlBasicLayer[];
    }
) {
    const scale = p.width / p.layers[0].image.width;
    const width = scale > 1 ? p.layers[0].image.width : p.width;
    const height = scale > 1 ? p.layers[0].image.height : p.height;

    let canvas = BB.canvas(width, height);
    canvas.style.backgroundImage = 'url(' + BB.createCheckerDataUrl(8) + ')';
    let ctx = canvas.getContext('2d');

    BB.css(canvas, {
        width: '100%',
        height: '100%',
        imageRendering: scale > 1 ? 'pixelated' : null,
    });

    function render() {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < p.layers.length; i++) {
            ctx.globalAlpha = p.layers[i].opacity;
            ctx.globalCompositeOperation = p.layers[i].mixModeStr;
            if (canvas.width > p.layers[i].image.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(p.layers[i].image, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
    }

    setTimeout(render, 0);

    // --- interface ---
    this.getElement = function() {
        return canvas;
    };

    this.render = function() {
        render();
    };
}