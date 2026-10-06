import { BB } from '../../../bb/bb';
import { calcSliderFalloffFactor } from './slider-falloff';
import { TKlSliderConfig } from '../../kl-types';
import { KlSliderManualInput } from './kl-slider-manual-input';
import {
    displayValueToValue,
    formatSliderValue,
    getMaxDecimals,
    sliderValueToValue,
    valueToDisplayValue,
    valueToSliderValue,
} from './slider-value-mapping';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { TPointerEvent } from '../../../bb/input/event.types';
import { TChainElement } from '../../../bb/input/event-chain/event-chain.types';
import { css } from '../../../bb/base/base';

/**
 * Horizontal slider, can be changed by dragging anywhere on it. Has a label & value.
 * e.g. used for brush size
 *
 * left mouse button - set absolute value
 * right mouse button - change relative value
 * drag mouse vertically away - precision mode
 * double-click/tap slider - manual input mode
 *
 * Value can follow a curve (exponent)
 * On change callback can be debounced
 *
 */
export class KlSlider {
    // value types (value, displayValue, sliderValue) explained in slider-value-mapping.ts
    private value: number;

    private readonly elementWidth: number;
    private readonly elementHeight: number;
    private isEnabled: boolean;

    private config: TKlSliderConfig;

    private readonly onChange: (val: number) => void;

    private readonly rootEl: HTMLElement;
    private readonly sliderWrapperEl: HTMLElement;
    private readonly textEl: HTMLElement; // displays label, displayValue
    private readonly labelValueEl: HTMLElement;
    private readonly label: string;
    private readonly control: HTMLElement;
    private manualInput: undefined | KlSliderManualInput;

    private pointerListener: PointerListener | undefined;
    private readonly pointerListenerTimeout: ReturnType<typeof setTimeout>;

    private readonly eventResMs: undefined | number;
    private emitValue: undefined | number; // next value for interval
    private emitInterval: ReturnType<typeof setTimeout> | undefined; // interval of eventResMs which calls onChange()

    private updateLabel(): void {
        this.labelValueEl.textContent = formatSliderValue(this.config, this.value);
        const sliderValue = valueToSliderValue(this.config, this.value);
        this.control.style.width = sliderValue * this.elementWidth + 'px';
    }

    private emit(isFinal: boolean): void {
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
        css(this.sliderWrapperEl, {
            opacity: this.isEnabled ? undefined : 0.5,
            pointerEvents: this.isEnabled ? undefined : 'none',
        });
    }

    private showManualInput(): void {
        this.manualInput = new KlSliderManualInput(
            valueToDisplayValue(this.config, this.value),
            valueToDisplayValue(this.config, this.config.min),
            valueToDisplayValue(this.config, this.config.max),
            this.sliderWrapperEl.getBoundingClientRect(),
            (displayValue) => {
                this.setValue(displayValueToValue(this.config, displayValue));
                this.onChange(this.value);
            },
            () => {
                css(this.sliderWrapperEl, {
                    display: '',
                });
                if (this.manualInput) {
                    this.manualInput.getElement().remove();
                    this.manualInput.destroy();
                }
                this.manualInput = undefined;
            },
            getMaxDecimals(this.config),
        );
        this.rootEl.append(this.manualInput.getElement());
        setTimeout(() => {
            this.manualInput && this.manualInput.focus();
        });
        css(this.sliderWrapperEl, {
            display: 'none',
        });
    }

    // ----------------------------------- public -----------------------------------

    constructor(
        p: TKlSliderConfig & {
            label: string;
            width: number; // px
            height: number; // px
            value: number;
            onChange?: (val: number) => void;
            eventResMs?: number; // frequency of change events
        },
    ) {
        if (p.min >= p.max) {
            throw new Error('KlSlider broken params');
        }

        this.config = {
            min: p.min,
            max: p.max,
            exponent: p.exponent,
            displayScale: p.displayScale,
            decimals: p.decimals,
            unit: p.unit,
        };
        this.isEnabled = !p.isDisabled;
        this.value = BB.clamp(p.value, p.min, p.max);
        this.elementWidth = p.width;
        this.elementHeight = p.height;
        this.onChange = p.onChange ? p.onChange : () => {};
        this.eventResMs = p.eventResMs;

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
                width: this.elementWidth,
                height: this.elementHeight,
                userSelect: 'none',
            },
        });
        this.rootEl.oncontextmenu = function () {
            return false;
        };
        this.label = p.label;
        const labelFontSize = this.elementHeight - 14;
        this.labelValueEl = BB.el({
            css: { fontWeight: 'bold' },
        });
        this.textEl = BB.el({
            content: [
                BB.el({
                    content: this.label,
                    css: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    },
                }),
                this.labelValueEl,
            ],
            css: {
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                padding: '0 7px',
                height: '100%',
                width: '100%',
                fontSize: labelFontSize,
                pointerEvents: 'none',
                gap: 8,
            },
        });
        this.control = BB.el({
            className: 'slider-inner',
            css: {
                position: 'absolute',
                left: 0,
                top: 0,
                width: valueToSliderValue(this.config, this.value) * this.elementWidth,
                height: this.elementHeight,
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
            chainArr: [doubleTapper as TChainElement],
        });

        let virtualVal: number;
        const onPointer = (event: TPointerEvent) => {
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
                    this.value = sliderValueToValue(this.config, sliderValue);
                    this.updateLabel();
                    this.emit(false);
                }
                virtualVal = valueToSliderValue(this.config, this.value);
            }

            if (event.type === 'pointermove' && ['left', 'right'].includes(event.button || '')) {
                let deltaX = event.dX;
                const deltaY = Math.abs(event.pageY - (event.downPageY || 0));
                const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');
                deltaX *= factor;
                deltaX /= this.elementWidth;

                virtualVal += deltaX;

                const sliderValue = Math.max(0, Math.min(1, virtualVal));
                this.value = sliderValueToValue(this.config, sliderValue);
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
                    event.event?.preventDefault();
                    let sliderValue = valueToSliderValue(this.config, this.value);
                    sliderValue = BB.clamp(sliderValue - event.deltaY / 40, 0, 1);
                    this.value = sliderValueToValue(this.config, sliderValue);
                    this.updateLabel();
                    this.onChange(this.value);
                },
                useDirtyWheel: true,
            });
            this.updateLabel();
        }, 1);
    }

    changeSliderValue(f: number): void {
        if (!this.isEnabled) {
            return;
        }
        let sliderValue = valueToSliderValue(this.config, this.value);
        sliderValue = BB.clamp(sliderValue + f, 0, 1);
        this.value = sliderValueToValue(this.config, sliderValue);
        this.updateLabel();
        this.onChange(this.value);
    }

    setValue(v: number): void {
        this.value = BB.clamp(v, this.config.min, this.config.max);
        this.updateLabel();
    }

    getValue(): number {
        return this.value;
    }

    getDisplayValue(): number {
        return valueToDisplayValue(this.config, this.value);
    }

    update(config: TKlSliderConfig): void {
        this.config = config;
        this.setIsEnabled(!config.isDisabled);
        this.setValue(this.value);
    }

    setIsEnabled(e: boolean): void {
        this.isEnabled = e;
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
