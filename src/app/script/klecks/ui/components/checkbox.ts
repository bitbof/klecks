import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';

/**
 * Checkbox - with label
 */
export class Checkbox {
    private readonly rootEl: HTMLElement;
    private check: HTMLInputElement;
    private readonly doHighlight: boolean;

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        init?: boolean; // default false
        label: string;
        callback?: (b: boolean) => void;
        allowTab?: boolean; // default false
        title?: string;
        doHighlight?: boolean; // default false
        css?: Partial<CSSStyleDeclaration>;
        name: string;
    }) {
        this.doHighlight = !!p.doHighlight;

        this.rootEl = BB.el({
            className: 'kl-checkbox',
        });

        const innerEl = BB.el({
            parent: this.rootEl,
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
                name: p.name,
            },
        });

        this.check.checked = !!p.init;
        if (this.doHighlight && this.check.checked) {
            this.rootEl.classList.add('kl-checkbox--highlight');
        }
        if (!p.allowTab) {
            this.check.tabIndex = -1;
        }

        if (p.title) {
            innerEl.title = p.title;
        }

        const label = BB.el({
            parent: innerEl,
            content: p.label,
            css: {},
        });

        this.check.onchange = () => {
            if (this.doHighlight) {
                this.rootEl.classList.toggle('kl-checkbox--highlight', this.check.checked);
            }
            p.callback && p.callback(this.check.checked);
            setTimeout(() => {
                this.check.blur();
            }, 0);
        };
        if (p.css) {
            css(this.rootEl, p.css);
        }
    }

    getValue(): boolean {
        return this.check.checked;
    }

    setValue(b: boolean): void {
        this.check.checked = b;
        if (this.doHighlight) {
            this.rootEl.classList.toggle('kl-checkbox--highlight', this.check.checked);
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.check.onchange = null;
    }
}
