import { TDrawEvent } from '../kl-types';
import { LegacyLineSmoothing } from './legacy-line-smoothing';
import { LineSmoothing, TLineSmoothingSettings } from './line-smoothing';

type TSmoother = {
    chainIn: (event: TDrawEvent) => TDrawEvent | null;
    setChainOut: (func: (drawEvent: TDrawEvent) => void) => void;
};

/**
 * Selects the line-smoothing implementation and configuration for a stabilizer level.
 */
export class HybridLineSmoothing {
    private chainOut: ((drawEvent: TDrawEvent) => void) | undefined;
    private readonly lineSmoothing: LineSmoothing;
    private readonly legacyLineSmoothing: LegacyLineSmoothing;
    private activeSmoother: TSmoother;

    private getLineSmoothingSettings(level: number): TLineSmoothingSettings {
        const smoothed = (smoothing: number): TLineSmoothingSettings => ({
            smoothing,
            addedPoints: 6,
            passes: 4,
            finishOnUp: true,
        });
        if (level === 0.5) {
            return smoothed(0.3);
        }
        if (level === 1) {
            return smoothed(0.6);
        }
        if (level === 1.5) {
            return smoothed(0.7);
        }
        if (level === 2) {
            return smoothed(1 - 0.16);
        }
        return { smoothing: 0, addedPoints: 0, passes: 1, finishOnUp: false };
    }

    private getLegacySmoothing(level: number): number {
        if (level === 3) {
            return 1 - 0.035;
        }
        if (level === 4) {
            return 1 - 0.0175;
        }
        if (level === 5) {
            return 1 - 0.00875;
        }
        return 0;
    }

    // ----------------------------------- public -----------------------------------
    constructor(level: number) {
        this.lineSmoothing = new LineSmoothing(this.getLineSmoothingSettings(0));
        this.legacyLineSmoothing = new LegacyLineSmoothing(0);
        this.activeSmoother = this.lineSmoothing;
        this.lineSmoothing.setChainOut((event) => {
            if (this.activeSmoother === this.lineSmoothing) {
                this.chainOut?.(event);
            }
        });
        this.legacyLineSmoothing.setChainOut((event) => {
            if (this.activeSmoother === this.legacyLineSmoothing) {
                this.chainOut?.(event);
            }
        });
        this.setLevel(level);
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        return this.activeSmoother.chainIn(event);
    }

    setChainOut(func: (drawEvent: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    setLevel(level: number): void {
        const legacySmoothing = this.getLegacySmoothing(level);
        this.lineSmoothing.setSettings(this.getLineSmoothingSettings(level));
        this.legacyLineSmoothing.setSmoothing(legacySmoothing);
        this.activeSmoother = legacySmoothing > 0 ? this.legacyLineSmoothing : this.lineSmoothing;
    }
}
