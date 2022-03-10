

/**
 * to make sliders more finegrained.
 * @param deltaY number - how far pointer moved away vertically since down
 * @returns {number} the factor 0-1. 0 -> infinite movement for change of 1. 1 -> 1px for change of 1
 */
export const calcSliderFalloffFactor = function(deltaY, isRightButton) {
    let result = Math.min(10, 1 + Math.pow(Math.floor(deltaY / 50), 2));
    if (isRightButton) {
        result *= 2;
    }
    return 1 / result;
};
