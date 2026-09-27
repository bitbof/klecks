import { BB } from '../../../bb/bb';
import { KL } from '../../kl';
import { KlCanvas } from '../../canvas/kl-canvas';
import { LANG } from '../../../language/language';
import loadingImg from 'url:/src/app/img/ui/loading.gif';
import { canvasToBlob } from '../../../bb/base/canvas';
import { asyncThrow, css } from '../../../bb/base/base';
import { c } from '../../../bb/base/c';
import { Input } from '../components/input';
import { showError, showModal } from './base/show-modal';

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

// uploads canvas, opens new tab with the upload progress & then opens the image page.
// returns undefined if upload fails
async function upload(
    canvas: HTMLCanvasElement,
    title: string,
    description: string,
    type: 'png' | 'jpeg',
    imgurKey: string,
): Promise<TImgurUploadResponse | undefined> {
    // open tab before any awaits
    const newTab = window.open('', '_blank');

    if (!newTab) {
        asyncThrow(new Error('could not create new tab'));
        return undefined;
    }

    // Keep the redirected Imgur tab from accessing the app through window.opener.
    newTab.opener = null;

    let imageBlob: Blob;
    try {
        imageBlob = await canvasToBlob(canvas, 'image/' + type);
    } catch (e) {
        newTab.close();
        asyncThrow(e);
        return undefined;
    }

    const label = newTab.document.createElement('div');
    const gif = newTab.document.createElement('img');
    gif.src = loadingImg;
    label.append(gif);
    css(gif, {
        filter: 'invert(1)',
    });
    css(newTab.document.body, {
        backgroundColor: '#121211',
        backgroundImage: 'linear-gradient(#2b2b2b 0%, #121211 50%)',
        backgroundRepeat: 'no-repeat',
    });

    const labelText = newTab.document.createElement('div');
    labelText.style.marginTop = '10px';
    label.append(labelText);
    labelText.textContent = LANG('upload-uploading');

    newTab.document.body.append(label);
    css(label, {
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 100,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 20,
        textAlign: 'center',
        transition: 'opacity 0.3s ease-in-out',
        opacity: 0,
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
        formData.append('image', imageBlob);
        response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
                Authorization: 'Client-ID ' + imgurKey,
            },
            body: formData,
        });
    } catch (e) {
        newTab.close();
        asyncThrow(e);
        return undefined;
    }
    if (!response.ok) {
        newTab.close();
        asyncThrow('imgur upload failed');
        return undefined;
    }
    let data: TImgurUploadResponse | undefined;
    try {
        data = (await response.json()).data;
    } catch (e) {
        newTab.close();
        asyncThrow('failed to parse imgur response');
        return undefined;
    }
    if (!data) {
        newTab.close();
        asyncThrow('imgur response is missing data');
        return undefined;
    }
    newTab.location.href = data.link.replace(/\.(jpg|png)/, '');

    return data;
}

export function imgurUpload(
    klCanvas: KlCanvas,
    imgurKey: string, // API key
    onUploaded: () => void,
): void {
    if (!imgurKey) {
        throw new Error('imgur key missing');
    }

    const tileInput = new Input({
        init: LANG('upload-title-untitled'),
        name: 'image-title',
    });
    const descriptionInput = BB.el({
        tagName: 'textarea',
        props: {
            rows: 2,
            name: 'image-description',
        },
        css: {
            width: '100%',
            maxWidth: '100%',
        },
    });

    const titleLabel = BB.el({
        textContent: LANG('upload-name') + ':',
    });
    const descriptionLabel = BB.el({
        textContent: LANG('upload-caption') + ':',
        css: {
            marginTop: 10,
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
    css(typeRadio.getElement(), {
        marginBottom: 10,
    });

    const outDiv = BB.el();
    const infoHint = BB.el({
        className: 'info-hint',
        textContent: LANG('upload-link-notice'),
    });
    outDiv.append(
        infoHint,
        typeRadio.getElement(),
        titleLabel,
        tileInput.getElement(),
        descriptionLabel,
        descriptionInput,
        tos,
    );
    showModal({
        message: `<b>${LANG('upload-title')}</b>`,
        type: 'upload',
        div: outDiv,
        buttons: [{ id: 'submit', label: LANG('upload-submit') }, 'Cancel'],
        clickOnEnter: 'submit',
        primaries: ['submit'],
        autoFocus: 'submit',
        callback: async function (val) {
            const title = tileInput.getValue();
            tileInput.destroy();
            if (val === 'submit') {
                const result = await upload(
                    klCanvas.getCanvas(),
                    title,
                    descriptionInput.value,
                    typeRadio.getValue() as 'png' | 'jpeg',
                    imgurKey,
                );
                if (result === undefined) {
                    showError(LANG('upload-failed'));
                    return;
                }
                const deletePath = 'imgur.com/delete/' + result.deletehash;
                const deleteUrl = 'https://' + deletePath;
                showModal({
                    type: 'ok',
                    message: c('', [
                        c('strong', [LANG('upload-success')]),
                        c('br'),
                        LANG('upload-delete'),
                        c('br'),
                        c(
                            {
                                tagName: 'a',
                                props: {
                                    target: '_blank',
                                    rel: 'noopener noreferrer',
                                    href: deleteUrl,
                                },
                            },
                            [deletePath],
                        ),
                    ]),
                    buttons: ['Ok'],
                });
                onUploaded();
            }
        },
    });
}
