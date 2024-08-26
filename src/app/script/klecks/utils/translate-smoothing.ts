/**
 * from stabilizer dropdown value to line-smoothing value
 * @param s
 */
export function translateSmoothing(s: number): number {
    if (s == 1) {
        return 1 - 0.5;
    }
    if (s == 2) {
        return 1 - 0.16;
    }
    if (s == 3) {
        return 1 - 0.035;
    }
    if (s == 4) {
        return 1 - 0.0175;
    }
    if (s == 5) {
        return 1 - 0.00875;
    }
    return s;
}
