import {BB} from '../../../bb/bb';
import {KlCanvasPreview} from '../../canvas-ui/canvas-preview';
import {FreeTransform} from './free-transform';

/**
 * a simple canvas where you can transform one layer(move around, rotate, scale)
 *
 * params = {
 *     elementWidth: number,
 *     elementHeight: number,
 *     actualCanvasWidth: number,
 *     actualCanvasHeight: number,
 *     layerArr: [
 *         {
 *             canvas: Canvas|Image,
 *             opacity: 0-1,
 *             mixModeStr: string
 *         }
 *     ],
 *     transformIndex: number
 * }
 *
 * @param params
 * @returns {HTMLDivElement}
 * @constructor
 */
export function FreeTransformCanvas(params) {
    /*
    div
        innerWrapper
            klCanvasPreview
            transform.div
    */

    let previewFit = BB.fitInto(
        params.elementWidth - 20,
        params.elementHeight - 60,
        params.actualCanvasWidth,
        params.actualCanvasHeight,
        1
    );
    let scale = previewFit.width / params.actualCanvasWidth;

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
            justifyContent: 'center'
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

    let previewLayerArr = [];
    {
        for(let i = 0; i < params.layerArr.length; i++) {
            let canvas;
            if (i === params.transformIndex) {
                canvas = BB.canvas(previewFit.width, previewFit.height);
                let ctx = canvas.getContext('2d');
                ctx.drawImage(params.layerArr[i].canvas, 0, 0, canvas.width, canvas.height);
            } else {
                canvas = params.layerArr[i].canvas;
            }
            previewLayerArr.push({
                canvas: canvas,
                opacity: params.layerArr[i].opacity,
                mixModeStr: params.layerArr[i].mixModeStr
            });
        }
    }
    let klCanvasPreview = new KlCanvasPreview({
        width: previewFit.width,
        height: previewFit.height,
        layerArr: previewLayerArr
    });
    innerWrapper.appendChild(klCanvasPreview.getElement());


    let freeTransform;
    function updatePreviewCanvas() {
        if(!freeTransform) {
            return;
        }

        let transformationObj = freeTransform.getTransform();
        let transformLayerCanvas = previewLayerArr[params.transformIndex].canvas;
        let ctx = transformLayerCanvas.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, transformLayerCanvas.width, transformLayerCanvas.height);
        BB.drawTransformedImageOnCanvasDeprectated(
            transformLayerCanvas,
            params.layerArr[params.transformIndex].canvas,
            transformationObj
        );
        ctx.restore();
        klCanvasPreview.render();
    }

    {
        let transformSize = {
            width: params.layerArr[params.transformIndex].canvas.width * scale,
            height: params.layerArr[params.transformIndex].canvas.height * scale
        };
        if(transformSize.width > previewFit.width || transformSize.height > previewFit.height) {
            transformSize = BB.fitInto(
                previewFit.width,
                previewFit.height,
                params.layerArr[params.transformIndex].canvas.width,
                params.layerArr[params.transformIndex].canvas.height,
                1
            );
        }
        freeTransform = new FreeTransform({
            x: previewFit.width / 2,
            y: previewFit.height / 2,
            width: transformSize.width,
            height: transformSize.height,
            angle: 0,
            constrained: true,
            snapX: [0, previewFit.width],
            snapY: [0, previewFit.height],
            callback: updatePreviewCanvas
        });
    }
    BB.css(freeTransform.getElement(), {
        position: 'absolute',
        left: '0',
        top: '0'
    });
    innerWrapper.appendChild(freeTransform.getElement());
    setTimeout(updatePreviewCanvas, 0);


    // --- interface ---

    this.move = function(dX, dY) {
        freeTransform.move(dX, dY);
    };
    this.setTransformOriginal = function() {
        let w = params.layerArr[params.transformIndex].canvas.width * scale;
        let h = params.layerArr[params.transformIndex].canvas.height * scale;

        freeTransform.setSize(w, h);
        freeTransform.setPos({x: w / 2, y: h / 2});
        freeTransform.setAngle(0);
        updatePreviewCanvas();
    };
    this.setTransformFit = function() {

        let fit = BB.fitInto(
            previewFit.width,
            previewFit.height,
            params.layerArr[params.transformIndex].canvas.width,
            params.layerArr[params.transformIndex].canvas.height,
            1
        );

        freeTransform.setSize(fit.width, fit.height);
        freeTransform.setPos({x: fit.width / 2, y: fit.height / 2});
        freeTransform.setAngle(0);
        updatePreviewCanvas();
    };
    this.setTransformCenter = function() {
        freeTransform.setPos({x: previewFit.width / 2, y: previewFit.height / 2});
        freeTransform.setAngle(0);
        updatePreviewCanvas();
    };
    //gives you the transformation in the original scale
    this.getTransformation = function () {
        if (!freeTransform) {
            return false;
        }

        let trans = freeTransform.getTransform();
        trans.width /= scale;
        trans.height /= scale;
        trans.x /= scale;
        trans.y /= scale;
        return trans;
    };
    this.getElement = function() {
        return div;
    };
    this.destroy = function() {
        freeTransform.destroy();
    };
}