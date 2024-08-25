import { BB } from '../../../bb/bb';
import { IKeyStringOptional } from '../../../bb/bb-types';

/**
 * Checkbox - with label
 */
export class Checkbox {
    private readonly element: HTMLElement;
    private check: HTMLInputElement;
    private readonly doHighlight: boolean;

    // ----------------------------------- public -----------------------------------

    constructor(params: {
        init?: boolean; // default false
        label: string;
        callback?: (b: boolean) => void;
        allowTab?: boolean; // default false
        title?: string;
        doHighlight?: boolean; // default false
        css?: IKeyStringOptional;
    }) {
        this.doHighlight = !!params.doHighlight;

        this.element = BB.el({
            className: 'kl-checkbox',
        });

        const innerEl = BB.el({
            parent: this.element,
            tagName: 'label',
            className: 'kl-checkbox__inner',
            css: {
                display: 'flex',
            },
        });

        this.check = BB.el({
            parent: innerEl,
            tagName: 'input',
            css: {
                margin: '0 5px 0 0',
            },
            custom: {
                type: 'checkbox',
            },
        });

        this.check.checked = !!params.init;
        if (this.doHighlight && this.check.checked) {
            this.element.classList.add('kl-checkbox--highlight');
        }
        if (!params.allowTab) {
            this.check.tabIndex = -1;
        }

        if (params.title) {
            innerEl.title = params.title;
        }

        const label = BB.el({
            parent: innerEl,
            content: params.label,
            css: {},
        });
        (label as any).allowClick = true;

        this.check.onchange = () => {
            if (this.doHighlight) {
                this.element.classList.toggle('kl-checkbox--highlight', this.check.checked);
            }
            params.callback && params.callback(this.check.checked);
            setTimeout(() => {
                this.check.blur();
            }, 0);
        };
        if (params.css) {
            BB.css(this.element, params.css);
        }
    }

    getValue(): boolean {
        return this.check.checked;
    }

    setValue(b: boolean): void {
        this.check.checked = !!b;
        if (this.doHighlight) {
            this.element.classList.toggle('kl-checkbox--highlight', this.check.checked);
        }
    }

    getElement(): HTMLElement {
        return this.element;
    }

    destroy(): void {
        this.check.onchange = null;
    }
}
