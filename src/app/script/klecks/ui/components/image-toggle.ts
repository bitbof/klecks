import { BB } from '../../../bb/bb';
import { Destroyer } from '../../../bb/base/base';

/**
 * Toggle button with an image
 */
export class ImageToggle {
    private readonly rootEl: HTMLElement;
    private isActive: boolean;
    private readonly destroyer = new Destroyer();

    private update(): void {
        this.rootEl.classList.toggle('image-toggle-active', this.isActive);
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        initValue: boolean;
        title: string;
        isRadio?: boolean; // if true, can't click when active
        onChange: (b: boolean) => void;
        image: string;
        darkInvert?: boolean;
    }) {
        this.isActive = p.initValue;
        this.rootEl = BB.el({
            className: 'image-toggle',
            title: p.title,
            content: BB.el({
                className: 'image-toggle__im' + (p.darkInvert ? ' dark-invert' : ''),
                css: {
                    backgroundImage: "url('" + p.image + "')",
                },
            }),
            destroyer: this.destroyer,
            onClick: (e) => {
                e.preventDefault();
                if (p.isRadio && this.isActive) {
                    return;
                }
                this.isActive = !this.isActive;
                this.update();
                p.onChange(this.isActive);
            },
        });

        this.update();
    }

    // --- interface ---
    setValue(b: boolean): void {
        this.isActive = b;
        this.update();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): boolean {
        return this.isActive;
    }

    destroy(): void {
        this.destroyer.destroy();
    }
}
