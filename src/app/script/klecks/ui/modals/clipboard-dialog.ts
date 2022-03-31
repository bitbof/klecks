import {BB} from '../../../bb/bb';
import {popup} from './popup';
import {CropCopy} from '../components/crop-copy';
import {LANG} from '../../../language/language';

/// <reference path="./types.d.ts" />

/**
 *
 * @param parent
 * @param fullCanvas
 * @param cropCallback
 * @param output - BB.Output
 * @param showCrop - boolean - show crop button
 */
export function clipboardDialog(parent, fullCanvas, cropCallback, output, showCrop) {
    const div = document.createElement("div");
    const isSmall = window.innerWidth < 550 || window.innerHeight < 550;

    let topWrapper = BB.el({
        content: LANG('crop-drag-to-crop'),
        css: {
            textAlign: 'center'
        }
    });
    div.appendChild(topWrapper);


    let cropCopy = new CropCopy({
        width: isSmall ? 340 : 540,
        height: isSmall ? 300 : 350,
        canvas: fullCanvas
    });
    BB.css(cropCopy.getEl(), {
        marginTop: '10px',
        marginLeft: '-20px',
        borderTop: '1px solid #bbb',
        borderBottom: '1px solid #bbb'
    });
    div.appendChild(cropCopy.getEl());

    function toClipboard() {
        const imgURL = cropCopy.getCroppedImage().toDataURL('image/png');
        setTimeout(async function() {
            try {
                const data = await fetch(imgURL);
                const blob = await data.blob();
                await (navigator.clipboard as any).write([
                    new ClipboardItem({
                        [blob.type]: blob
                    } as any) // todo check is possible?
                ]);
                setTimeout(function() {
                    output.out(LANG('cropcopy-copied'), true);
                }, 200);
            } catch (err) {
                console.error(err.name, err.message);
            }
        }, 0);
    }

    let keyListener = new BB.KeyListener({
        onDown: function(keyStr, KeyEvent, comboStr) {
            if (comboStr === 'ctrl+c') {
                toClipboard();
                closefunc();
            }
        }
    });

    let closefunc;
    function blur() {
        closefunc();
    }
    BB.addEventListener(window, "blur", blur);
    popup({
        target: parent,
        message: '<b>' + (showCrop ? `${LANG('cropcopy-title-copy')} / ${LANG('cropcopy-title-crop')}` : `${LANG('cropcopy-title-copy')}`) + '</b>',
        div: div,
        style: isSmall ? {} : {
            width: "500px"
        },
        buttons: showCrop ? [LANG('cropcopy-btn-copy'), LANG('cropcopy-btn-crop'), 'Cancel'] : [LANG('cropcopy-btn-copy'), 'Cancel'],
        primaries: [LANG('cropcopy-btn-copy')],
        callback: function (result) {
            if (result === LANG('cropcopy-btn-copy')) {
                toClipboard();
            } else if (result === LANG('cropcopy-btn-crop')) {
                let rectObj = cropCopy.getRect();
                cropCallback({
                    left: Math.round(-rectObj.x),
                    right: Math.round(rectObj.x + rectObj.width - fullCanvas.width),
                    top: Math.round(-rectObj.y),
                    bottom: Math.round(rectObj.y + rectObj.height - fullCanvas.height)
                });
            }
            BB.removeEventListener(window, "blur", blur);
            cropCopy.destroy();
            keyListener.destroy();
        },
        clickOnEnter: LANG('cropcopy-btn-copy'),
        closefunc: function (func) {
            closefunc = func;
        }
    });
}