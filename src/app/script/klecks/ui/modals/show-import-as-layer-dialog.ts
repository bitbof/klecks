import {BB} from '../../../bb/bb';
import {FreeTransformCanvas} from '../components/free-transform-canvas';
import {popup} from './popup';

/**
 * transformObj: {angleDegree: number, translate: {x: number, y: number}, scale: {x: number, y: number}}
 *
 * @param params object - {target, klCanvas, importImage, callback(transformObj | void)}
 */
export function showImportAsLayerDialog(params) {

    let div = document.createElement("div");
    BB.appendTextDiv(div, "Adjust the position of the imported image.");
    if(params.klCanvas.isLayerLimitReached()) {
        let noteEl = BB.el({
            content: 'Layer limit reached. Image will be placed on existing layer.',
            css: {
                background: '#ff0',
                padding: '10px',
                marginTop: '5px',
                marginBottom: '5px',
                border: '1px solid #e7d321',
                borderRadius: '5px'
            }
        });
        div.appendChild(noteEl);
    }
    let isSmall = window.innerWidth < 550;

    let buttonRowEl = BB.el({
        css: {
            display: 'flex'
        }
    });
    let originalSizeBtn = BB.el({
        tagName: 'button',
        content: '1:1',
        css: {
            marginRight: '10px'
        },
        onClick: function() {
            freeTransformCanvas.setTransformOriginal();
        }
    });
    let fitSizeBtn = BB.el({
        tagName: 'button',
        content: 'Fit',
        css: {
            marginRight: '10px'
        },
        onClick: function() {
            freeTransformCanvas.setTransformFit();
        }
    });
    let centerBtn = BB.el({
        tagName: 'button',
        content: 'Center',
        css: {
            marginRight: '10px'
        },
        onClick: function() {
            freeTransformCanvas.setTransformCenter();
        }
    });
    buttonRowEl.appendChild(originalSizeBtn);
    buttonRowEl.appendChild(fitSizeBtn);
    buttonRowEl.appendChild(centerBtn);
    div.appendChild(buttonRowEl);



    let layerArr = [];
    {
        let klCanvasLayerArr = params.klCanvas.getLayers();
        for(let i = 0; i < klCanvasLayerArr.length; i++) {
            layerArr.push({
                canvas: klCanvasLayerArr[i].context.canvas,
                opacity: klCanvasLayerArr[i].opacity,
                mixModeStr: klCanvasLayerArr[i].mixModeStr
            });
        }
    }
    layerArr.push({
        canvas: params.importImage,
        opacity: 1,
        mixModeStr: 'source-over'
    });


    let freeTransformCanvas = new FreeTransformCanvas({
        elementWidth: isSmall ? 340 : 540,
        elementHeight: isSmall ? 280 : 350,
        actualCanvasWidth: params.klCanvas.getLayerContext(0).canvas.width,
        actualCanvasHeight: params.klCanvas.getLayerContext(0).canvas.height,
        layerArr: layerArr,
        transformIndex: layerArr.length - 1
    });
    BB.css(freeTransformCanvas.getElement(), {
        marginTop: '10px',
        marginLeft: '-20px'
    });
    div.appendChild(freeTransformCanvas.getElement());

    function move(x, y) {
        freeTransformCanvas.move(x, y);
    }

    let keyListener = new BB.KeyListener({
        onDown: function(keyStr) {
            if (keyStr === 'left') {
                move(-1, 0);
            }
            if (keyStr === 'right') {
                move(1, 0);
            }
            if (keyStr === 'up') {
                move(0, -1);
            }
            if (keyStr === 'down') {
                move(0, 1);
            }
        }
    });

    popup({
        target: params.target,
        message: "<b>Import Image as New Layer</b>",
        div: div,
        style: isSmall ? {} : {
            width: '500px'
        },
        buttons: ["Ok", "Cancel"],
        callback: function(buttonStr) {
            keyListener.destroy();
            freeTransformCanvas.destroy();
            BB.destroyEl(originalSizeBtn);
            BB.destroyEl(fitSizeBtn);
            BB.destroyEl(centerBtn);
            if(buttonStr === 'Ok') {

                let freeTransformTransformationObj = freeTransformCanvas.getTransformation();
                let transformObj = {
                    angleDegree: freeTransformTransformationObj.angle,
                    translate: {
                        x: Math.round(freeTransformTransformationObj.x - params.importImage.width / 2),
                        y: Math.round(freeTransformTransformationObj.y - params.importImage.height / 2)
                    },
                    scale: {
                        x: freeTransformTransformationObj.width / params.importImage.width,
                        y: freeTransformTransformationObj.height / params.importImage.height
                    }
                };

                params.callback(transformObj);
            } else {
                params.callback();
            }
        }
    });

}