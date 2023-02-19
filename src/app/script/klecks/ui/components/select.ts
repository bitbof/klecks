import {BB} from '../../../bb/bb';
import {IKeyString} from '../../../bb/bb-types';

/**
 * A select dropdown
 */
export class Select<ValueType extends string> {

    private readonly selectEl: HTMLSelectElement;
    private readonly optionArr: ([ValueType, string] | null)[]; // [value, label]
    private readonly changeListener: () => void;
    private readonly onChange: ((val: ValueType) => void) | undefined;

    
    // --- public ---
    constructor (p: {
        isFocusable?: boolean; // default false
        optionArr: ([ValueType, string] | null)[]; // [value, label]
        initValue?: ValueType; // default null
        onChange?: (val: ValueType) => void;
        css?: IKeyString;
        title?: string;
    }) {
        this.selectEl = BB.el({
            tagName: 'select',
            title: p.title,
            className: 'kl-select',
            css: {
                cursor: 'pointer',
                fontSize: '15px',
                padding: '3px',
                //webkitAppearance: 'none'
                colorScheme: 'only light', // chrome doesn't properly invert the text color
            },
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
            const item = this.optionArr[i];
            if (item === null) {
                continue;
            }
            const option = document.createElement('option');
            option.value = item[0];
            option.textContent = item[1];
            this.selectEl.append(option);
        }
        if (p.onChange) {
            this.onChange = p.onChange;
        }
        this.changeListener = () => {
            if (!isFocusable) {
                this.selectEl.blur();
            }
            this.onChange && this.onChange(this.getValue());
        };
        this.selectEl.addEventListener('change', this.changeListener);
        this.selectEl.value = ('initValue' in p && p.initValue !== undefined) ? p.initValue : '';
    }

    setValue (val: ValueType): void {
        this.selectEl.value = val;
    }

    getValue (): ValueType {
        return this.selectEl.value as ValueType;
    }

    setDeltaValue (delta: number): void {
        let index = 0;
        for (let i = 0; i < this.optionArr.length; i++) {
            const item = this.optionArr[i];
            if (item && '' + item[0] === this.selectEl.value) {
                index = i;
                break;
            }
        }
        index = Math.max(0, Math.min(this.optionArr.length -1, index + delta));
        const item = this.optionArr[index];
        this.selectEl.value = item ? item[0] : '';
        this.onChange && this.onChange(this.getValue());
    }

    getElement (): HTMLElement {
        return this.selectEl;
    }

    destroy (): void {
        this.selectEl.removeEventListener('change', this.changeListener);
    }
    
}
