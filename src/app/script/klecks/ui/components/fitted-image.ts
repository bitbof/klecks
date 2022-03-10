import {BB} from '../../../bb/bb';

/**
 * fits image into a size
 * params: {
 *    image: image,
 *    width: int,
 *    height: int
 * }
 *
 * methods:
 * getDiv()
 *
 * @param params
 * @constructor
 */
export function FittedImage(params) {
    let fit = BB.fitInto(params.image.width, params.image.height, params.width, params.height, 1);
    let w = parseInt('' + fit.width);
    let h = parseInt('' + fit.height);

    let canvas = BB.canvas(w, h);

    canvas.getContext("2d").drawImage(params.image, 0, 0, w, h);
    BB.css(canvas, {
        display: "block",
        boxShadow: "0 0 0 1px #aaa"
    });

    this.getElement = function() {
        return canvas;
    };
}