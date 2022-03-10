import {BB} from '../../../bb/bb';
import {KlCanvasPreview} from '../../canvas-ui/canvas-preview';
import {FreeTransform} from './free-transform';
import {IKlBasicLayer, IMixMode} from '../../kl.types';

/**
 * a basic canvas where you can transform one layer(move around, rotate, scale)
 *
 * @param params
 * @returns {HTMLDivElement}
 * @constructor
 */
export function FreeTransformCanvas(params: {
    elementWidth: number;
    elementHeight: number;
    imageWidth: number;
    imageHeight: number;
    layers: IKlBasicLayer[];
    transformIndex: number;
}) {
    /*
    div
        innerWrapper
            klCanvasPreview
            transform.div
    */

    let previewFit = BB.fitInto(
        params.imageWidth,
        params.imageHeight,
        params.elementWidth - 20,
        params.elementHeight - 60,
        1
    );
    let scale = previewFit.width / params.imageWidth;

    let div = BB.el({
        css: {
            width: params.elementWidth + "px",
            height: params.elementHeight + "px",
            backgroundColor: "#9e9e9e",
            boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset",
            overflow: "hidden",
            userSelect: "none",
            position: "relative",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            colorScheme: 'only light',
        }
    });
    div.oncontextmenu = function () {
        return false;
    };

    let innerWrapper = BB.el({
        css: {
            position: 'relative',
            boxShadow: '0 0 5px rgba(0,0,0,0.5)',
            width: previewFit.width + 'px',
            height: previewFit.height + 'px'
        }
    });
    div.appendChild(innerWrapper);

    let previewLayerArr = params.layers.map(item => {
        return {
            image: item.image,
            mixModeStr: item.mixModeStr,
            opacity: item.opacity,
        }
    });
    previewLayerArr[previewLayerArr.length - 1].image = BB.canvas(
        scale > 1 ? params.imageWidth : previewFit.width,
        scale > 1 ? params.imageHeight : previewFit.height,
    );
    let klCanvasPreview = new KlCanvasPreview({
        width: previewFit.width,
        height: previewFit.height,
        layers: previewLayerArr
    });
    innerWrapper.appendChild(klCanvasPreview.getElement());

    let freeTransform;
    let initTransform;
    function updatePreview() {
        if (!freeTransform) {
            return;
        }

        let transform = freeTransform.getTransform();
        if (scale < 1) {
            transform.x *= scale;
            transform.y *= scale;
            transform.width *= scale;
            transform.height *= scale;
        }

        let destCanvas = previewLayerArr[params.transformIndex].image;
        let ctx = (destCanvas as HTMLCanvasElement).getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);
        BB.drawTransformedImageWithBounds(
            ctx,
            params.layers[params.transformIndex].image,
            transform,
            null,
            BB.testShouldPixelate(transform, transform.width / initTransform.width, transform.height / initTransform.height),
        );
        ctx.restore();
        klCanvasPreview.render();
    }

    {
        let transformSize = {
            width: params.layers[params.transformIndex].image.width * scale,
            height: params.layers[params.transformIndex].image.height * scale
        };
        if (transformSize.width > previewFit.width || transformSize.height > previewFit.height) {
            transformSize = BB.fitInto(
                params.layers[params.transformIndex].image.width,
                params.layers[params.transformIndex].image.height,
                previewFit.width,
                previewFit.height,
                1
            );
        }
        initTransform = {
            x: params.imageWidth / 2,
            y: params.imageHeight / 2,
            width: params.layers[params.transformIndex].image.width,
            height: params.layers[params.transformIndex].image.height,
        };
        freeTransform = new FreeTransform({
            x: initTransform.x,
            y: initTransform.y,
            width: initTransform.width,
            height: initTransform.height,
            angleDeg: 0,
            isConstrained: true,
            snapX: [0, params.imageWidth],
            snapY: [0, params.imageHeight],
            scale: scale,
            callback: (transform) => {
                updatePreview();
            },
        });
    }
    BB.css(freeTransform.getElement(), {
        position: 'absolute',
        left: '0',
        top: '0'
    });
    innerWrapper.appendChild(freeTransform.getElement());
    setTimeout(updatePreview, 0);


    // --- interface ---

    this.move = function(dX, dY) {
        freeTransform.move(dX, dY);
    };
    this.reset = function() {
        let w = params.layers[params.transformIndex].image.width;
        let h = params.layers[params.transformIndex].image.height;

        freeTransform.setSize(w, h);
        freeTransform.setPos({x: w / 2, y: h / 2});
        freeTransform.setAngleDeg(0);
        updatePreview();
    };
    this.setTransformFit = function() {

        let fit = BB.fitInto(
            params.layers[params.transformIndex].image.width,
            params.layers[params.transformIndex].image.height,
            params.imageWidth,
            params.imageHeight,
            1
        );

        freeTransform.setSize(fit.width, fit.height);
        freeTransform.setPos({x: fit.width / 2, y: fit.height / 2});
        freeTransform.setAngleDeg(0);
        updatePreview();
    };
    this.setTransformCenter = function() {
        freeTransform.setPos({x: params.imageWidth / 2, y: params.imageHeight / 2});
        freeTransform.setAngleDeg(0);
        updatePreview();
    };
    //gives you the transformation in the original scale
    this.getTransformation = function () {
        if (!freeTransform) {
            return false;
        }
        return freeTransform.getTransform();
    };
    this.getIsPixelated = () => {
        const transform = freeTransform.getTransform();
        return BB.testShouldPixelate(transform, transform.width / initTransform.width, transform.height / initTransform.height);
    };
    this.getElement = function() {
        return div;
    };
    this.destroy = function() {
        freeTransform.destroy();
    };
}