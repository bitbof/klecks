import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { KlColorSlider } from '../components/kl-color-slider';

/**
 * Text Tool tab contents (color slider)
 */
export class TextUi {
    private readonly rootEl: HTMLElement;
    private readonly colorDiv: HTMLElement;
    private isVisible: boolean = true;
    private readonly colorSlider: KlColorSlider;

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        colorSlider: KlColorSlider; // when opening tab, inserts it (snatches it from where else it was)
    }) {
        this.rootEl = BB.el({
            css: {
                margin: '10px',
            },
        });
        this.colorSlider = p.colorSlider;

        this.colorDiv = BB.el({
            parent: this.rootEl,
            css: {
                marginBottom: '10px',
            },
        });

        const hint = BB.el({
            parent: this.rootEl,
            content: LANG('text-instruction'),
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(pIsVisible: boolean): void {
        this.isVisible = !!pIsVisible;
        this.rootEl.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.colorDiv.append(
                this.colorSlider.getElement(),
                this.colorSlider.getOutputElement(),
            );
        }
    }
}
