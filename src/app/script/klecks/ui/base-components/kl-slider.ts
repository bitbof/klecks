import {BB} from '../../../bb/bb';
import {calcSliderFalloffFactor} from './slider-falloff';
import {IKlSliderConfig} from '../../kl.types';
import {languageStrings} from '../../../language/language';
import {DoubleTapper, EventChain} from '../../../bb/input/event-chain';
import {KlSliderManualInput} from './kl-slider-manual-input';

/**
 * Horizontal slider, can be changed by dragging anywhere on it. Has a label & value.
 * e.g. used for brush size
 *
 * left mouse button - set absolute value
 * right mouse button - change relative value
 * drag mouse vertically away - high precision mode
 * double-click/tap slider -> manual input mode
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

    private elementWidth: number;
    private elementHeight: number;
    private isEnabled: boolean;

    private min: number; // min value
    private max: number; // max value
    private useSpline: boolean;
    private splineInterpolator: any; // todo type
    private resolution: number;

    private isChangeOnFinal: boolean;
    private formatFunc: null | ((val: number) => number);

    private onChange: (val: number) => void;
    private valueToDisplayValue: (value: number) => number;
    private displayValueToValue: (displayValue: number) => number;


    private roolEl: HTMLElement;
    private sliderWrapperEl: HTMLElement;
    private textEl: HTMLElement; // displays label, displayValue
    private label: string;
    private control: HTMLElement;
    private manualInput: null | KlSliderManualInput;
    private manualInputRoundDigits: number;

    private pointerListener: any; // todo type
    private pointerListenerTimeout: any;

    private eventResMs: null | number;
    private emitValue: null | number = null; // next value for interval
    private emitInterval: null | any; // interval of eventResMs which calls onChange()

    private valueToSliderValue(value: number): number {
        if (this.useSpline) {
            return this.splineInterpolator.findX(value, Math.floor(this.resolution));
        }
        return (value - this.min) / (this.max - this.min);
    }

    private sliderValuetoValue(sliderValue: number): number {
        let result = this.min + sliderValue * (this.max - this.min);
        if (this.useSpline) {
            result = this.splineInterpolator.interpolate(sliderValue);
        }
        return result;
    }

    private updateLabel(): void {
        let displayValue: number | string = this.valueToDisplayValue(this.value);
        displayValue = this.formatFunc ? this.formatFunc(displayValue) : Math.round(displayValue);
        displayValue = displayValue.toLocaleString(languageStrings.getCode());
        this.textEl.innerHTML = this.label + '&nbsp;&nbsp;<span style="font-weight:bold">' + displayValue + '</span>';

        const sliderValue = this.valueToSliderValue(this.value);
        this.control.style.width = (sliderValue * this.elementWidth) + 'px';
    }

    private emit(isFinal: boolean): void {
        if (!isFinal && this.isChangeOnFinal) {
            return;
        }

        if (isFinal || !this.eventResMs) {
            this.onChange(this.value);
            if (this.emitInterval) {
                clearInterval(this.emitInterval);
                this.emitInterval = null;
            }
            return;
        }

        if (this.emitInterval) {
            this.emitValue = this.value;

        } else {
            this.onChange(this.value);

            this.emitInterval = setInterval(() => {
                if (this.emitValue === null) {
                    clearInterval(this.emitInterval);
                    this.emitInterval = null;
                } else {
                    this.onChange(this.emitValue);
                    this.emitValue = null;
                }
            }, this.eventResMs);
        }
    }

    private updateEnable(): void {
        BB.css(this.sliderWrapperEl, {
            opacity: this.isEnabled ? null : '0.5',
            pointerEvents: this.isEnabled ? null : 'none',
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
                    display: null,
                });
                this.roolEl.removeChild(this.manualInput.getElement());
                this.manualInput.destroy();
                this.manualInput = null;
            },
            (this.manualInputRoundDigits && this.manualInputRoundDigits > 0) ? this.manualInputRoundDigits : 0,
        );
        this.roolEl.append(this.manualInput.getElement());
        setTimeout(() => {
            this.manualInput.focus();
        });
        BB.css(this.sliderWrapperEl, {
            display: 'none',
        });
    }


    // --- public ---

    constructor (
        p: {
            label: string,
            width: number, // px
            height: number, // px
            min: number, // min value
            max: number,
            value: number,
            resolution?: number, // int, if you want spline.findX() to use a custom resolution
            curve?: 'quadratic' | any[], // optional. array is BB.SplineInterpolator points. 0-1
            formatFunc?: (val: number) => number, // function to display a different number than value
            onChange?: (val: number) => void,
            isChangeOnFinal?: boolean, // only fire onChange on pointerUp
            eventResMs?: number, // frequency of change events
            isEnabled?: boolean, // default = true
            manualInputRoundDigits?: number, // default 0, how value should be rounded for manual input
            toDisplayValue?: (value: number) => number,
            toValue?: (displayValue: number) => number,
        }
    ) {
        const _this = this;
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
        if (!this.displayValueToValue !== !this.valueToDisplayValue) {
            throw new Error('both or neither have to be set, toValue and toDisplayValue');
        }
        this.displayValueToValue = p.toValue ? p.toValue : (displayValue) => displayValue;
        this.valueToDisplayValue = p.toDisplayValue ? p.toDisplayValue : (value) => value;
        this.isChangeOnFinal = !!p.isChangeOnFinal;
        this.formatFunc = p.formatFunc;
        this.eventResMs = p.eventResMs;

        if (this.useSpline) {
            const curveArr = p.curve === 'quadratic' ? BB.quadraticSplineInput(this.min, this.max, 0.1) : p.curve;
            this.splineInterpolator = new BB.SplineInterpolator(curveArr);
        }

        this.roolEl = BB.el({
            css: {
                display: 'flex',
            }
        });
        this.sliderWrapperEl = BB.el({
            parent: this.roolEl,
            className: 'sliderWrapper',
            css: {
                overflow: 'hidden',
                position: 'relative',
                width: this.elementWidth + 'px',
                height: this.elementHeight + 'px',
                userSelect: 'none'
            }
        });
        this.roolEl.oncontextmenu = function () {
            return false;
        };
        this.label = p.label;
        const labelFontSize = this.elementHeight - 14;
        this.textEl = BB.el({
            content: this.label,
            css: {
                position: 'absolute',
                left: '7px',
                top: (this.elementHeight / 2 - labelFontSize / 2 + 1) + 'px',
                lineHeight: labelFontSize + 'px',
                fontSize: labelFontSize + 'px',
                pointerEvents: 'none'
            }
        });
        this.control = BB.el({
            className: 'sliderInner',
            css: {
                position: 'absolute',
                left: '0',
                top: '0',
                width: (this.valueToSliderValue(this.value) * this.elementWidth) + 'px',
                height: this.elementHeight + 'px',
            }
        });
        const controlInner = document.createElement('div');

        this.sliderWrapperEl.append(this.control, this.textEl);
        this.control.append(controlInner);

        this.updateEnable();


        const doubleTapper = new DoubleTapper({
            onDoubleTap: () => {
                this.showManualInput();
            }
        })
        doubleTapper.setAllowedButtonArr(['left', 'right']);
        const eventChain = new EventChain({
            chainArr: [
                doubleTapper
            ]
        });

        let virtualVal;
        const onPointer = (event) => {
            event.eventPreventDefault();

            if (!this.isEnabled) {
                return;
            }

            if (event.type === 'pointerdown') {

                // unfocus manual slider input
                BB.unfocusAnyInput();

                this.sliderWrapperEl.className = 'sliderWrapper sliderWrapperActive';

                if (event.button === 'left') {
                    let sliderValue = event.relX / this.elementWidth;
                    sliderValue = Math.max(0, Math.min(1, sliderValue));
                    this.value = this.sliderValuetoValue(sliderValue);
                    this.updateLabel();
                    this.emit(false);
                }
                virtualVal = this.valueToSliderValue(this.value);
            }

            if (event.type === 'pointermove' && ['left', 'right'].includes(event.button)) {

                let deltaX = event.dX;
                const deltaY = Math.abs(event.pageY - event.downPageY);
                const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');
                deltaX *= factor;
                deltaX /= this.elementWidth;

                virtualVal += deltaX;

                let sliderValue = Math.max(0, Math.min(1, virtualVal));
                this.value = this.sliderValuetoValue(sliderValue);
                this.updateLabel();
                this.emit(false);
            }

            if (event.type === 'pointerup') {
                this.sliderWrapperEl.className = 'sliderWrapper';
                this.emit(true);
            }

        }

        this.pointerListenerTimeout = setTimeout(() => {
            this.pointerListener = new BB.PointerListener({
                target: this.sliderWrapperEl,
                maxPointers: 1,
                fixScribble: true,
                onPointer: (e) => {
                    onPointer(e);
                    eventChain.chainIn(e);
                },
                onWheel: (event) => {
                    let sliderValue = this.valueToSliderValue(this.value);
                    sliderValue = BB.clamp(sliderValue - event.deltaY / 40, 0, 1);
                    this.value = this.sliderValuetoValue(sliderValue);
                    this.updateLabel();
                    this.onChange(this.value);
                }
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
        this.value = this.sliderValuetoValue(sliderValue);
        this.updateLabel();
        this.onChange(this.value);
    }

    setValue (v: number): void {
        this.value = BB.clamp(v, this.min, this.max);
        this.updateLabel();
    }

    getValue (): number {
        return this.value;
    }

    update (config: IKlSliderConfig): void {
        this.min = config.min;
        this.max = config.max;
        this.useSpline = !!config.curve;
        if (this.useSpline) {
            const curveArr = config.curve === 'quadratic' ? BB.quadraticSplineInput(this.min, this.max, 0.1) : config.curve;
            this.splineInterpolator = new BB.SplineInterpolator(curveArr);
        } else {
            this.splineInterpolator = null;
        }
        this.setIsEnabled(!config.isDisabled);
    }

    setIsEnabled (e: boolean): void {
        this.isEnabled = !!e;
        this.updateEnable();
    }

    destroy (): void {
        clearTimeout(this.pointerListenerTimeout);
        if (this.pointerListener) {
            this.pointerListener.destroy();
        }
        if (this.manualInput) {
            this.manualInput.destroy();
        }
        if (this.emitInterval) {
            clearInterval(this.emitInterval);
        }
    }

    getElement (): HTMLElement {
        return this.roolEl;
    }

}
