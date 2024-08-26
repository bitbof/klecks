import {BB} from '../../../bb/bb';
import {Select} from '../components/select';
import {ColorOptions} from '../components/color-options';
import {showModal} from './base/showModal';
import {LANG} from '../../../language/language';
import {IRGB, IRGBA} from '../../kl-types';
import {IKeyString, ISize2D} from '../../../bb/bb-types';
import {table} from '../components/table';
import {theme} from '../../../theme/theme';
import dotenv from 'dotenv'; 

import QRCode from 'qrcode';
export async function shareDialog (
    p: {
        backendUrl: string;
        image: string,
        imageId: string
    }
):  Promise<void> {
    const mainDiv = BB.el();
    const canvas = BB.canvas(800, 800)
    dotenv.config();

    QRCode.toCanvas(canvas, p.backendUrl + "/share/" + p.imageId, { width: 200})

    const formData = new FormData();
    formData.append('image', p.image);
    await fetch(p.backendUrl + "/share/" + p.imageId, {
        method: 'POST',
        body: formData,
    })

    canvas.style.position = 'absolute';
    canvas.style.bottom = '67px';
    canvas.style.left = '20px';

    
    var image = new Image()
    image.src = "data:image/png;base64," + p.image;
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
            maxWidth: '800px',
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

