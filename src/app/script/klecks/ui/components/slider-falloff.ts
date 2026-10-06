/**
 * To make sliders more fine-grained. The falloff when moving cursor away from the slider.
 * Returns the factor [0,1]
 *  0 -> infinite movement required for change of 1
 *  1 -> 1px movement for change of 1
 *
 * @param distance distance from pointerdown, perpendicular to slider direction
 * @param isRightButton
 */
export function calcSliderFalloffFactor(distance: number, isRightButton: boolean): number {
    let result = Math.min(10, 1 + Math.floor(distance / 50) ** 2);
    if (isRightButton) {
        result *= 2;
    }
    return 1 / result;
}
