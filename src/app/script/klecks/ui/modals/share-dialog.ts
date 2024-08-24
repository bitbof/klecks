import {BB} from '../../../bb/bb';
import {Select} from '../components/select';
import {ColorOptions} from '../components/color-options';
import {showModal} from './base/showModal';
import {LANG} from '../../../language/language';
import {IRGB, IRGBA} from '../../kl-types';
import {ISize2D} from '../../../bb/bb-types';
import {table} from '../components/table';
import {theme} from '../../../theme/theme';
import QRCode from 'qrcode';
export function shareDialog (
    p: {
        image: Blob
    }
): void {

    const mainDiv = BB.el();
    const canvas = BB.canvas(400, 400)
    QRCode.toCanvas(canvas, "https://ai-image.manglemoose.com/result")
    mainDiv.append(canvas)
    var url = URL.createObjectURL(p.image)
    var image = new Image()
    image.src = url;
    mainDiv.append(image)

    showModal({
        target: document.body,
        message: `<b>${LANG('share-title')}</b>`,
        div: mainDiv,
        buttons: ['Ok',],
        callback: function (result) {
            if (
                result === 'Cancel'
            ) {
                return;
            }
        },
        clickOnEnter: 'Ok',
    });

}

