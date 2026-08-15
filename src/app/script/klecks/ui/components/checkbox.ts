import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';
import { TCss } from '../../../bb/bb-types';

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
        isEnabled?: boolean; // default true
        label: string;
        callback?: (b: boolean) => void;
        allowTab?: boolean; // default false
        title?: string;
        doHighlight?: boolean; // default false
        css?: TCss;
        name: string;
    }) {
        const isEnabled = p.isEnabled ?? true;
        this.doHighlight = !!p.doHighlight;

        this.rootEl = BB.el({
            className: 'kl-checkbox',
        });
        this.rootEl.classList.toggle('kl-checkbox--disabled', !isEnabled);

        const innerEl = BB.el({
            parent: this.rootEl,
            tagName: 'label',
            className: 'kl-checkbox__inner',
            css: {
                display: 'flex',
                alignItems: 'center',
            },
        });

        this.check = BB.el({
            parent: innerEl,
            tagName: 'input',
            css: {
                margin: '0 5px 0 0',
                // otherwise varies by browser
                width: 14,
                height: 14,
            },
            custom: {
                type: 'checkbox',
                name: p.name,
                ...(!isEnabled ? { disabled: 'true' } : {}),
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
            css: { display: 'flex', alignItems: 'center', gap: 3 },
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

    setEnabled(enabled: boolean): void {
        this.check.disabled = !enabled;
        this.rootEl.classList.toggle('kl-checkbox--disabled', !enabled);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.check.onchange = null;
    }
}
