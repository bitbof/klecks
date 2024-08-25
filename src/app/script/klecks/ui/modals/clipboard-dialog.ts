import { BB } from '../../../bb/bb';
import { showModal } from './base/showModal';
import { CropCopy } from '../components/crop-copy';
import { LANG } from '../../../language/language';
import { StatusOverlay } from '../components/status-overlay';
import { ICropRect } from '../../../bb/bb-types';

export function clipboardDialog(
    parent: HTMLElement,
    fullCanvas: HTMLCanvasElement,
    cropCallback: (crop: ICropRect) => void,
    output: StatusOverlay,
    showCropButton: boolean,
): void {
    let clipboardItemIsSupported: boolean = false;
    try {
        clipboardItemIsSupported = !!ClipboardItem;
    } catch (e) {
        /* empty */
    }

    const div = document.createElement('div');
    const isSmall = window.innerWidth < 550 || window.innerHeight < 550;

    const topWrapper = BB.el({
        content:
            LANG('crop-drag-to-crop') +
            (clipboardItemIsSupported ? '' : '<br>' + LANG('cropcopy-click-hold')),
        css: {
            textAlign: 'center',
        },
    });
    div.append(topWrapper);

    const cropCopy = new CropCopy({
        width: isSmall ? 340 : 540,
        height: isSmall ? 300 : 350,
        canvas: fullCanvas,
        isNotCopy: false,
        onChange: () => setTimeout(() => updateBlob()),
    });
    BB.css(cropCopy.getEl(), {
        marginTop: '10px',
        marginLeft: '-20px',
    });
    div.append(cropCopy.getEl());

    let blob: Blob | undefined = undefined;

    // Safari doesn't allow any async operations between user interaction (click) and navigator.clipboard.write.
    // It throws "NotAllowedError: the request is not allowed by the user agent or the platform in the current context,
    // possibly because the user denied permission."
    // So, we try to prepare blob beforehand.
    let cropTimeout: ReturnType<typeof setTimeout> | undefined;
    function updateBlob() {
        if (!clipboardItemIsSupported) {
            return;
        }
        clearTimeout(cropTimeout);
        cropTimeout = setTimeout(() => {
            cropCopy.getCroppedCanvas().toBlob((result) => {
                blob = result ?? undefined;
            }, 'image/png');
        }, 50);
    }

    async function toClipboard() {
        if (!blob) {
            return;
        }
        try {
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
        closeFunc && closeFunc();
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
                const rectObj = cropCopy.getRect();
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
