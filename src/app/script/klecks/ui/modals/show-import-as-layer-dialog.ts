import {BB} from '../../../bb/bb';
import {FreeTransformCanvas} from '../components/free-transform-canvas';
import {popup} from './popup';
import {KlCanvas} from '../../canvas/kl-canvas';
import {IKlBasicLayer} from '../../kl.types';
import {LANG} from '../../../language/language';

export function showImportAsLayerDialog(
    params: {
        target: HTMLElement;
        klCanvas: KlCanvas;
        importImage: HTMLImageElement | HTMLCanvasElement;
        callback: (
            p?: {x: number, y: number, width:number, height: number, angleDeg: number},
            isPixelated?: boolean
        ) => void;
    }
): void {

    let div = document.createElement("div");
    BB.appendTextDiv(div, LANG('import-as-layer-description'));
    if (params.klCanvas.isLayerLimitReached()) {
        let noteEl = BB.el({
            content: LANG('import-as-layer-limit-reached'),
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
            freeTransformCanvas.reset();
        }
    });
    let fitSizeBtn = BB.el({
        tagName: 'button',
        content: LANG('import-as-layer-fit'),
        css: {
            marginRight: '10px'
        },
        onClick: function() {
            freeTransformCanvas.setTransformFit();
        }
    });
    let centerBtn = BB.el({
        tagName: 'button',
        content: LANG('center'),
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



    let layers: IKlBasicLayer[] = [];
    {
        let klCanvasLayerArr = params.klCanvas.getLayers();
        for (let i = 0; i < klCanvasLayerArr.length; i++) {
            layers.push({
                image: klCanvasLayerArr[i].context.canvas,
                opacity: klCanvasLayerArr[i].opacity,
                mixModeStr: klCanvasLayerArr[i].mixModeStr
            });
        }
    }
    layers.push({
        image: params.importImage,
        opacity: 1,
        mixModeStr: 'source-over'
    });


    let freeTransformCanvas = new FreeTransformCanvas({
        elementWidth: isSmall ? 340 : 540,
        elementHeight: isSmall ? 280 : 350,
        imageWidth: params.klCanvas.getLayerContext(0).canvas.width,
        imageHeight: params.klCanvas.getLayerContext(0).canvas.height,
        layers: layers,
        transformIndex: layers.length - 1,
    });
    BB.css(freeTransformCanvas.getElement(), {
        marginTop: '10px',
        marginLeft: '-20px',
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
        message: `<b>${LANG('import-as-layer-title')}</b>`,
        div: div,
        style: isSmall ? null : {
            width: '500px'
        },
        buttons: ["Ok", "Cancel"],
        clickOnEnter: 'Ok',
        callback: function(buttonStr) {
            keyListener.destroy();
            freeTransformCanvas.destroy();
            BB.destroyEl(originalSizeBtn);
            BB.destroyEl(fitSizeBtn);
            BB.destroyEl(centerBtn);
            if (buttonStr === 'Ok') {
                params.callback(freeTransformCanvas.getTransformation(), freeTransformCanvas.getIsPixelated());
            } else {
                params.callback();
            }
        }
    });

}