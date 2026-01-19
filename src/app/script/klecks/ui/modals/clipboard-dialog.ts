import { BB } from '../../../bb/bb';
import { showModal } from './base/showModal';
import { CropCopy } from '../components/crop-copy';
import { LANG } from '../../../language/language';
import { StatusOverlay } from '../components/status-overlay';
import { TCropRect, TRect } from '../../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { boundsToRect, intBoundsWithinArea } from '../../../bb/math/math';
import { getMultiPolyBounds } from '../../../bb/multi-polygon/get-multi-polygon-bounds';
import { Checkbox } from '../components/checkbox';
import { css } from '../../../bb/base/base';

let maskSelection = false;

export function clipboardDialog(
    parent: HTMLElement,
    getFullCanvas: (maskSelection?: boolean) => HTMLCanvasElement,
    cropCallback: (crop: TCropRect) => void,
    output: StatusOverlay,
    showCropButton: boolean,
    closeOnBlur: boolean = true,
    selection?: MultiPolygon,
): void {
    let clipboardItemIsSupported: boolean = false;
    try {
        clipboardItemIsSupported = !!ClipboardItem;
    } catch (e) {
        /* empty */
    }

    const div = document.createElement('div');
    const isSmall = window.innerWidth < 550 || window.innerHeight < 550;

    const maskToggle = selection
        ? new Checkbox({
              init: maskSelection,
              label: LANG('cropcopy-mask'),
              name: 'check-mask-selection',
              css: {
                  width: 'fit-content',
              },
              callback: (b) => {
                  maskSelection = b;
                  cropCopy.setCanvas(getFullCanvas(b));
              },
          })
        : undefined;
    const topWrapper = BB.el({
        content: [
            maskToggle?.getElement(),
            LANG('crop-drag-to-crop') +
                (clipboardItemIsSupported ? '' : '<br>' + LANG('cropcopy-click-hold')),
        ],
        css: {
            textAlign: 'center',
        },
    });
    div.append(topWrapper);

    const fullCanvas = getFullCanvas(maskSelection);
    let init: TRect | undefined;
    if (selection) {
        const bounds = getMultiPolyBounds(selection);
        const boundsInCanvas = intBoundsWithinArea(bounds, fullCanvas.width, fullCanvas.height);
        init = boundsInCanvas ? boundsToRect(boundsInCanvas) : undefined;
    }
    const cropCopy = new CropCopy({
        width: isSmall ? 340 : 540,
        height: isSmall ? 300 : 350,
        canvas: fullCanvas,
        enableRightClickCopy: true,
        init,
    });
    css(cropCopy.getElement(), {
        marginTop: '10px',
        marginLeft: '-20px',
    });
    div.append(cropCopy.getElement());

    async function toClipboard() {
        try {
            const blob = cropCopy.getCroppedBlob();
            await (navigator.clipboard as any).write([
                new ClipboardItem({
                    [blob.type]: blob,
                }),
            ]);
            setTimeout(function () {
                output.out(LANG('cropcopy-copied'), true);
            }, 200);
        } catch (err) {
            console.error((err as Error).name, (err as Error).message);
            return;
        }
    }

    const keyListener = new BB.KeyListener({
        onDown: function (keyStr, KeyEvent, comboStr) {
            if (['ctrl+c', 'cmd+c'].includes(comboStr)) {
                toClipboard();
                closeFunc && closeFunc();
            }
        },
    });

    let closeFunc: () => void;
    function blur() {
        if (closeOnBlur) {
            closeFunc?.();
        }
    }
    window.addEventListener('blur', blur);

    const buttonArr = [];
    if (clipboardItemIsSupported) {
        buttonArr.push(LANG('cropcopy-btn-copy'));
    }
    if (showCropButton) {
        buttonArr.push(LANG('cropcopy-btn-crop'));
    }
    buttonArr.push('Cancel');

    showModal({
        target: parent,
        message:
            '<b>' +
            (showCropButton
                ? `${LANG('cropcopy-title-copy')} / ${LANG('cropcopy-title-crop')}`
                : `${LANG('cropcopy-title-copy')}`) +
            '</b>',
        div: div,
        style: isSmall
            ? {}
            : {
                  width: '540px',
              },
        buttons: buttonArr,
        primaries: [LANG('cropcopy-btn-copy')],
        callback: function (result) {
            if (result === LANG('cropcopy-btn-copy')) {
                toClipboard();
            } else if (result === LANG('cropcopy-btn-crop')) {
                const rectObj = cropCopy.getCropRect();
                cropCallback({
                    left: Math.round(-rectObj.x),
                    right: Math.round(rectObj.x + rectObj.width - fullCanvas.width),
                    top: Math.round(-rectObj.y),
                    bottom: Math.round(rectObj.y + rectObj.height - fullCanvas.height),
                });
            }
            window.removeEventListener('blur', blur);
            BB.freeCanvas(cropCopy.getCroppedCanvas());
            cropCopy.destroy();
            keyListener.destroy();
        },
        clickOnEnter: LANG('cropcopy-btn-copy'),
        closeFunc: function (func) {
            closeFunc = func;
        },
    });
}
