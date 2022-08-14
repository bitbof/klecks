import {BB} from '../../../bb/bb';

/**
 * Checkbox - with label
 */
export class Checkbox {

    private element: HTMLElement;
    private check: HTMLInputElement;
    private doHighlight: boolean;

    // --- public ---

    constructor (params: {
        init?: boolean; // default false
        label: string;
        callback: (boolean) => void;
        allowTab?: boolean; // default false
        title?: string;
        doHighlight?: boolean; // default false
        css?: any;
    }) {
        this.doHighlight = params.doHighlight;

        this.element = BB.el({
            className: 'kl-checkbox'
        });

        const innerEl = BB.el({
            parent: this.element,
            tagName: 'label',
            className: 'kl-checkbox__inner'
        });

        this.check = BB.el({
            parent: innerEl,
            tagName: 'input',
            css: {
                marginLeft: '0',
                display: 'inline-block'
            },
            custom: {
                type: 'checkbox'
            }
        }) as HTMLInputElement;
        this.check.checked = params.init;
        if (this.doHighlight && this.check.checked) {
            this.element.classList.add('kl-checkbox--highlight');
        }
        if (!params.allowTab) {
            this.check.tabIndex = -1;
        }

        if (params.title) {
            innerEl.title = params.title;
        }

        const label = document.createElement('div');
        label.style.display = 'inline-block';
        label.innerHTML = params.label;
        (label as any).allowClick = true;
        innerEl.appendChild(label);

        this.check.onchange = () => {
            if (this.doHighlight) {
                this.element.classList.toggle('kl-checkbox--highlight', this.check.checked);
            }
            params.callback(this.check.checked);
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

    setValue(b: boolean) {
        this.check.checked = !!b;
        if (this.doHighlight) {
            this.element.classList.toggle('kl-checkbox--highlight', this.check.checked);
        }
    }

    getElement(): HTMLElement {
        return this.element;
    }

    destroy() {
        this.check.onchange = null;
    }

}
