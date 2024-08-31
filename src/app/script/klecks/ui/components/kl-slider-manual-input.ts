import { BB } from '../../../bb/bb';
import { input } from './input';

/**
 * Used by KlSlider. Allows user to type in value in input (type=number) field, instead of dragging with mouse.
 * Input goes away when losing focus, or when pressing Enter/Escape.
 */
export class KlSliderManualInput {
    private readonly input: HTMLInputElement;
    private isEnabled: boolean = true;
    private scrollBefore: { x: number; y: number } | undefined; // window scroll position on creation
    private lastValue: number; // last emitted value
    private isClosed: boolean = false;

    private emit(): void {
        if (this.lastValue !== Number(this.input.value)) {
            this.onChange(Number(this.input.value));
            this.lastValue = Number(this.input.value);
        }
    }

    private privateOnClose(): void {
        if (this.isClosed) {
            return;
        }
        this.isClosed = true;

        this.emit();
        this.onClose();
        setTimeout(() => {
            // because iPad keyboard changes the scroll position
            this.scrollBefore && window.scrollTo(this.scrollBefore.x, this.scrollBefore.y);
            this.scrollBefore = undefined;
        });
    }

    // ----------------------------------- public -----------------------------------

    constructor(
        value: number, // initial value (displayValue)
        min: number,
        max: number,
        rect: DOMRect, // size of input field
        private onChange: (displayValue: number) => void,
        private onClose: () => void,
        roundDigits?: number,
    ) {
        this.input = input({
            type: 'number',
            init: value,
            min,
            max,
            callback: (val) => {
                this.emit();
            },
        });
        if (roundDigits !== 0) {
            this.input.setAttribute('step', 'any');
        }
        this.input.onblur = () => {
            this.privateOnClose();
        };
        this.input.addEventListener(
            'keyup',
            (e) => {
                if (['Enter', 'Escape'].includes(e.key)) {
                    this.privateOnClose();
                } else {
                    this.emit();
                }
            },
            { passive: false },
        );
        this.input.addEventListener('wheel', () => this.emit(), { passive: false });

        this.scrollBefore = {
            x: window.scrollX,
            y: window.scrollY,
        };

        let currentValue;
        if (roundDigits || roundDigits === 0) {
            currentValue = BB.round(value, roundDigits);
        } else {
            currentValue = value;
        }
        this.lastValue = currentValue;
        this.input.value = '' + currentValue;

        BB.css(this.input, {
            width: rect.width + 'px',
            height: rect.height + 'px',
        });
    }

    getElement() {
        return this.input;
    }

    setIsEnabled(b: boolean): void {
        this.isEnabled = !!b;
    }

    focus(): void {
        this.input.focus();
        this.input.select();
    }

    destroy(): void {
        BB.destroyEl(this.input);
    }
}
