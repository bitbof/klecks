import { el, unfocusAnyInput } from '../../../bb/base/ui';
import { clamp } from '../../../bb/math/math';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { TPointerEvent } from '../../../bb/input/event.types';
import { TKlSliderConfig } from '../../kl-types';
import { calcSliderFalloffFactor } from '../components/slider-falloff';
import {
    formatSliderValue,
    sliderValueToValue,
    valueToSliderValue,
} from '../components/slider-value-mapping';
import * as classes from './mobile-slider.module.scss';

export type TMobileSliderParams = {
    title: string;
    config: TKlSliderConfig;
    value: number;
    onChange: (value: number) => void;
    hasCheckerboard?: boolean; // background of track
};

/**
 * Vertical slider for collapsed mobile UI. E.g. brush size.
 * Tap to set, drag up/down to change. Moving the pointer sideways gives finer control.
 */
export class MobileSlider {
    private readonly rootEl: HTMLElement;
    private readonly fillEl: HTMLElement;
    private readonly labelEl: HTMLElement;
    private readonly pointerListener: PointerListener;
    private readonly onChange: (value: number) => void;
    private config: TKlSliderConfig = { min: 0, max: 1 };
    private value: number;
    private isEnabled: boolean = true;

    private update(): void {
        this.labelEl.textContent = formatSliderValue(this.config, this.value);
        // fill is inset by 1px on each side
        const sliderValue = valueToSliderValue(this.config, this.value);
        this.fillEl.style.height = `calc(${sliderValue} * (100% - 2px))`;
    }

    private setFromSliderValue(sliderValue: number): void {
        this.value = sliderValueToValue(this.config, sliderValue);
        this.update();
        this.onChange(this.value);
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileSliderParams) {
        this.onChange = p.onChange;
        this.value = p.value;

        this.fillEl = el({ className: classes.fill });
        this.labelEl = el({ className: classes.label });
        this.rootEl = el({
            className: [classes.root, ...(p.hasCheckerboard ? [classes.checkerboard] : [])],
            title: p.title,
            content: [this.fillEl, this.labelEl],
        });
        this.rootEl.oncontextmenu = () => false;

        let height = 1;
        let virtualSliderValue = 0;
        const onPointer = (event: TPointerEvent): void => {
            event.eventPreventDefault();
            if (!this.isEnabled) {
                return;
            }
            if (event.type === 'pointerdown') {
                // preventDefault keeps focus where it was. E.g. a text input
                unfocusAnyInput();
                height = Math.max(1, this.rootEl.offsetHeight);
                this.rootEl.classList.add(classes.active);
                if (event.button === 'left') {
                    this.setFromSliderValue(1 - event.relY / height);
                }
                virtualSliderValue = valueToSliderValue(this.config, this.value);
            }
            if (event.type === 'pointermove' && ['left', 'right'].includes(event.button || '')) {
                const deltaX = Math.abs(event.pageX - (event.downPageX || 0));
                const factor = calcSliderFalloffFactor(deltaX, event.button === 'right');
                virtualSliderValue = clamp(virtualSliderValue - (event.dY * factor) / height, 0, 1);
                this.setFromSliderValue(virtualSliderValue);
            }
            if (event.type === 'pointerup') {
                this.rootEl.classList.remove(classes.active);
            }
        };

        this.pointerListener = new PointerListener({
            target: this.rootEl,
            fixScribble: true,
            onPointer,
            onWheel: (event) => {
                event.event?.preventDefault();
                if (!this.isEnabled) {
                    return;
                }
                this.setFromSliderValue(valueToSliderValue(this.config, this.value) - event.deltaY / 40);
            },
            useDirtyWheel: true,
        });

        this.setConfig(p.config);
    }

    setConfig(config: TKlSliderConfig): void {
        this.config = config;
        this.isEnabled = !config.isDisabled;
        this.rootEl.classList.toggle(classes.disabled, !this.isEnabled);
        this.value = clamp(this.value, config.min, config.max);
        this.update();
    }

    // doesn't emit
    setValue(value: number): void {
        this.value = clamp(value, this.config.min, this.config.max);
        this.update();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.pointerListener.destroy();
    }
}
