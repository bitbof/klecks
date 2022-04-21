import {BB} from '../../../bb/bb';
import {input} from '../base-components/input';
import {popup} from './popup';
import {LANG} from '../../../language/language';
// @ts-ignore
import copyImg from 'url:~/src/app/img/ui/copy.svg';

/**
 * dialog for manually inputting the color
 * @param p {color: rgbObj, onClose: function(rgbObj | null)}
 * @constructor
 */
export const HexColorDialog = function (p) {

    let lastValidRgb = new BB.RGB(p.color.r, p.color.g, p.color.b);

    const div = BB.el({});

    const previewEl = BB.el({
        css: {
            width: '20px',
            height: '20px',
            marginBottom: '10px',
            boxShadow: 'inset 0 0 0 1px #fff, 0 0 0 1px #000',
            background: '#' + BB.ColorConverter.toHexString(lastValidRgb),
            colorScheme: 'only light',
        }
    });
    div.appendChild(previewEl);


    // --- Hex ---
    const hexRowEl = BB.el({
        css: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '15px'
        }
    });
    const hexLabel = BB.el({
        content: LANG('mci-hex'),
        css: {
            width: '60px'
        }
    });
    const hexInput = input({
        init: '#' + BB.ColorConverter.toHexString(lastValidRgb),
        css: {
            width: '80px'
        },
        callback: function() {
            let rgbObj = BB.ColorConverter.hexToRGB(hexInput.value);
            if (rgbObj === null) {
                rgbObj = lastValidRgb;
                hexInput.value = '#' + BB.ColorConverter.toHexString(lastValidRgb);
            } else {
                lastValidRgb = rgbObj;
            }
            previewEl.style.background = '#' + BB.ColorConverter.toHexString(rgbObj);

            for (let i = 0; i < rgbArr.length; i++) {
                rgbArr[i].update();
            }
        }
    });
    const copyButton = BB.el({
        tagName: 'button',
        content: '<img src="' + copyImg + '" height="20"/>',
        title: LANG('mci-copy'),
        css: {
            marginLeft: '10px'
        },
        onClick: function() {
            hexInput.select();
            document.execCommand('copy');
        }
    });
    hexRowEl.appendChild(hexLabel);
    hexRowEl.appendChild(hexInput);
    hexRowEl.appendChild(copyButton);
    div.appendChild(hexRowEl);
    setTimeout(function () {
        hexInput.focus();
        hexInput.select();
    }, 0);


    // --- R G B ---
    function createRgbInputRow(labelStr, attributeStr) {
        const result: any = {};

        const rowEl = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '5px',
            }
        });
        const labelEl = BB.el({
            content: labelStr,
            css: {
                width: '60px'
            }
        });

        const inputEl = input({
            init: lastValidRgb[attributeStr],
            min: 0,
            max: 255,
            type: 'number',
            css: {
                width: '80px'
            },
            callback: function() {
                if (inputEl.value === '' || parseFloat(inputEl.value) < 0 || parseFloat(inputEl.value) > 255) {
                    result.update();
                    return;
                }
                inputEl.value = '' + Math.round(parseFloat(inputEl.value));
                lastValidRgb[attributeStr] = inputEl.value;
                previewEl.style.background = '#' + BB.ColorConverter.toHexString(lastValidRgb);
                hexInput.value = '#' + BB.ColorConverter.toHexString(lastValidRgb);
            }
        });

        rowEl.appendChild(labelEl);
        rowEl.appendChild(inputEl);
        div.appendChild(rowEl);


        result.update = function() {
            inputEl.value = lastValidRgb[attributeStr];
        };
        result.destroy = () => {
            inputEl.onchange = null;
        };
        return result;
    }
    const rgbArr = [];
    rgbArr.push(createRgbInputRow(LANG('red'), 'r'));
    rgbArr.push(createRgbInputRow(LANG('green'), 'g'));
    rgbArr.push(createRgbInputRow(LANG('blue'), 'b'));


    popup({
        target: document.body,
        message: `<b>${LANG('manual-color-input')}</b>`,
        div: div,
        autoFocus: false,
        clickOnEnter: 'Ok',
        buttons: ['Ok', 'Cancel'],
        callback: function (resultStr) {
            BB.destroyEl(copyButton);
            rgbArr.forEach(item => item.destroy());
            rgbArr.splice(0, rgbArr.length);

            p.onClose(resultStr === 'Ok' ? BB.ColorConverter.hexToRGB(hexInput.value) : null);
        }
    });

};