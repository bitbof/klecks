import {BB} from '../../../bb/bb';
import {Select} from '../components/select';
import {ColorOptions} from '../components/color-options';
import {showModal} from './base/showModal';
import {LANG} from '../../../language/language';
import {IRGB, IRGBA} from '../../kl-types';
import {IKeyString, ISize2D} from '../../../bb/bb-types';
import {table} from '../components/table';
import {theme} from '../../../theme/theme';
import QRCode from 'qrcode';
export function shareDialog (
    p: {
        image: Blob
    }
): void {
    const mainDiv = BB.el();
    const canvas = BB.canvas(800, 800)
    QRCode.toCanvas(canvas, "https://ai-image.manglemoose.com/result", { width: 500})
    canvas.style.marginLeft = 'auto';
    canvas.style.marginRight = 'auto';
    canvas.style.paddingLeft = '0';
    canvas.style.paddingRight = '0';
    canvas.style.display = 'block';

    var url = URL.createObjectURL(p.image)
    var image = new Image()
    image.src = url;
    image.style.width = "100%"
    image.style.marginLeft = 'auto';
    image.style.marginRight = 'auto';
    image.style.paddingLeft = '0';
    image.style.paddingRight = '0';
    image.style.display = 'block';
    mainDiv.append(image)
    mainDiv.append(canvas)
    showModal({
        target: document.body,
        message: `<b>${LANG('share-title')}</b>`,
        div: mainDiv,
        buttons: ['Ok',],
        style: {
            width: 'calc(100% - 50px)',
            maxWidth: '1000px',
            minWidth: '300px',
            boxSizing: 'border-box',
        },
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

