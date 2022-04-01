import {BB} from '../../../bb/bb';
import {KL} from '../../kl';
// @ts-ignore
import loadingImg from 'url:~/src/app/img/ui/loading.gif';
import {SaveReminder} from '../components/save-reminder';
import {base64ToBlob} from '../../storage/base-64-to-blob';
import {KlCanvas} from '../../canvas/kl-canvas';
import {LANG} from '../../../language/language';


async function upload(canvas, title, description, type: 'png' | 'jpeg', imgurKey: string): Promise<{deletehash: string}> {
    let img = base64ToBlob(canvas.toDataURL("image/" + type));

    let w = window.open();
    let label = w.document.createElement("div");
    let gif = w.document.createElement("img");
    gif.src = loadingImg;
    label.appendChild(gif);
    BB.css(gif, {
        filter: "invert(1)"
    });
    w.document.body.style.backgroundColor = "#121211";
    w.document.body.style.backgroundImage = "linear-gradient(#2b2b2b 0%, #121211 50%)";
    w.document.body.style.backgroundRepeat = "no-repeat";
    let labelText = w.document.createElement("div");
    labelText.style.marginTop = "10px";
    label.appendChild(labelText);
    labelText.textContent = LANG('upload-uploading');

    w.document.body.appendChild(label);
    BB.css(label, {
        marginLeft: "auto",
        marginRight: "auto",
        marginTop: "100px",
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        textAlign: "center",
        transition: "opacity 0.3s ease-in-out",
        opacity: '0',
        color: "#ccc"
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
        response = await fetch('https://api.imgur.com/3/image',  {
            method: 'POST',
            headers: {
                Authorization: 'Client-ID ' + imgurKey,
            },
            body: formData
        });

    } catch (e) {
        w.close();
        throw new Error(e);
    }
    if (!response.ok) {
        w.close();
        throw new Error();
    }
    let data = (await response.json()).data;

    w.location.href = (data as any).link.replace(/\.(jpg|png)/, '');

    return data;
}


export function imgurUpload(klCanvas: KlCanvas, klRootEl, saveReminder: SaveReminder, imgurKey: string) {
    if (!imgurKey) {
        throw new Error('imgur key missing');
    }

    let inputTitle = document.createElement("input");
    inputTitle.type = "text";
    inputTitle.value = LANG('upload-title-untitled');
    let inputDescription = BB.el({
        tagName: 'textarea',
        custom: {
            rows: 2,
        },
        css: {
            width: '100%',
            maxWidth: '100%',
        },
    }) as HTMLTextAreaElement;

    let labelTitle = document.createElement("div");
    labelTitle.textContent = LANG('upload-name') + ":";
    let labelDescription = BB.el({
        content: LANG('upload-caption') + ':',
        css: {
            marginTop: '10px',
        }
    });

    let tos = document.createElement("div");
    tos.innerHTML = `<br/><a href="https://imgur.com/tos" target="_blank" rel="noopener noreferrer">${LANG('upload-tos')}</a> ${LANG('upload-tos-2')}`;

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


    let outDiv = document.createElement("div");
    let infoHint = document.createElement("div");
    infoHint.className = "info-hint";
    infoHint.textContent = LANG('upload-link-notice');
    outDiv.append(
        infoHint,
        typeRadio.getElement(),
        labelTitle,
        inputTitle,
        labelDescription,
        inputDescription,
        tos
    );
    KL.popup({
        target: klRootEl,
        message: `<b>${LANG('upload-title')}</b>`,
        type: "upload",
        div: outDiv,
        buttons: [LANG('upload-submit'), "Cancel"],
        clickOnEnter: LANG('upload-submit'),
        primaries: [LANG('upload-submit')],
        autoFocus: LANG('upload-submit'),
        callback: async function (val) {
            if (val === LANG('upload-submit') || val === "Yes" || val === "Ok") {
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
                        type: "ok",
                        message: `<h3>${LANG('upload-success')}</h3><br>${LANG('upload-delete')}<br><a target='_blank' rel="noopener noreferrer" href='https://imgur.com/delete/${result.deletehash}'>imgur.com/<b>delete</b>/${result.deletehash}</a><br><br>`,
                        buttons: ["Ok"]
                    });
                    saveReminder.reset();

                } catch(e) {
                    KL.popup({
                        target: klRootEl,
                        type: "error",
                        message: LANG('upload-failed'),
                        buttons: ["Ok"]
                    });
                }
            }
        }
    });
}