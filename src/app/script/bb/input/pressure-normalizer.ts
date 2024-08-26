import { mix } from '../math/math';

/**
 * different devices/browsers have different pressure curves
 * pressure normalize attempts to achieve similar mapping
 *
 * pressure range [0, 1]
 */
export class PressureNormalizer {
    private count: number = 0;
    private avgPressure: number = 0; // float [0, 1]
    private normalizeIsComplete: boolean = false;
    private normalizeFactor: number = 1;

    // ----------------------------------- public -----------------------------------
    normalize(pressure: number): number {
        if (pressure === 0 || pressure === 1) {
            return pressure;
        }

        if (this.count < 60) {
            if (this.count === 0 || this.count === null) {
                this.avgPressure = pressure;
            } else {
                this.avgPressure = mix(pressure, this.avgPressure, 0.95);
            }
            this.count++;
        } else if (!this.normalizeIsComplete) {
            this.normalizeIsComplete = true;
            //BB.throwOut('avg pressure decision!' + this.avgPressure);
            if (this.avgPressure < 0.13) {
                // absurd pressure needed
                this.normalizeFactor = 2.3;
            }
        }

        return Math.pow(pressure, 1 / this.normalizeFactor);
    }
}
