import { BB } from '../../../bb/bb';
import { KL } from '../../kl';
import { SaveReminder } from '../components/save-reminder';
import { base64ToBlob } from '../../storage/base-64-to-blob';
import { KlCanvas } from '../../canvas/kl-canvas';
import { LANG } from '../../../language/language';
import loadingImg from '/src/app/img/ui/loading.gif';

type TImgurUploadResponse = {
    // just a subset
    id: string;
    datetime: number;
    type: string;
    width: number;
    height: number;
    deletehash: string;
    name: string;
    link: string;
};

/**
 * uploads canvas, opens new tab with the upload progress & then opens the image page.
 */
async function upload(
    canvas: HTMLCanvasElement,
    title: string,
    description: string,
    type: 'png' | 'jpeg',
    imgurKey: string,
): Promise<TImgurUploadResponse> {
    const img = base64ToBlob(canvas.toDataURL('image/' + type));

    const w = window.open();

    if (!w) {
        throw new Error('could not create new tab');
    }

    const label = w.document.createElement('div');
    const gif = w.document.createElement('img');
    gif.src = loadingImg;
    label.append(gif);
    BB.css(gif, {
        filter: 'invert(1)',
    });
    BB.css(w.document.body, {
        backgroundColor: '#121211',
        backgroundImage: 'linear-gradient(#2b2b2b 0%, #121211 50%)',
        backgroundRepeat: 'no-repeat',
    });

    const labelText = w.document.createElement('div');
    labelText.style.marginTop = '10px';
    label.append(labelText);
    labelText.textContent = LANG('upload-uploading');

    w.document.body.append(label);
    BB.css(label, {
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: '100px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        textAlign: 'center',
        transition: 'opacity 0.3s ease-in-out',
        opacity: '0',
        color: '#ccc',
    });
    setTimeout(function () {
        label.style.opacity = '1';
    }, 20);

    let response;
    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('image', img);
        response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
                Authorization: 'Client-ID ' + imgurKey,
            },
            body: formData,
        });
    } catch (e) {
        w.close();
        throw e;
    }
    if (!response.ok) {
        w.close();
        throw new Error();
    }
    const data: TImgurUploadResponse = (await response.json()).data;

    w.location.href = data.link.replace(/\.(jpg|png)/, '');

    return data;
}

export function imgurUpload(
    klCanvas: KlCanvas,
    klRootEl: HTMLElement,
    saveReminder: SaveReminder,
    imgurKey: string, // API key
): void {
    if (!imgurKey) {
        throw new Error('imgur key missing');
    }

    const inputTitle = BB.el({ tagName: 'input' });
    inputTitle.type = 'text';
    inputTitle.value = LANG('upload-title-untitled');
    const inputDescription = BB.el({
        tagName: 'textarea',
        custom: {
            rows: '2',
        },
        css: {
            width: '100%',
            maxWidth: '100%',
        },
    });

    const labelTitle = BB.el({
        textContent: LANG('upload-name') + ':',
    });
    const labelDescription = BB.el({
        textContent: LANG('upload-caption') + ':',
        css: {
            marginTop: '10px',
        },
    });

    const tos = BB.el({
        content: `<br/><a href="https://imgur.com/tos" target="_blank" rel="noopener noreferrer">${LANG('terms-of-service')}</a>`,
    });

    const typeRadio = new KL.RadioList({
        name: 'filetype',
        init: 'jpeg',
        items: [
            { label: 'JPG', value: 'jpeg' },
            { label: 'PNG', value: 'png' },
        ],
        ignoreFocus: true,
    });
    BB.css(typeRadio.getElement(), {
        marginBottom: '10px',
    });

    const outDiv = BB.el();
    const infoHint = BB.el({
        className: 'info-hint',
        textContent: LANG('upload-link-notice'),
    });
    outDiv.append(
        infoHint,
        typeRadio.getElement(),
        labelTitle,
        inputTitle,
        labelDescription,
        inputDescription,
        tos,
    );
    KL.popup({
        target: klRootEl,
        message: `<b>${LANG('upload-title')}</b>`,
        type: 'upload',
        div: outDiv,
        buttons: [LANG('upload-submit'), 'Cancel'],
        clickOnEnter: LANG('upload-submit'),
        primaries: [LANG('upload-submit')],
        autoFocus: LANG('upload-submit'),
        callback: async function (val) {
            if (val === LANG('upload-submit') || val === 'Yes' || val === 'Ok') {
                try {
                    const result = await upload(
                        klCanvas.getCompleteCanvas(1),
                        inputTitle.value,
                        inputDescription.value,
                        typeRadio.getValue() as 'png' | 'jpeg',
                        imgurKey,
                    );

                    KL.popup({
                        target: klRootEl,
                        type: 'ok',
                        message: `<h3>${LANG('upload-success')}</h3><br>${LANG('upload-delete')}<br><a target='_blank' rel="noopener noreferrer" href='https://imgur.com/delete/${result.deletehash}'>imgur.com/delete/${result.deletehash}</a><br><br>`,
                        buttons: ['Ok'],
                    });
                    saveReminder.reset();
                } catch (e) {
                    KL.popup({
                        target: klRootEl,
                        type: 'error',
                        message: LANG('upload-failed'),
                        buttons: ['Ok'],
                    });
                }
            }
        },
    });
}
