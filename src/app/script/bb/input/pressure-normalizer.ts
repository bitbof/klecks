/**
 * Apple Pencil on iPad in Safari has two problems:
 * - You need to press the stylus very strong to reach 1.0 pressure, to the point where the screen starts discoloring
 * - Always fires the same pressure value on pointerdown
 *
 * This normalizer tries to fix that with a workaround.
 *
 * pressure range [0, 1]
 */
export class PressureNormalizer {
    private detectionComplete = false;
    private isApplePencil = false;

    // detection
    private initialPointerDownPressure = -1;
    private pointerDownPressureRepeatCount = 0;
    private pointerMoveHasDifferentPressure = false;

    // ----------------------------------- public -----------------------------------
    normalize(pressure: number, eventType?: string, pointerType?: string): number {
        if (pointerType === 'pen') {
            if (!this.detectionComplete) {
                if (eventType === 'pointerdown') {
                    if (this.initialPointerDownPressure === -1) {
                        this.initialPointerDownPressure = pressure;
                    } else if (this.initialPointerDownPressure === pressure) {
                        this.pointerDownPressureRepeatCount++;
                        if (
                            this.pointerDownPressureRepeatCount > 1 &&
                            this.pointerMoveHasDifferentPressure
                        ) {
                            this.detectionComplete = true;
                            this.isApplePencil = true;
                        }
                    } else {
                        this.detectionComplete = true;
                        this.isApplePencil = false;
                    }
                } else if (eventType === 'pointermove') {
                    if (this.initialPointerDownPressure !== pressure) {
                        this.pointerMoveHasDifferentPressure = true;
                    }
                }
            }

            if (this.detectionComplete && this.isApplePencil) {
                if (this.initialPointerDownPressure === pressure) {
                    return 0;
                }
                pressure = Math.min(2, pressure * 2);
            }
            return pressure;
        } else {
            return pressure;
        }
    }
}
