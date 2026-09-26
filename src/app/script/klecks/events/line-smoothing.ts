import { BB } from '../../bb/bb';
import { TDrawEvent, TDrawMoveEvent, TDrawUpEvent } from '../kl-types';

export type TLineSmoothingSettings = {
    // 0-1, 0: no smoothing. Lag on a straight line = smoothing / (1 - smoothing) events.
    smoothing: number;
    // points inserted between two input events, so the output isn't a polygon.
    addedPoints: number;
    // number of chained filters. More passes: follows shape more closely at the same lag, and rounder curves.
    passes: number;
    // on 'up', catch up to the last input, so the line ends where the pen ended.
    finishOnUp: boolean;
};

type TSample = {
    x: number;
    y: number;
    pressure: number;
};

/**
 * Line smoothing. EventChain element. for onDraw events from KlCanvasWorkspace.
 *
 * Exponential filter (dy/dt = (input - y) / tau), where the input moves linearly between events.
 * The filter's response to a linear input is solved exactly, so it can be sampled at any number of in-between
 * points (addedPoints) -> smooth curve instead of a polygon (C1 continuous, each extra pass +1).
 * Causal: each input event yields the curve up to that event. Optionally on 'up' the line is finished up to the
 * last input.
 *
 * in some draw event
 * out some draw event. Per move event: addedPoints + 1 move events.
 *
 * type: 'line' Events are just passed through.
 */
export class LineSmoothing {
    private chainOut: ((drawEvent: TDrawEvent) => void) | undefined;
    private settings: TLineSmoothingSettings;
    private lastInput: TSample | undefined;
    private stages: TSample[] = []; // filter state of each pass
    private interval: ReturnType<typeof setInterval> | undefined;
    private timeout: ReturnType<typeof setTimeout> | undefined;

    private sanitizeSettings(settings: TLineSmoothingSettings): TLineSmoothingSettings {
        return {
            smoothing: BB.clamp(settings.smoothing, 0, 0.999),
            addedPoints: Math.max(0, Math.round(settings.addedPoints)),
            passes: Math.max(1, Math.round(settings.passes)),
            finishOnUp: settings.finishOnUp,
        };
    }

    /**
     * Advances the filter by one event interval, with the input moving linearly from lastInput to input.
     * Returns output samples - one per sub-step.
     */
    private step(input: TSample): TSample[] {
        const from = this.lastInput!;
        const sub = this.settings.addedPoints + 1;
        const h = 1 / sub;
        const smoothing = this.settings.smoothing;
        const passTau = smoothing / (1 - smoothing) / this.stages.length;
        const decay = Math.exp(-h / passTau);
        const result: TSample[] = [];

        // y(h) = b - v * tau + (y(0) - a + v * tau) * e^(-h / tau), with input moving from a to b, v = (b - a) / h
        const filter = (y: number, a: number, b: number): number => {
            const vTau = ((b - a) / h) * passTau;
            return b - vTau + (y - a + vTau) * decay;
        };

        for (let i = 1; i <= sub; i++) {
            let inA: TSample = {
                x: BB.mix(from.x, input.x, (i - 1) / sub),
                y: BB.mix(from.y, input.y, (i - 1) / sub),
                pressure: BB.mix(from.pressure, input.pressure, (i - 1) / sub),
            };
            let inB: TSample = {
                x: BB.mix(from.x, input.x, i / sub),
                y: BB.mix(from.y, input.y, i / sub),
                pressure: BB.mix(from.pressure, input.pressure, i / sub),
            };
            // each pass is fed the previous pass' output, also treated as linear within the sub-step
            for (let s = 0; s < this.stages.length; s++) {
                const stage = this.stages[s];
                const before = { ...stage };
                stage.x = filter(stage.x, inA.x, inB.x);
                stage.y = filter(stage.y, inA.y, inB.y);
                stage.pressure = filter(stage.pressure, inA.pressure, inB.pressure);
                inA = before;
                inB = stage;
            }
            result.push({ ...this.stages.at(-1)! });
        }

        this.lastInput = { ...input };
        return result;
    }

    private hasCaughtUp(tolerance: number): boolean {
        const input = this.lastInput!;
        return this.stages.every(
            (stage) =>
                Math.abs(stage.x - input.x) < tolerance &&
                Math.abs(stage.y - input.y) < tolerance &&
                Math.abs(stage.pressure - input.pressure) < 0.001,
        );
    }

    /**
     * Pen lifted: output catches up to the last input, so the line ends where the pen ended.
     * Skips points that barely moved, to keep the event count low.
     */
    private finishLine(upEvent: TDrawUpEvent): void {
        const input = this.lastInput!;
        const emit = (sample: TSample, isCoalesced: boolean): void => {
            this.chainOut?.({
                type: 'move',
                scale: upEvent.scale,
                shiftIsPressed: upEvent.shiftIsPressed,
                isCoalesced,
                ...sample,
            });
        };

        let lastEmitted = { ...this.stages.at(-1)! };
        for (let i = 0; i < 10000 && !this.hasCaughtUp(0.5); i++) {
            this.step(input).forEach((sample) => {
                if (BB.dist(sample.x, sample.y, lastEmitted.x, lastEmitted.y) >= 2) {
                    emit(sample, true);
                    lastEmitted = sample;
                }
            });
        }
        if (lastEmitted.x !== input.x || lastEmitted.y !== input.y) {
            emit(input, false);
        }
    }

    private stopCatchUp(): void {
        clearTimeout(this.timeout);
        clearInterval(this.interval);
    }

    // ----------------------------------- public -----------------------------------
    constructor(settings: TLineSmoothingSettings) {
        this.settings = this.sanitizeSettings(settings);
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        event = BB.copyObj(event);
        this.stopCatchUp();

        if (event.type === 'down') {
            this.lastInput = {
                x: event.x,
                y: event.y,
                pressure: event.pressure,
            };
            this.stages = Array.from({ length: this.settings.passes }, () => ({
                ...this.lastInput!,
            }));
        }

        if (event.type === 'move') {
            if (this.settings.smoothing === 0) {
                this.lastInput = { x: event.x, y: event.y, pressure: event.pressure };
                this.stages = this.stages.map(() => ({ ...this.lastInput! }));
                return event;
            }

            const moveEvent: TDrawMoveEvent = event;
            const emit = (samples: TSample[], isCoalesced: boolean): void => {
                samples.forEach((sample, i) => {
                    this.chainOut?.({
                        ...moveEvent,
                        ...sample,
                        isCoalesced: isCoalesced || i < samples.length - 1,
                    });
                });
            };

            const samples = this.step({ x: event.x, y: event.y, pressure: event.pressure });
            const last = samples.pop()!;
            emit(samples, true);
            event.x = last.x;
            event.y = last.y;
            event.pressure = last.pressure;

            // pen rests -> input is held, output keeps catching up
            this.timeout = setTimeout(() => {
                this.interval = setInterval(() => {
                    emit(this.step(this.lastInput!), false);
                    if (this.hasCaughtUp(0.01)) {
                        this.stopCatchUp();
                    }
                }, 35);
            }, 80);
        }

        if (
            event.type === 'up' &&
            this.lastInput &&
            this.settings.smoothing > 0 &&
            this.settings.finishOnUp
        ) {
            this.finishLine(event);
        }

        return event;
    }

    setChainOut(func: (drawEvent: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    setSettings(settings: TLineSmoothingSettings): void {
        this.settings = this.sanitizeSettings(settings);
        // changed mid-line: continue from the current output
        const current = this.stages.at(-1);
        if (current) {
            this.stages = Array.from({ length: this.settings.passes }, () => ({ ...current }));
        }
    }
}
