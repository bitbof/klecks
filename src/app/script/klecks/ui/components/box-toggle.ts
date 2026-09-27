import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';
import { Destroyer } from '../../../bb/base/base';

export class BoxToggle {
    el: HTMLElement;
    value: boolean;
    private readonly destroyer = new Destroyer();

    update(): void {
        this.el.classList.toggle('kl-box-toggle--active', this.value);
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        label: string | HTMLElement | SVGElement;
        title?: string;
        init?: boolean;
        onChange: (b: boolean) => void;
        keepOriginalLabel?: boolean;
    }) {
        this.value = !!p.init;
        this.el = BB.el({
            content: p.label,
            title: p.title,
            className:
                typeof p.label === 'string'
                    ? 'kl-box-toggle'
                    : 'kl-box-toggle kl-box-toggle--custom-el',
            destroyer: this.destroyer,
            onClick: () => {
                this.value = !this.value;
                this.update();
                p.onChange(this.value);
            },
            css: {
                cursor: 'pointer',
            },
        });
        if (typeof p.label !== 'string' && !p.keepOriginalLabel) {
            css(p.label, {
                display: 'block',
                pointerEvents: 'none',
            });
        }
        this.update();
    }

    getValue(): boolean {
        return this.value;
    }

    setValue(b: boolean): void {
        this.value = b;
        this.update();
    }

    getElement(): HTMLElement {
        return this.el;
    }

    destroy(): void {
        this.destroyer.destroy();
    }
}
