import { BB } from '../../../bb/bb';
import { input } from '../components/input';
import { showModal } from './base/showModal';
import { LANG } from '../../../language/language';
import copyImg from '/src/app/img/ui/copy.svg';
import { IRGB } from '../../kl-types';
import { RGB } from '../../../bb/color/color';
import { c } from '../../../bb/base/c';
import { css } from '@emotion/css';

type TInputRow = {
    update: () => void;
    destroy: () => void;
    element: HTMLElement;
};

/**
 * dialog for manually inputting the color
 */
export class HexColorDialog {
    // ----------------------------------- public -----------------------------------
    constructor(p: { color: IRGB; onClose: (rgb: IRGB | undefined) => void }) {
        let lastValidRgb: RGB = new BB.RGB(p.color.r, p.color.g, p.color.b);

        const previewEl = BB.el({
            css: {
                width: '20px',
                height: '20px',
                marginBottom: '10px',
                boxShadow: 'inset 0 0 0 1px #fff, 0 0 0 1px #000',
                background: '#' + BB.ColorConverter.toHexString(lastValidRgb),
            },
        });

        // --- Hex ---

        const hexLabel = BB.el({
            content: LANG('mci-hex'),
        });
        const hexInput = input({
            init: '#' + BB.ColorConverter.toHexString(lastValidRgb),
            css: {
                width: '80px',
            },
            callback: function () {
                let rgbObj = BB.ColorConverter.hexToRGB(hexInput.value);
                if (!rgbObj) {
                    rgbObj = lastValidRgb;
                    hexInput.value = '#' + BB.ColorConverter.toHexString(lastValidRgb);
                } else {
                    lastValidRgb = rgbObj;
                }
                previewEl.style.background = '#' + BB.ColorConverter.toHexString(rgbObj);

                for (let i = 0; i < rgbArr.length; i++) {
                    rgbArr[i].update();
                }
            },
        });
        const copyButton = BB.el({
            tagName: 'button',
            content: '<img src="' + copyImg + '" height="20" alt=""/>',
            title: LANG('mci-copy'),
            onClick: function () {
                hexInput.select();
                navigator.clipboard.writeText(hexInput.value).then().catch();
            },
        });

        const hexRowEl = c(
            {
                css: {
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '15px',
                    flexWrap: 'wrap',
                    gap: '5px 10px',
                    maxWidth: '250px',
                },
            },
            [hexLabel, c(',flex,items-center,gap-10', [hexInput, copyButton])],
        );
        setTimeout(function () {
            hexInput.focus();
            hexInput.select();
        }, 0);

        // --- R G B ---
        function createRgbInputRow(labelStr: string, attributeStr: 'r' | 'g' | 'b'): TInputRow {
            const inputEl = input({
                init: lastValidRgb[attributeStr],
                min: 0,
                max: 255,
                type: 'number',
                css: {
                    width: '80px',
                },
                callback: function () {
                    if (
                        inputEl.value === '' ||
                        parseFloat(inputEl.value) < 0 ||
                        parseFloat(inputEl.value) > 255
                    ) {
                        result.update();
                        return;
                    }
                    inputEl.value = '' + Math.round(parseFloat(inputEl.value));
                    lastValidRgb[attributeStr] = Number(inputEl.value);
                    previewEl.style.background = '#' + BB.ColorConverter.toHexString(lastValidRgb);
                    hexInput.value = '#' + BB.ColorConverter.toHexString(lastValidRgb);
                },
            });

            const rowEl = c('tr', [c('td,pr-10', labelStr), c('td', [inputEl])]);

            const result = {
                update: (): void => {
                    inputEl.value = '' + lastValidRgb[attributeStr];
                },
                destroy: (): void => {
                    BB.unsetEventHandler(inputEl, 'onchange');
                },
                element: rowEl,
            };
            return result;
        }
        const rgbArr: TInputRow[] = [
            createRgbInputRow(LANG('red'), 'r'),
            createRgbInputRow(LANG('green'), 'g'),
            createRgbInputRow(LANG('blue'), 'b'),
        ];

        const tableCss = css({
            borderCollapse: 'collapse',
            td: {
                paddingBottom: '5px',
            },
        });
        const rootEl = c('', [
            previewEl,
            hexRowEl,
            c('table.' + tableCss, [
                c(
                    'tbody',
                    rgbArr.map((item) => item.element),
                ),
            ]),
        ]);

        showModal({
            target: document.body,
            message: `<b>${LANG('manual-color-input')}</b>`,
            div: rootEl,
            autoFocus: false,
            clickOnEnter: 'Ok',
            buttons: ['Ok', 'Cancel'],
            callback: function (resultStr) {
                BB.destroyEl(copyButton);
                rgbArr.forEach((item) => item.destroy());
                rgbArr.splice(0, rgbArr.length);

                p.onClose(
                    resultStr === 'Ok' ? BB.ColorConverter.hexToRGB(hexInput.value) : undefined,
                );
            },
        });
    }
}
