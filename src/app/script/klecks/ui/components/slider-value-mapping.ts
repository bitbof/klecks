import { clamp, round } from '../../../bb/math/math';
import { TKlSliderConfig } from '../../kl-types';
import { LANGUAGE_STRINGS } from '../../../language/language';

/*
Shared by sliders, so the same config results in the same position and label.
Three types of values
- value - the actual value, what a slider is set to and what it emits
- displayValue - the number that the user sees, and enters via manual input
- sliderValue - the draggable position of the slider, 0 - 1
 */

export function valueToSliderValue(config: TKlSliderConfig, value: number): number {
    const t = clamp((value - config.min) / (config.max - config.min), 0, 1);
    return t ** (1 / (config.exponent ?? 1));
}

export function sliderValueToValue(config: TKlSliderConfig, sliderValue: number): number {
    const t = clamp(sliderValue, 0, 1) ** (config.exponent ?? 1);
    return config.min + t * (config.max - config.min);
}

export function valueToDisplayValue(config: TKlSliderConfig, value: number): number {
    return value * (config.displayScale ?? 1);
}

export function displayValueToValue(config: TKlSliderConfig, displayValue: number): number {
    return displayValue / (config.displayScale ?? 1);
}

/**
 * Most decimals a displayed value can have.
 */
export function getMaxDecimals(config: TKlSliderConfig): number {
    return config.decimals === 'adaptive' ? 1 : (config.decimals ?? 0);
}

export function formatSliderValue(config: TKlSliderConfig, value: number): string {
    const displayValue = valueToDisplayValue(config, value);
    const decimals =
        config.decimals === 'adaptive' ? (Math.abs(displayValue) < 10 ? 1 : 0) : (config.decimals ?? 0);
    return (
        round(displayValue, decimals).toLocaleString(LANGUAGE_STRINGS.getCode()) +
        (config.unit ?? '')
    );
}
