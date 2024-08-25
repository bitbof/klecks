import { BB } from '../../../bb/bb';
import { IKeyString, IKeyStringOptional } from '../../../bb/bb-types';

type TSelectItem<ValueType> =
    | [ValueType, string]
    | [ValueType, string, { css: IKeyStringOptional }]; // [value, label, properties]

/**
 * A select dropdown
 */
export class Select<ValueType extends string> {
    private readonly selectEl: HTMLSelectElement;
    private optionArr: {
        item: TSelectItem<ValueType> | undefined;
        el?: HTMLOptionElement;
    }[] = [];
    private readonly changeListener: () => void;
    private readonly onChange: ((val: ValueType) => void) | undefined;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        isFocusable?: boolean; // default false
        optionArr: (TSelectItem<ValueType> | undefined)[];
        initValue?: ValueType; // default ''
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
            },
        });
        if (p.css) {
            BB.css(this.selectEl, p.css);
        }

        const isFocusable = p.isFocusable;
        if (!isFocusable) {
            this.selectEl.tabIndex = -1;
        }
        this.setOptionArr(p.optionArr);
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
        this.selectEl.value = p.initValue !== undefined ? p.initValue : '';
    }

    setValue(val: ValueType | undefined): void {
        this.selectEl.value = val === undefined ? '' : val;
    }

    getValue(): ValueType {
        return this.selectEl.value as ValueType;
    }

    setDeltaValue(delta: number): void {
        let index = 0;
        for (let i = 0; i < this.optionArr.length; i++) {
            const option = this.optionArr[i];
            if (option.item && '' + option.item[0] === this.selectEl.value) {
                index = i;
                break;
            }
        }
        index = Math.max(0, Math.min(this.optionArr.length - 1, index + delta));
        const option = this.optionArr[index];
        this.selectEl.value = option.item ? option.item[0] : '';
        this.onChange && this.onChange(this.getValue());
    }

    getElement(): HTMLElement {
        return this.selectEl;
    }

    updateLabel(id: ValueType, label: string): void {
        this.optionArr.forEach((option) => {
            if (option.item && option.item[0] === id && option.el) {
                option.item[1] = label;
                option.el.textContent = option.item[1];
            }
        });
    }

    setOptionArr(optionArr: (TSelectItem<ValueType> | undefined)[]): void {
        const oldVal = this.selectEl.value as ValueType;

        this.optionArr = [];
        this.selectEl.innerHTML = '';
        for (let i = 0; i < optionArr.length; i++) {
            const item = optionArr[i];
            if (!item) {
                this.optionArr.push({
                    item,
                });
                continue;
            }
            const el = document.createElement('option');
            el.value = item[0];
            el.textContent = item[1];
            if (item[2]) {
                BB.css(el, item[2].css);
            }
            this.optionArr.push({
                item,
                el,
            });
            this.selectEl.append(el);
        }

        // restore old value
        if (oldVal === '' || optionArr.findIndex((item) => item && item[0] === oldVal) > -1) {
            this.setValue(oldVal);
        }
    }

    destroy(): void {
        this.selectEl.removeEventListener('change', this.changeListener);
    }
}
