import { BB } from '../../../bb/bb';
import { calcSliderFalloffFactor } from './slider-falloff';
import { IKlSliderConfig } from '../../kl-types';
import { languageStrings } from '../../../language/language';
import { KlSliderManualInput } from './kl-slider-manual-input';
import { SplineInterpolator } from '../../../bb/math/line';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { IPointerEvent } from '../../../bb/input/event.types';
import { IChainElement } from '../../../bb/input/event-chain/event-chain.types';

/**
 * Horizontal slider, can be changed by dragging anywhere on it. Has a label & value.
 * e.g. used for brush size
 *
 * left mouse button - set absolute value
 * right mouse button - change relative value
 * drag mouse vertically away - precision mode
 * double-click/tap slider - manual input mode
 *
 * Values can be spline interpolated
 * On change callback can be debounced
 *
 */
export class KlSlider {
    /*
    Three types of values
    - value - the actual value, when using setValue(), getValue(), and what is emitted
    - displayValue - the number that the user sees on the slider and in the manual input field
        - might be further formatted with formatFunc
        - also might be the same as value, if no toDisplayValue function provided
    - sliderValue - the draggable position of the slider, 0 - 1
     */

    private value: number;

    private readonly elementWidth: number;
    private readonly elementHeight: number;
    private isEnabled: boolean;

    private min: number; // min value
    private max: number; // max value
    private useSpline: boolean;
    private splineInterpolator: undefined | SplineInterpolator;
    private readonly resolution: number;

    private readonly isChangeOnFinal: boolean;
    private readonly formatFunc: undefined | ((val: number) => number | string);
    private readonly unit: string | undefined;

    private readonly onChange: (val: number) => void;
    private readonly valueToDisplayValue: (value: number) => number;
    private readonly displayValueToValue: (displayValue: number) => number;

    private readonly rootEl: HTMLElement;
    private readonly sliderWrapperEl: HTMLElement;
    private readonly textEl: HTMLElement; // displays label, displayValue
    private readonly label: string;
    private readonly control: HTMLElement;
    private manualInput: undefined | KlSliderManualInput;
    private readonly manualInputRoundDigits: number | undefined;

    private pointerListener: PointerListener | undefined;
    private readonly pointerListenerTimeout: ReturnType<typeof setTimeout>;

    private readonly eventResMs: undefined | number;
    private emitValue: undefined | number; // next value for interval
    private emitInterval: ReturnType<typeof setTimeout> | undefined; // interval of eventResMs which calls onChange()

    private valueToSliderValue(value: number): number {
        if (this.useSpline && this.splineInterpolator) {
            return this.splineInterpolator.findX(value, Math.floor(this.resolution)) || 0;
        }
        return (value - this.min) / (this.max - this.min);
    }

    private sliderValueToValue(sliderValue: number): number {
        let result = this.min + sliderValue * (this.max - this.min);
        if (this.useSpline && this.splineInterpolator) {
            result = this.splineInterpolator.interpolate(sliderValue) || 0;
        }
        return result;
    }

    private updateLabel(): void {
        let displayValue: number | string = this.valueToDisplayValue(this.value);
        displayValue = this.formatFunc ? this.formatFunc(displayValue) : Math.round(displayValue);
        displayValue = displayValue.toLocaleString(languageStrings.getCode());
        const unit = this.unit !== undefined ? this.unit : '';
        this.textEl.innerHTML =
            this.label +
            '&nbsp;&nbsp;<span style="font-weight:bold">' +
            displayValue +
            unit +
            '</span>';

        const sliderValue = this.valueToSliderValue(this.value);
        this.control.style.width = sliderValue * this.elementWidth + 'px';
    }

    private emit(isFinal: boolean): void {
        if (!isFinal && this.isChangeOnFinal) {
            return;
        }

        if (isFinal || !this.eventResMs) {
            this.onChange(this.value);
            if (this.emitInterval) {
                clearInterval(this.emitInterval);
                this.emitInterval = undefined;
            }
            return;
        }

        if (this.emitInterval) {
            this.emitValue = this.value;
        } else {
            this.onChange(this.value);

            this.emitInterval = setInterval(() => {
                if (this.emitValue === undefined) {
                    clearInterval(this.emitInterval);
                    this.emitInterval = undefined;
                } else {
                    this.onChange(this.emitValue);
                    this.emitValue = undefined;
                }
            }, this.eventResMs);
        }
    }

    private updateEnable(): void {
        this.sliderWrapperEl.classList.toggle('slider-wrapper--disabled', !this.isEnabled);
        BB.css(this.sliderWrapperEl, {
            opacity: this.isEnabled ? '' : '0.5',
            pointerEvents: this.isEnabled ? '' : 'none',
        });
        if (this.manualInput) {
            this.manualInput.setIsEnabled(this.isEnabled);
        }
    }

    private showManualInput(): void {
        this.manualInput = new KlSliderManualInput(
            this.valueToDisplayValue(this.value),
            this.valueToDisplayValue(this.min),
            this.valueToDisplayValue(this.max),
            this.sliderWrapperEl.getBoundingClientRect(),
            (val) => {
                val = this.displayValueToValue(val);
                this.setValue(BB.clamp(val, this.min, this.max));
                this.onChange(this.value);
            },
            () => {
                BB.css(this.sliderWrapperEl, {
                    display: '',
                });
                if (this.manualInput) {
                    this.manualInput.getElement().remove();
                    this.manualInput.destroy();
                }
                this.manualInput = undefined;
            },
            this.manualInputRoundDigits && this.manualInputRoundDigits > 0
                ? this.manualInputRoundDigits
                : 0,
        );
        this.manualInput.setIsEnabled(this.isEnabled);
        this.rootEl.append(this.manualInput.getElement());
        setTimeout(() => {
            this.manualInput && this.manualInput.focus();
        });
        BB.css(this.sliderWrapperEl, {
            display: 'none',
        });
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        label: string;
        width: number; // px
        height: number; // px
        min: number; // min value
        max: number;
        value: number;
        resolution?: number; // int, if you want spline.findX() to use a custom resolution
        curve?: 'quadratic' | [number, number][]; // optional. array is BB.SplineInterpolator points. 0-1
        formatFunc?: (val: number) => number | string; // function to display a different number than value
        onChange?: (val: number) => void;
        isChangeOnFinal?: boolean; // only fire onChange on pointerUp
        eventResMs?: number; // frequency of change events
        isEnabled?: boolean; // default = true
        manualInputRoundDigits?: number; // default 0, how value should be rounded for manual input
        toDisplayValue?: (value: number) => number;
        toValue?: (displayValue: number) => number;
        unit?: string; // attached to end of value in output
    }) {
        this.isEnabled = p.isEnabled !== false;
        this.manualInputRoundDigits = p.manualInputRoundDigits;
        this.useSpline = !!p.curve;

        if (!p.label) {
            throw new Error('KlSlider missing params');
        }
        if (p.min != 0 && p.max != 0 && p.value != 0) {
            if (!p.min || !p.max || !p.value) {
                throw new Error('KlSlider broken params');
            }
        }
        if (p.min >= p.max) {
            throw new Error('KlSlider broken params');
        }

        this.min = p.min;
        this.max = p.max;
        this.value = BB.clamp(p.value, this.min, this.max);
        this.elementWidth = p.width;
        this.elementHeight = p.height;
        this.resolution = p.resolution ? p.resolution : this.elementWidth * 2;

        this.onChange = p.onChange ? p.onChange : () => {};
        if (!p.toValue !== !p.toDisplayValue) {
            throw new Error('both or neither have to be set, toValue and toDisplayValue');
        }
        this.displayValueToValue = p.toValue ? p.toValue : (displayValue) => displayValue;
        this.valueToDisplayValue = p.toDisplayValue ? p.toDisplayValue : (value) => value;
        this.isChangeOnFinal = !!p.isChangeOnFinal;
        this.formatFunc = p.formatFunc;
        this.eventResMs = p.eventResMs;
        this.unit = p.unit;

        if (this.useSpline) {
            if (!p.curve) {
                throw new Error('curve needs to be set if useSpline true');
            }
            const curveArr: [number, number][] =
                p.curve === 'quadratic'
                    ? BB.quadraticSplineInput(this.min, this.max, 0.1)
                    : p.curve;
            this.splineInterpolator = new BB.SplineInterpolator(curveArr);
        }

        this.rootEl = BB.el({
            css: {
                display: 'flex',
            },
        });
        this.sliderWrapperEl = BB.el({
            parent: this.rootEl,
            className: 'slider-wrapper',
            css: {
                overflow: 'hidden',
                position: 'relative',
                width: this.elementWidth + 'px',
                height: this.elementHeight + 'px',
                userSelect: 'none',
            },
        });
        this.rootEl.oncontextmenu = function () {
            return false;
        };
        this.label = p.label;
        const labelFontSize = this.elementHeight - 14;
        this.textEl = BB.el({
            content: this.label,
            css: {
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '7px',
                height: '100%',
                fontSize: labelFontSize + 'px',
                pointerEvents: 'none',
            },
        });
        this.control = BB.el({
            className: 'slider-inner',
            css: {
                position: 'absolute',
                left: '0',
                top: '0',
                width: this.valueToSliderValue(this.value) * this.elementWidth + 'px',
                height: this.elementHeight + 'px',
            },
        });
        const controlInner = document.createElement('div');

        this.sliderWrapperEl.append(this.control, this.textEl);
        this.control.append(controlInner);

        this.updateEnable();

        const doubleTapper = new BB.DoubleTapper({
            onDoubleTap: () => {
                this.showManualInput();
            },
        });
        doubleTapper.setAllowedButtonArr(['left', 'right']);
        const eventChain = new BB.EventChain({
            chainArr: [doubleTapper as IChainElement],
        });

        let virtualVal: number;
        const onPointer = (event: IPointerEvent) => {
            event.eventPreventDefault();

            if (!this.isEnabled) {
                return;
            }

            if (event.type === 'pointerdown') {
                // unfocus manual slider input
                BB.unfocusAnyInput();

                this.sliderWrapperEl.className = 'slider-wrapper slider-wrapper--active';

                if (event.button === 'left') {
                    let sliderValue = event.relX / this.elementWidth;
                    sliderValue = Math.max(0, Math.min(1, sliderValue));
                    this.value = this.sliderValueToValue(sliderValue);
                    this.updateLabel();
                    this.emit(false);
                }
                virtualVal = this.valueToSliderValue(this.value);
            }

            if (event.type === 'pointermove' && ['left', 'right'].includes(event.button || '')) {
                let deltaX = event.dX;
                const deltaY = Math.abs(event.pageY - (event.downPageY || 0));
                const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');
                deltaX *= factor;
                deltaX /= this.elementWidth;

                virtualVal += deltaX;

                const sliderValue = Math.max(0, Math.min(1, virtualVal));
                this.value = this.sliderValueToValue(sliderValue);
                this.updateLabel();
                this.emit(false);
            }

            if (event.type === 'pointerup') {
                this.sliderWrapperEl.className = 'slider-wrapper';
                this.emit(true);
            }
        };

        this.pointerListenerTimeout = setTimeout(() => {
            this.pointerListener = new BB.PointerListener({
                target: this.sliderWrapperEl,
                fixScribble: true,
                onPointer: (e) => {
                    onPointer(e);
                    eventChain.chainIn(e);
                },
                onWheel: (event) => {
                    let sliderValue = this.valueToSliderValue(this.value);
                    sliderValue = BB.clamp(sliderValue - event.deltaY / 40, 0, 1);
                    this.value = this.sliderValueToValue(sliderValue);
                    this.updateLabel();
                    this.onChange(this.value);
                },
            });
            this.updateLabel();
        }, 1);
    }

    changeSliderValue(f: number): void {
        if (!this.isEnabled) {
            return;
        }
        let sliderValue = this.valueToSliderValue(this.value);
        sliderValue = BB.clamp(sliderValue + f, 0, 1);
        this.value = this.sliderValueToValue(sliderValue);
        this.updateLabel();
        this.onChange(this.value);
    }

    setValue(v: number): void {
        this.value = BB.clamp(v, this.min, this.max);
        this.updateLabel();
    }

    getValue(): number {
        return this.value;
    }

    getDisplayValue(): number {
        return this.valueToDisplayValue(this.value);
    }

    update(config: IKlSliderConfig): void {
        this.min = config.min;
        this.max = config.max;
        this.useSpline = !!config.curve;
        if (this.useSpline) {
            if (!config.curve) {
                throw new Error('curve needs to be set if useSpline true');
            }
            const curveArr =
                config.curve === 'quadratic'
                    ? BB.quadraticSplineInput(this.min, this.max, 0.1)
                    : config.curve;
            this.splineInterpolator = new BB.SplineInterpolator(curveArr);
        } else {
            this.splineInterpolator = undefined;
        }
        this.setIsEnabled(!config.isDisabled);
    }

    setIsEnabled(e: boolean): void {
        this.isEnabled = !!e;
        this.updateEnable();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        clearTimeout(this.pointerListenerTimeout);
        this.pointerListener && this.pointerListener.destroy();
        if (this.manualInput) {
            this.manualInput.destroy();
        }
        if (this.emitInterval) {
            clearInterval(this.emitInterval);
        }
    }
}
