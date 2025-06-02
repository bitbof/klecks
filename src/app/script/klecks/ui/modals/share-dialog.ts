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
import { KlCanvas } from '../../canvas/kl-canvas';
export async function shareDialog (
    p: {
        backendUrl: string;
        image: string,
        imageId: string,
        getKlCanvas: () => KlCanvas,
        session: string,
        printingEnabled: boolean
    }
):  Promise<void> {
    const mainDiv = BB.el();
    const canvas = BB.canvas(800, 800)
    QRCode.toCanvas(canvas, p.backendUrl + "/sharing/" + p.session + "/" + p.imageId, { width: 200})

    const formData = new FormData();
    formData.append('image', p.image);
    const inputImage = getImage(p.getKlCanvas().getCompleteCanvas(1));
    formData.append('input-image', inputImage)
    formData.append('session', p.session)
    fetch(p.backendUrl + "/share/" + p.imageId, {
        method: 'POST',
        body: formData,
    })

    canvas.style.position = 'absolute';
    canvas.style.bottom = '67px';
    canvas.style.left = '20px';
    
    var image = new Image()
    image.src = "data:image/png;base64," + p.image;
    image.style.width = "80%"
    image.style.marginLeft = 'auto';
    image.style.marginRight = 'auto';
    image.style.paddingLeft = '0';
    image.style.paddingRight = '0';
    image.style.display = 'block';
    mainDiv.append(image)
    mainDiv.append(canvas)
    let buttons = ['Ok']
    if(p.printingEnabled){
        buttons = buttons.concat('Print')
    }
    showModal({
        target: document.body,
        message: `<b>${LANG('share-title')}</b>`,
        div: mainDiv,
        buttons: buttons,
        style: {
            width: 'calc(100% - 50px)',
            maxWidth: '800px',
            minWidth: '300px',
            boxSizing: 'border-box',
        },
        callback: function (result) {
            if (result === 'Cancel') {
                return;
            }
            else if(result === 'Print'){
                    fetch(p.backendUrl + "/Printing/Print?session=" + p.session, {
                        method: 'POST',
                    })
                return;
            }
        },
        clickOnEnter: 'Ok',
    });

    function getImage(canvas: HTMLCanvasElement): Blob {
        const extension = 'png';
        const mimeType = 'image/png';
        const filename = BB.getDate() + 'input-image' + '.' + extension;
        const parts = canvas.toDataURL(mimeType).match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/);

        if (!parts) {
            throw new Error('saveImage: empty parts');
        }

        const binStr = atob(parts[3]);
        //convert to binary in ArrayBuffer
        const buf = new ArrayBuffer(binStr.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < view.length; i++) {
            view[i] = binStr.charCodeAt(i);
        }
        return new Blob([view], { 'type': parts[1] });
    }
}

