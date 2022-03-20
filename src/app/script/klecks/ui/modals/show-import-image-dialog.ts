import {BB} from '../../../bb/bb';
import {CropCopy} from '../components/crop-copy';
import {Checkbox} from '../base-components/checkbox';
import {popup} from './popup';
import {LANG} from '../../../language/language';

/**
 *
 * p = {
 *     image: convertedPsd | {type: 'image', width: number, height: number, canvas: image | canvas},
 *     maxSize: number,
 *     target: htmlElement,
 *     callback: func(
 *         {
 *             type: 'as-image',
 *             image: image | canvas,
 *         } | {
 *             type: 'as-image-psd',
 *             image: convertedPsd,
 *             cropObj: {x: number, y: number, width: number, height: number}
 *         } | {
 *             type: 'as-layer',
 *             image: image | canvas,
 *         } | {
 *             type: 'cancel',
 *         }
 *     )
 * }
 *
 * @param p {}
 */
export function showImportImageDialog(p) {
    const div = BB.el({});

    const isSmall = window.innerWidth < 550 || window.innerHeight < 550;
    const style = isSmall ? {} : { width: '500px' };
    let resolutionEl;
    const cropCopy = new CropCopy({
        width: isSmall ? 340 : 540,
        height: isSmall ? 300 : 400,
        canvas: p.image.canvas,
        isNotCopy: true,
        onChange: function(width, height) {
            if (!resolutionEl) {
                return;
            }
            updateResolution(width, height);
        }
    });
    BB.css(cropCopy.getEl(), {
        marginLeft: '-20px',
        borderTop: '1px solid #bbb',
        borderBottom: '1px solid #bbb'
    });
    cropCopy.getEl().title = LANG('crop-drag-to-crop');
    div.appendChild(cropCopy.getEl());


    resolutionEl = BB.el({
        parent: div,
        css: {
            marginTop: '10px',
            textAlign: 'center',
            color: '#888',
            lineHeight: '20px',
        }
    });
    function updateResolution(w: number, h: number) {
        const fit = BB.fitInto(w, h, p.maxSize, p.maxSize);

        if (fit.width < w) {
            resolutionEl.innerHTML = `<span style="color:#f00">${w} X ${h}</span> ⟶ ${Math.round(fit.width)} X ${Math.round(fit.height)}`;
            resolutionEl.title = LANG('import-too-large');
        } else {
            resolutionEl.innerHTML = `${w} X ${h}`;
            resolutionEl.title = '';
        }
    }
    updateResolution(p.image.width, p.image.height);


    let doFlatten = false;
    function showWarnings(psdWarningArr) {
        let contentArr = [];
        let warningMap = {
            'mask': 'Masks not supported. Mask was applied.',
            'clipping': 'Clipping not supported. Clipping layers were merged.',
            'group': 'Groups not supported. Layers were ungrouped.',
            'adjustment': 'Adjustment layers not supported.',
            'layer-effect': 'Layer effects not supported.',
            'smart-object': 'Smart objects not supported.',
            'blend-mode': 'Unsupported layer blend mode.',
            'bits-per-channel': 'Unsupported color depth. Only 8bit per channel supported.',
        };
        for (let i = 0; i < psdWarningArr.length; i++) {
            contentArr.push('- ' + warningMap[psdWarningArr[i]]);
        }
        alert(contentArr.join("\n"));
    }

    let flattenCheckbox;
    if (p.image.type === 'psd') {
        const noteStyle = {
            background: 'rgba(255,255,0,0.5)',
            padding: '10px',
            marginTop: '5px',
            marginBottom: '5px',
            border: '1px solid #e7d321',
            borderRadius: '5px'
        };
        if (p.image.layers) {
            flattenCheckbox = new Checkbox({
                init: doFlatten,
                label: LANG('import-flatten'),
                callback: function(b) {
                    doFlatten = b;
                }
            });
            div.appendChild(flattenCheckbox.getElement());

            if (p.image.warningArr) {
                const noteEl = BB.el({
                    content: LANG('import-psd-limited-support'),
                    css: noteStyle
                });
                noteEl.appendChild(BB.el({
                    tagName: 'a',
                    content: 'Details',
                    onClick: function() {
                        showWarnings(p.image.warningArr);
                    }
                }));
                div.appendChild(noteEl);
            }
        } else {
            const noteEl = BB.el({
                content: LANG('import-psd-unsupported'),
                css: noteStyle
            });
            div.appendChild(noteEl);
        }
    }

    function callback(result) {
        const croppedImage = cropCopy.getCroppedImage();
        const cropRect = cropCopy.getRect();
        cropCopy.destroy();
        if (flattenCheckbox) {
            flattenCheckbox.destroy();
        }

        if (result === LANG('import-btn-as-layer')) {
            p.callback({
                type: 'as-layer',
                image: croppedImage
            });

        } else if (result === LANG('import-btn-as-image')) {
            if (p.image.type === 'psd') {
                if (doFlatten) {
                    p.image.layers = null;
                }
                p.callback({
                    type: 'as-image-psd',
                    image: p.image,
                    cropObj: cropRect
                });
            } else if (p.image.type === 'image') {
                p.callback({
                    type: 'as-image',
                    image: croppedImage
                });
            }
        } else {
            p.callback({
                type: 'cancel'
            });
        }
    }
    popup({
        target: p.target,
        message: `<b>${LANG('import-title')}</b>`,
        div: div,
        style,
        buttons: [LANG('import-btn-as-layer'), LANG('import-btn-as-image'), "Cancel"],
        callback: callback,
        autoFocus: 'As Image'
    });
}