import { BB } from '../../../bb/bb';
import { IKeyString } from '../../../bb/bb-types';
import { KeyListener } from '../../../bb/input/key-listener';

type TInputType = 'button' | 'checkbox' | 'number' | 'text' | 'color';

export type TInputParams = {
    type?: TInputType; // default: text
    init: string | number;
    title?: string;
    label?: string | HTMLElement;

    // for type: number
    min?: number;
    max?: number;
    step?: number;

    onChange?: (v: string) => void;

    doScrollWithoutFocus?: boolean; // default: false
    doResetIfInvalid?: boolean; // default: false

    css?: IKeyString;
};

export class Input {
    private readonly rootEl: HTMLLabelElement;
    private readonly input: HTMLInputElement;
    private readonly type: TInputType;
    private readonly pointerListener;
    private readonly keyListener: KeyListener = {
        destroy: () => {},
    } as KeyListener;

    // ----------------------------------- public -----------------------------------
    constructor(p: TInputParams) {
        this.rootEl = BB.el({
            tagName: 'label',
            content: p.label,
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
            },
        });

        this.input = BB.el({
            tagName: 'input',
            parent: this.rootEl,
            title: p.title,
        });

        this.input.type;

        this.type = p.type ?? 'text';
        try {
            this.input.type = this.type;
        } catch (e) {
            // ie can't deal with number
        }

        const stepSize = p.step ?? 1;

        if (this.type === 'number') {
            if (p.min !== undefined) {
                this.input.min = '' + p.min;
            }
            if (p.max !== undefined) {
                this.input.max = '' + p.max;
            }
            if (p.step !== undefined) {
                this.input.step = '' + stepSize;
            }
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

        if (p.onChange) {
            const onChange = p.onChange;
            this.input.onchange = () => {
                handleChange() && onChange(this.input.value);
            };
        }
        if (p.css) {
            BB.css(this.input, p.css);
        }

        if (p.doScrollWithoutFocus && p.type === 'number' && p.onChange) {
            const onChange = p.onChange;
            this.keyListener = new BB.KeyListener({});
            this.pointerListener = new BB.PointerListener({
                target: this.input,
                onWheel: (e) => {
                    /*if (document.hasFocus()) { // what was the point of this?
                        return;
                    }*/
                    const fac = this.keyListener.isPressed('shift') ? 4 : 1;
                    this.input.value =
                        '' + (parseFloat(this.input.value) - e.deltaY * stepSize * fac);
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

    destroy(): void {
        this.pointerListener && this.pointerListener.destroy();
        this.keyListener.destroy();
    }
}

// todo replace instances with class
export const input = function (params: {
    type?: TInputType; // default text
    min?: number;
    max?: number;
    callback: (val: string) => void;
    init: string | number;
    css?: IKeyString;
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
        BB.css(result, params.css);
    }

    return result;
};
