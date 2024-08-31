import { BB } from '../../../bb/bb';
import { CropCopy } from '../components/crop-copy';
import { Checkbox } from '../components/checkbox';
import { showModal } from './base/showModal';
import { LANG } from '../../../language/language';
import { IKeyString, IRect } from '../../../bb/bb-types';
import { IKlPsd, TKlPsdError } from '../../kl-types';

/**
 * Shows first dialog when importing an image.
 * Where you can crop, and select import as layer or as image.
 */
export function showImportImageDialog(p: {
    image:
        | IKlPsd
        | {
              type: 'image';
              width: number;
              height: number;
              canvas: HTMLImageElement | HTMLCanvasElement;
          };
    maxSize: number;
    target: HTMLElement;
    callback: (
        val:
            | {
                  type: 'as-image' | 'as-layer';
                  image: HTMLImageElement | HTMLCanvasElement;
              }
            | {
                  type: 'as-image-psd';
                  image: IKlPsd;
                  cropObj: IRect;
              }
            | {
                  type: 'cancel';
              },
    ) => void;
}): void {
    const rootEl = BB.el();
    const isSmall = window.innerWidth < 550 || window.innerHeight < 550;
    const style: IKeyString = isSmall ? {} : { width: '540px' };

    const resolutionEl = BB.el({
        css: {
            marginTop: '10px',
            textAlign: 'center',
            color: '#888',
            lineHeight: '20px',
        },
    });

    const cropCopy = new CropCopy({
        width: isSmall ? 340 : 540,
        height: isSmall ? 300 : 400,
        canvas: p.image.canvas,
        isNotCopy: true,
        onChange: (width, height): void => {
            if (!resolutionEl) {
                return;
            }
            updateResolution(width, height);
        },
    });
    BB.css(cropCopy.getEl(), {
        marginLeft: '-20px',
    });
    cropCopy.getEl().title = LANG('crop-drag-to-crop');

    rootEl.append(cropCopy.getEl(), resolutionEl);

    function updateResolution(w: number, h: number): void {
        const fit = BB.fitInto(w, h, p.maxSize, p.maxSize);

        if (fit.width < w) {
            resolutionEl.innerHTML = `<span class="kl-text-error">${w} X ${h}</span> ⟶ ${Math.round(fit.width)} X ${Math.round(fit.height)}`;
            resolutionEl.title = LANG('import-too-large');
        } else {
            resolutionEl.innerHTML = `${w} X ${h}`;
            resolutionEl.title = '';
        }
    }
    updateResolution(p.image.width, p.image.height);

    let doFlatten = false;
    function showWarnings(psdWarningArr: TKlPsdError[]): void {
        const contentArr = [];
        const warningMap = {
            mask: 'Masks not supported. Mask was applied.',
            clipping: 'Clipping not supported. Clipping layers were merged.',
            group: 'Groups not supported. Layers were ungrouped.',
            adjustment: 'Adjustment layers not supported.',
            'layer-effect': 'Layer effects not supported.',
            'smart-object': 'Smart objects not supported.',
            'blend-mode': 'Unsupported layer blend mode.',
            'bits-per-channel': 'Unsupported color depth. Only 8bit per channel supported.',
        };
        for (let i = 0; i < psdWarningArr.length; i++) {
            contentArr.push('- ' + warningMap[psdWarningArr[i]]);
        }
        alert(contentArr.join('\n'));
    }

    let flattenCheckbox: Checkbox;
    let warningsEl: HTMLElement | undefined;
    if (p.image.type === 'psd') {
        if (p.image.layers) {
            flattenCheckbox = new Checkbox({
                init: doFlatten,
                label: LANG('import-flatten'),
                callback: (b): void => {
                    doFlatten = b;
                },
            });
            rootEl.append(flattenCheckbox.getElement());

            if (p.image.warningArr) {
                const noteEl = BB.el({
                    className: 'kl-import-note',
                    content: LANG('import-psd-limited-support'),
                });
                const warnings = p.image.warningArr;
                warningsEl = BB.el({
                    parent: noteEl,
                    tagName: 'a',
                    content: 'Details',
                    css: { marginLeft: '5px' },
                    onClick: () => showWarnings(warnings),
                });
                rootEl.append(noteEl);
            }
        } else {
            const noteEl = BB.el({
                className: 'kl-import-note',
                content: LANG('import-psd-unsupported'),
            });
            rootEl.append(noteEl);
        }
    }

    function callback(result: string): void {
        const croppedImage = cropCopy.getCroppedCanvas();
        const cropRect = cropCopy.getRect();
        const isCropped = p.image.width !== cropRect.width && p.image.height !== cropRect.height;
        cropCopy.destroy();
        BB.destroyEl(warningsEl);
        if (flattenCheckbox) {
            flattenCheckbox.destroy();
        }

        if (result === LANG('import-btn-as-layer')) {
            p.callback({
                type: 'as-layer',
                image: isCropped ? croppedImage : p.image.canvas,
            });
            if (!isCropped) {
                BB.freeCanvas(croppedImage);
            }
        } else if (result === LANG('import-btn-as-image')) {
            if (p.image.type === 'psd') {
                if (doFlatten) {
                    delete p.image.layers;
                }
                p.callback({
                    type: 'as-image-psd',
                    image: p.image,
                    cropObj: cropRect,
                });
                BB.freeCanvas(croppedImage);
            } else if (p.image.type === 'image') {
                p.callback({
                    type: 'as-image',
                    image: croppedImage,
                });
            }
        } else {
            p.callback({
                type: 'cancel',
            });
            BB.freeCanvas(croppedImage);
        }
    }
    showModal({
        target: p.target,
        message: `<b>${LANG('import-title')}</b>`,
        div: rootEl,
        style,
        buttons: [LANG('import-btn-as-layer'), LANG('import-btn-as-image'), 'Cancel'],
        primaries: [LANG('import-btn-as-layer'), LANG('import-btn-as-image')],
        callback,
        autoFocus: 'As Image',
    });
}
