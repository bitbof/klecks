import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';
import { TCss } from '../../../bb/bb-types';
import { getDecimalDigits } from '../../../bb/math/math';

type TInputType = 'button' | 'checkbox' | 'number' | 'text' | 'color';

export type TInputParams = {
    type?: TInputType; // default: text
    init: string | number;
    title?: string;
    label?: string | HTMLElement;
    name: string;

    // for type: number
    min?: number;
    max?: number;
    // default "any"
    step?: number;

    onChange?: (v: string) => void;
    onInput?: (v: string) => void;
    onBlur?: (v: string) => void;

    doScrollWithoutFocus?: boolean; // default: false
    doResetIfInvalid?: boolean; // default: false

    css?: TCss;
};

export class Input {
    private readonly rootEl: HTMLLabelElement;
    private readonly input: HTMLInputElement;
    private readonly type: TInputType;
    private readonly pointerListener;
    private readonly changeListener: (() => void) | undefined;
    private readonly inputListener: (() => void) | undefined;
    private readonly blurListener: (() => void) | undefined;

    // ----------------------------------- public -----------------------------------
    constructor(p: TInputParams) {
        this.rootEl = BB.el({
            tagName: 'label',
            content: p.label,
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: 5,
            },
        });

        this.input = BB.el({
            tagName: 'input',
            parent: this.rootEl,
            title: p.title,
            custom: {
                name: p.name,
            },
        });

        this.type = p.type ?? 'text';
        try {
            this.input.type = this.type;
        } catch (e) {
            // ie can't deal with number
        }

        const stepSize = p.step ?? 1;
        const stepDigits = getDecimalDigits(stepSize);

        if (this.type === 'number') {
            if (p.min !== undefined) {
                this.input.min = '' + p.min;
            }
            if (p.max !== undefined) {
                this.input.max = '' + p.max;
            }
            // undefined would default to 1 (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/step)
            this.input.step = p.step === undefined ? 'any' : '' + p.step;
        }

        this.input.value = '' + p.init;

        let lastValidValue = this.input.value;

        /**
         * return true if not changed
         */
        const handleChange = (): boolean => {
            const oldVal = lastValidValue;
            let newValue = this.input.value;
            if (p.doResetIfInvalid) {
                let didChange = false;
                if (newValue === '') {
                    newValue = lastValidValue;
                    didChange = true;
                }
                if (p.min !== undefined && parseFloat(newValue) < p.min) {
                    newValue = '' + p.min;
                    didChange = true;
                }
                if (p.max !== undefined && parseFloat(newValue) > p.max) {
                    newValue = '' + p.max;
                    didChange = true;
                }
                if (didChange) {
                    this.input.value = '' + newValue;
                }
            }

            lastValidValue = newValue;

            return oldVal !== newValue;
        };

        this.changeListener = p.onChange
            ? () => {
                  handleChange() && p.onChange?.(this.input.value);
              }
            : undefined;
        if (this.changeListener) {
            this.input.addEventListener('change', this.changeListener);
        }
        this.inputListener = p.onInput ? () => p.onInput?.(this.input.value) : undefined;
        if (this.inputListener) {
            this.input.addEventListener('input', this.inputListener);
        }
        this.blurListener = p.onBlur ? () => p.onBlur?.(this.input.value) : undefined;
        if (this.blurListener) {
            this.input.addEventListener('blur', this.blurListener);
        }
        if (p.css) {
            css(this.input, p.css);
        }

        if (p.doScrollWithoutFocus && p.type === 'number' && p.onChange) {
            const onChange = p.onChange;
            this.pointerListener = new BB.PointerListener({
                target: this.input,
                onWheel: (e) => {
                    const fac = e.shiftKey ? 4 : 1;
                    const value = parseFloat(this.input.value) - e.deltaY * stepSize * fac;
                    this.input.value = '' + BB.round(value, stepDigits);
                    handleChange() && onChange(this.input.value);
                },
            });
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): string {
        return this.input.value;
    }

    setValue(v: string | number): void {
        this.input.value = '' + v;
    }

    getIsFocused(): boolean {
        return document.activeElement === this.input;
    }

    focus(): void {
        this.input.focus();
    }

    select(): void {
        this.input.select();
    }

    destroy(): void {
        if (this.changeListener) {
            this.input.removeEventListener('change', this.changeListener);
        }
        if (this.inputListener) {
            this.input.removeEventListener('input', this.inputListener);
        }
        if (this.blurListener) {
            this.input.removeEventListener('blur', this.blurListener);
        }
        this.pointerListener?.destroy();
    }
}

// todo replace instances with class
export const input = function (params: {
    type?: TInputType; // default text
    min?: number;
    max?: number;
    callback: (val: string) => void;
    init: string | number;
    css?: TCss;
}) {
    const result = document.createElement('input');
    if (params.type) {
        try {
            result.type = params.type;
        } catch (e) {
            /* empty */
            // ie can't deal with number
        }
    } else {
        result.type = 'text';
    }
    if (params.min !== undefined) {
        result.min = '' + params.min;
    }
    if (params.max !== undefined) {
        result.max = '' + params.max;
    }
    result.value = '' + params.init;
    if (params.callback) {
        result.onchange = function () {
            params.callback(result.value);
        };
    }
    if (params.css) {
        css(result, params.css);
    }

    return result;
};
