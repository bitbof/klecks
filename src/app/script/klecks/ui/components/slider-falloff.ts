/**
 * To make sliders more fine-grained. The falloff when moving cursor away from cursor.
 * Returns the factor [0,1]
 *  0 -> infinite movement required for change of 1
 *  1 -> 1px movement for change of 1
 *
 * @param deltaY vertical distance from pointerdown
 * @param isRightButton
 */
export function calcSliderFalloffFactor(deltaY: number, isRightButton: boolean): number {
    let result = Math.min(10, 1 + Math.pow(Math.floor(deltaY / 50), 2));
    if (isRightButton) {
        result *= 2;
    }
    return 1 / result;
}
