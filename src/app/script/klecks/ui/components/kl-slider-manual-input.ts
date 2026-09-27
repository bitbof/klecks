import { BB } from '../../../bb/bb';
import { Input } from './input';

/**
 * Used by KlSlider. Allows user to type in value in input (type=number) field, instead of dragging with mouse.
 * Input goes away when losing focus, or when pressing Enter/Escape.
 */
export class KlSliderManualInput {
    private readonly input: Input<number>;
    private scrollBefore: { x: number; y: number } | undefined; // window scroll position on creation
    private lastValue: number; // last emitted value
    private isClosed: boolean = false;

    private emit(): void {
        const value = Number(this.input.getValue());
        if (this.lastValue !== value) {
            this.onChange(value);
            this.lastValue = value;
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
        this.input = new Input({
            type: 'number',
            init: value,
            min,
            max,
            name: 'slider-manual-input',
            step: roundDigits === undefined ? undefined : 10 ** -roundDigits,
            onChange: () => this.emit(),
            onBlur: () => this.privateOnClose(),
            css: {
                width: rect.width,
                height: rect.height,
            },
        });
        this.input.getElement().addEventListener(
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
        this.input.setValue(currentValue);
    }

    getElement() {
        return this.input.getElement();
    }

    focus(): void {
        this.input.focus();
        this.input.select();
    }

    destroy(): void {
        this.input.destroy();
    }
}
