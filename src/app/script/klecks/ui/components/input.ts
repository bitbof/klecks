import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';
import { TCss } from '../../../bb/bb-types';
import { getDecimalDigits } from '../../../bb/math/math';

type TInputType = 'button' | 'checkbox' | 'number' | 'text' | 'color';
type TInputTypeForValue<G> = G extends number ? 'number' : Exclude<TInputType, 'number'>;

export type TInputParams<G extends string | number> = {
    type?: TInputTypeForValue<G>; // default: text
    init: G;
    title?: string;
    label?: string | HTMLElement;
    name: string;
    isFocusIgnored?: boolean;

    // for type: number
    min?: number;
    max?: number;
    // default "any"
    step?: number;

    validate?: (value: G) => boolean;
    constrain?: (value: G) => G;
    onChange?: (value: G) => void;
    //onInput?: (value: G) => void;
    onBlur?: (value: G) => void;
    css?: TCss;
};

export class Input<G extends string | number> {
    private readonly rootEl: HTMLLabelElement;
    private readonly input: HTMLInputElement;
    private readonly type: TInputType;
    private value: G;
    private readonly pointerListener;
    private readonly changeListener: () => void;
    private readonly inputListener: () => void;
    private readonly blurListener: (() => void) | undefined;

    // ----------------------------------- public -----------------------------------
    constructor(p: TInputParams<G>) {
        this.rootEl = BB.el({
            tagName: 'label',
            content: p.label,
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                width: 'fit-content',
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
        if (p.isFocusIgnored) {
            this.input.setAttribute('data-ignore-focus', 'true');
        }

        this.type = p.type ?? 'text';
        try {
            this.input.type = this.type;
        } catch (e) {
            // ie can't deal with number
        }

        if (this.type === 'number') {
            this.setRange(p.min, p.max);
            // undefined would default to 1 (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/step)
            this.input.step = p.step === undefined ? 'any' : '' + p.step;
        }

        this.input.value = '' + p.init;
        this.value = p.init;

        const defaultNumberValidate = (value: number): boolean => {
            if (!Number.isFinite(value)) {
                return false;
            }
            return true;
        };
        const defaultConstrain = (value: number): number => {
            let result = value;
            const min = this.input.min === '' ? undefined : +this.input.min;
            const max = this.input.max === '' ? undefined : +this.input.max;
            if (this.input.step !== 'any') {
                const step = +this.input.step;
                if (Number.isFinite(step) && step > 0) {
                    const stepBase = min ?? 0;
                    const digits = Math.max(getDecimalDigits(step), getDecimalDigits(stepBase));
                    const stepIndex = Math.round((result - stepBase) / step);
                    result = BB.round(stepBase + stepIndex * step, digits);
                }
            }
            if (min !== undefined) {
                result = Math.max(result, min);
            }
            if (max !== undefined) {
                result = Math.min(result, max);
            }
            return result;
        };
        const customValidate = p.validate;
        const customConstrain = p.constrain;

        // return true if changed
        const handleInput = (): boolean => {
            if (this.type === 'number') {
                let newValue = this.input.valueAsNumber;
                const isValid = customValidate
                    ? customValidate(newValue as G)
                    : defaultNumberValidate(newValue);
                if (!isValid) {
                    return false;
                }
                newValue = (
                    customConstrain ? customConstrain(newValue as G) : defaultConstrain(newValue)
                ) as number;
                if (newValue !== this.value) {
                    this.value = newValue as G;
                    return true;
                }
                return false;
            }

            let newValue = this.input.value;
            if (customValidate && !customValidate(newValue as G)) {
                return false;
            }
            if (customConstrain) {
                newValue = customConstrain(newValue as G) as string;
            }
            if (newValue !== this.value) {
                this.value = newValue as G;
                return true;
            }
            return false;
        };

        // return true if changed
        const handleChange = (): boolean => {
            const changed = handleInput();
            this.input.value = '' + this.value;
            return changed;
        };

        this.inputListener = () => {
            if (handleInput()) {
                p.onChange?.(this.value);
            }
        };
        this.input.addEventListener('input', this.inputListener);
        this.changeListener = () => {
            if (handleChange()) {
                p.onChange?.(this.value);
            }
        };
        this.input.addEventListener('change', this.changeListener);
        this.blurListener = p.onBlur ? () => p.onBlur?.(this.getValue()) : undefined;
        if (this.blurListener) {
            this.input.addEventListener('blur', this.blurListener);
        }
        if (p.css) {
            css(this.input, p.css);
        }

        if (p.type === 'number') {
            this.pointerListener = new BB.PointerListener({
                target: this.input,
                onWheel: (e) => {
                    const stepSize = p.step ?? 1;
                    const stepDigits = getDecimalDigits(stepSize);
                    const fac = e.shiftKey ? 4 : 1;
                    const value = parseFloat(this.input.value) - e.deltaY * stepSize * fac;
                    this.input.value = '' + BB.round(value, stepDigits);
                    handleChange() && p.onChange?.(this.getValue());
                },
            });
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): G {
        return this.value;
    }

    setValue(value: G, triggerChange: boolean = false): void {
        this.input.value = '' + value;
        if (triggerChange) {
            this.input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            this.value = value;
        }
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

    setRange(min: number | undefined, max: number | undefined): void {
        if (min !== undefined) {
            this.input.min = '' + min;
        }
        if (max !== undefined) {
            this.input.max = '' + max;
        }
    }

    destroy(): void {
        this.input.removeEventListener('change', this.changeListener);
        this.input.removeEventListener('input', this.inputListener);
        if (this.blurListener) {
            this.input.removeEventListener('blur', this.blurListener);
        }
        this.pointerListener?.destroy();
    }
}
