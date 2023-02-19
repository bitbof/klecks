import {BB} from '../../../bb/bb';
import {showModal} from './base/showModal';
import {CropCopy} from '../components/crop-copy';
import {LANG} from '../../../language/language';
import {StatusOverlay} from '../components/status-overlay';
import {ICropRect} from '../../../bb/bb-types';

export function clipboardDialog (
    parent: HTMLElement,
    fullCanvas: HTMLCanvasElement,
    cropCallback: (crop: ICropRect) => void,
    output: StatusOverlay,
    showCrop: boolean, // show crop button
): void {

    let clipboardItemIsSupported: boolean = false;
    try {
        clipboardItemIsSupported = !!ClipboardItem;
    } catch (e) {}

    const div = document.createElement('div');
    const isSmall = window.innerWidth < 550 || window.innerHeight < 550;

    const topWrapper = BB.el({
        content: LANG('crop-drag-to-crop') + (clipboardItemIsSupported ? '' : '<br>' + LANG('cropcopy-click-hold')),
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
    });
    BB.css(cropCopy.getEl(), {
        marginTop: '10px',
        marginLeft: '-20px',
    });
    div.append(cropCopy.getEl());

    function toClipboard () {
        const imgURL = cropCopy.getCroppedImage().toDataURL('image/png');
        setTimeout(async function () {
            try {
                const data = await fetch(imgURL);
                const blob = await data.blob();
                await (navigator.clipboard as any).write([
                    new ClipboardItem({
                        [blob.type]: blob,
                    } as any), // todo check is possible?
                ]);
                setTimeout(function () {
                    output.out(LANG('cropcopy-copied'), true);
                }, 200);
            } catch (err) {
                console.error(err.name, err.message);
            }
        }, 0);
    }

    const keyListener = new BB.KeyListener({
        onDown: function (keyStr, KeyEvent, comboStr) {
            if (comboStr === 'ctrl+c') {
                toClipboard();
                closeFunc && closeFunc();
            }
        },
    });

    let closeFunc: () => void;
    function blur () {
        closeFunc && closeFunc();
    }
    window.addEventListener('blur', blur);

    const buttonArr = [];
    if (clipboardItemIsSupported) {
        buttonArr.push(LANG('cropcopy-btn-copy'));
    }
    if (showCrop) {
        buttonArr.push(LANG('cropcopy-btn-crop'));
    }
    buttonArr.push('Cancel');

    showModal({
        target: parent,
        message: '<b>' + (showCrop ? `${LANG('cropcopy-title-copy')} / ${LANG('cropcopy-title-crop')}` : `${LANG('cropcopy-title-copy')}`) + '</b>',
        div: div,
        style: isSmall ? {} : {
            width: '500px',
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
            cropCopy.destroy();
            keyListener.destroy();
        },
        clickOnEnter: LANG('cropcopy-btn-copy'),
        closeFunc: function (func) {
            closeFunc = func;
        },
    });
}