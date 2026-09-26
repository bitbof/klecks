import { TLineSmoothingSettings } from '../events/line-smoothing';

/**
 * from stabilizer dropdown value to line-smoothing settings
 */
export function translateSmoothing(s: number): TLineSmoothingSettings {
    const smoothed = (smoothing: number): TLineSmoothingSettings => ({
        smoothing,
        addedPoints: 6,
        passes: 4,
        // stronger stabilizers trail far behind the pen. finishing would draw a long tail after lifting.
        finishOnUp: s <= 2,
    });
    if (s === 0.5) {
        return smoothed(0.3);
    }
    if (s === 1) {
        return smoothed(0.6);
    }
    if (s === 1.5) {
        return smoothed(0.7);
    }
    // lag in events: smoothing / (1 - smoothing). Higher levels trail progressively farther behind.
    if (s === 2) {
        return smoothed(1 - 0.16);
    }
    if (s === 3) {
        return smoothed(1 - 0.08);
    }
    if (s === 4) {
        return smoothed(1 - 0.05);
    }
    if (s === 5) {
        return smoothed(1 - 0.015);
    }
    return { smoothing: 0, addedPoints: 0, passes: 1, finishOnUp: false };
}
