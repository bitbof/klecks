import { BB } from '../../../bb/bb';

export class RadioList {
    el: HTMLDivElement;
    inputs: HTMLInputElement[] = [];

    constructor({
        name,
        init,
        items,
        ignoreFocus,
    }: {
        name: string;
        init?: string;
        items: {
            label: string;
            value: string;
        }[];
        ignoreFocus?: boolean; // default false
    }) {
        this.el = BB.el({
            className: 'kl-radio',
        });

        items.forEach((item) => {
            const label = BB.el({
                tagName: 'label',
            });
            const input = BB.el({
                tagName: 'input',
                parent: label,
                custom: {
                    name: name,
                    value: item.value,
                    type: 'radio',
                },
            });
            if (ignoreFocus) {
                input.setAttribute('data-ignore-focus', 'true');
            }
            if (init === item.value) {
                input.checked = true;
            }
            label.append(item.label);
            this.el.append(label);
            this.inputs.push(input);
        });
    }

    getValue(): string | null {
        for (let i = 0; i < this.inputs.length; i++) {
            if (this.inputs[i].checked) {
                return this.inputs[i].value;
            }
        }
        return null;
    }

    getElement() {
        return this.el;
    }
}
