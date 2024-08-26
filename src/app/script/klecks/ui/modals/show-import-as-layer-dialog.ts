import { BB } from '../../../bb/bb';
import { FreeTransformCanvas } from '../components/free-transform-canvas';
import { showModal } from './base/showModal';
import { KlCanvas } from '../../canvas/kl-canvas';
import { IKlBasicLayer } from '../../kl-types';
import { LANG } from '../../../language/language';
import { testIsSmall } from '../utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../utils/preview-size';

export function showImportAsLayerDialog(params: {
    target: HTMLElement;
    klCanvas: KlCanvas;
    importImage: HTMLImageElement | HTMLCanvasElement;
    callback: (
        p?: {
            x: number;
            y: number;
            width: number;
            height: number;
            angleDeg: number;
        },
        isPixelated?: boolean,
    ) => void;
}): void {
    const div = document.createElement('div');
    BB.appendTextDiv(div, LANG('import-as-layer-description'));
    if (params.klCanvas.isLayerLimitReached()) {
        const noteEl = BB.el({
            content: LANG('import-as-layer-limit-reached'),
            css: {
                background: '#ff0',
                padding: '10px',
                marginTop: '5px',
                marginBottom: '5px',
                border: '1px solid #e7d321',
                borderRadius: '5px',
            },
        });
        div.append(noteEl);
    }
    const isSmall = testIsSmall();

    const buttonRowEl = BB.el({
        css: {
            display: 'flex',
        },
    });
    const originalSizeBtn = BB.el({
        tagName: 'button',
        content: '1:1',
        css: {
            marginRight: '10px',
        },
        onClick: function () {
            freeTransformCanvas.reset();
        },
    });
    const fitSizeBtn = BB.el({
        tagName: 'button',
        content: LANG('import-as-layer-fit'),
        css: {
            marginRight: '10px',
        },
        onClick: function () {
            freeTransformCanvas.setTransformFit();
        },
    });
    const centerBtn = BB.el({
        tagName: 'button',
        content: LANG('center'),
        css: {
            marginRight: '10px',
        },
        onClick: function () {
            freeTransformCanvas.setTransformCenter();
        },
    });
    buttonRowEl.append(originalSizeBtn, fitSizeBtn, centerBtn);
    div.append(buttonRowEl);

    const layers: IKlBasicLayer[] = [];
    {
        const klCanvasLayerArr = params.klCanvas.getLayers();
        for (let i = 0; i < klCanvasLayerArr.length; i++) {
            layers.push({
                image: klCanvasLayerArr[i].context.canvas,
                isVisible: klCanvasLayerArr[i].isVisible,
                opacity: klCanvasLayerArr[i].opacity,
                mixModeStr: klCanvasLayerArr[i].mixModeStr,
            });
        }
    }
    layers.push({
        image: params.importImage,
        isVisible: true,
        opacity: 1,
        mixModeStr: 'source-over',
    });

    const freeTransformCanvas = new FreeTransformCanvas({
        elementWidth: getPreviewWidth(isSmall),
        elementHeight: getPreviewHeight(isSmall) + 50,
        imageWidth: params.klCanvas.getLayerContext(0)!.canvas.width,
        imageHeight: params.klCanvas.getLayerContext(0)!.canvas.height,
        layers: layers,
        transformIndex: layers.length - 1,
    });
    BB.css(freeTransformCanvas.getElement(), {
        marginTop: '10px',
        marginLeft: '-20px',
    });
    div.append(freeTransformCanvas.getElement());

    function move(x: number, y: number): void {
        freeTransformCanvas.move(x, y);
    }

    const keyListener = new BB.KeyListener({
        onDown: function (keyStr) {
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
        },
    });

    showModal({
        target: params.target,
        message: `<b>${LANG('import-as-layer-title')}</b>`,
        div: div,
        style: isSmall
            ? undefined
            : {
                  width: '540px',
              },
        buttons: ['Ok', 'Cancel'],
        clickOnEnter: 'Ok',
        callback: function (buttonStr) {
            keyListener.destroy();
            freeTransformCanvas.destroy();
            BB.destroyEl(originalSizeBtn);
            BB.destroyEl(fitSizeBtn);
            BB.destroyEl(centerBtn);
            if (buttonStr === 'Ok') {
                params.callback(
                    freeTransformCanvas.getTransformation(),
                    freeTransformCanvas.getIsPixelated(),
                );
            } else {
                params.callback();
            }
        },
    });
}
