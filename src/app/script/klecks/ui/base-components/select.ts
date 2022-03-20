import {BB} from '../../../bb/bb';
import {IKeyString} from '../../../bb/bb.types';

/**
 * A select dropdown
 */
export class Select {

    private selectEl: HTMLSelectElement;
    private optionArr: ([string, string] | null)[]; // [value, label]
    private changeListener: (event) => void;
    private onChange: (val: string) => void;

    
    // --- public ---
    constructor (p: {
        isFocusable?: boolean; // default false
        optionArr: ([string, string] | null)[], // [value, label]
        initValue?: string; // default null
        onChange: (val: string) => void;
        css?: IKeyString;
        title?: string;
    }) {
        this.selectEl = BB.el({
            tagName: 'select',
            title: p.title,
            css: {
                cursor: 'pointer',
                fontSize: '15px',
                padding: '3px',
                background: '#fff', // makes safari pay attention to font-size
                //webkitAppearance: 'none'
                colorScheme: 'only light', // chrome doesn't properly invert the text color
            }
        }) as HTMLSelectElement;
        if (p.css) {
            BB.css(this.selectEl, p.css);
        }

        const isFocusable = p.isFocusable;
        if (!isFocusable) {
            this.selectEl.tabIndex = -1;
        }
        this.optionArr = p.optionArr;
        for (let i = 0; i < this.optionArr.length; i++) {
            if (this.optionArr[i] === null) {
                continue;
            }
            const option = document.createElement('option');
            option.value = this.optionArr[i][0];
            option.textContent = this.optionArr[i][1];
            this.selectEl.append(option);
        }
        this.onChange = p.onChange;
        this.changeListener = (e) => {
            if (!isFocusable) {
                this.selectEl.blur();
            }
            this.onChange(this.selectEl.value);
        };
        this.selectEl.addEventListener('change', this.changeListener);
        this.selectEl.value = 'initValue' in p ? p.initValue : null;
    }

    setValue (val) {
        this.selectEl.value = val;
    }

    getValue () {
        return this.selectEl.value;
    }

    setDeltaValue (delta) {
        let index = 0;
        for (let i = 0; i < this.optionArr.length; i++) {
            if ('' + this.optionArr[i][0] === this.selectEl.value) {
                index = i;
                break;
            }
        }
        index = Math.max(0, Math.min(this.optionArr.length -1, index + delta));
        this.selectEl.value = this.optionArr[index][0];
        this.onChange(this.selectEl.value);
    }

    getElement () {
        return this.selectEl;
    }

    destroy = () => {
        this.selectEl.removeEventListener('change', this.changeListener);
    }
    
}
