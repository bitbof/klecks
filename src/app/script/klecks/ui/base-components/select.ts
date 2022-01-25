import {BB} from '../../../bb/bb';

/**
 * A select dropdown
 *
 * p = {
 *     isFocusable: boolean, // default false
 *     optionArr: [
 *         [value: string, label: string]
 *     ],
 *     initValue?: string | null,
 *     onChange: func(str),
 * }
 *
 * @param p
 * @constructor
 */
export const Select = function(p) {

    const selectEl = BB.el({
        tagName: 'select',
        css: {
            cursor: 'pointer',
            fontSize: '15px',
            padding: '3px',
            background: '#fff', // makes safari pay attention to font-size
            //webkitAppearance: 'none'
        }
    }) as HTMLSelectElement;
    if (p.css) {
        BB.css(selectEl, p.css);
    }

    const isFocusable = p.isFocusable;
    if (!isFocusable) {
        selectEl.tabIndex = -1;
    }
    const optionArr = p.optionArr;
    for(let i = 0; i < optionArr.length; i++) {
        if (optionArr[i] === null) {
            continue;
        }
        const option = document.createElement('option');
        option.value = optionArr[i][0];
        option.textContent = optionArr[i][1];
        selectEl.appendChild(option);
    }
    function onChange() {
        if (!isFocusable) {
            selectEl.blur();
        }
        p.onChange(selectEl.value);
    }
    selectEl.addEventListener('change', onChange);
    selectEl.value = 'initValue' in p ? p.initValue : null;

    // --- interface ---

    this.setValue = function(val) {
        selectEl.value = val;
    };

    this.getValue = function() {
        return selectEl.value;
    };

    this.setDeltaValue = function(delta) {
        let index = 0;
        for (let i = 0; i < optionArr.length; i++) {
            if ('' + optionArr[i][0] === selectEl.value) {
                index = i;
                break;
            }
        }
        index = Math.max(0, Math.min(optionArr.length -1, index + delta));
        selectEl.value = optionArr[index][0];
        p.onChange(selectEl.value);
    };

    this.getElement = function() {
        return selectEl;
    };

    this.destroy = () => {
        selectEl.removeEventListener('change', onChange);
    };
};