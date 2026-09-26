import { BB } from '../../bb/bb';
import { TDrawEvent, TDrawMoveEvent } from '../kl-types';

/**
 * Pre-0.11.4 line smoothing. EventChain element.
 * Retained for the stronger stabilizer levels, whose long trailing response is intentional.
 */
export class LegacyLineSmoothing {
    private chainOut: ((drawEvent: TDrawEvent) => void) | undefined;
    private smoothing: number;
    private lastMixedInput:
        | {
              x: number;
              y: number;
              pressure: number;
          }
        | undefined;
    private interval: ReturnType<typeof setInterval> | undefined;
    private timeout: ReturnType<typeof setTimeout> | undefined;

    // ----------------------------------- public -----------------------------------
    constructor(smoothing: number) {
        this.smoothing = BB.clamp(smoothing, 0, 1);
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        event = BB.copyObj(event);
        clearTimeout(this.timeout);
        clearInterval(this.interval);

        if (event.type === 'down') {
            this.lastMixedInput = {
                x: event.x,
                y: event.y,
                pressure: event.pressure,
            };
        }

        if (event.type === 'move') {
            const inputX = event.x;
            const inputY = event.y;
            const inputPressure = event.pressure;

            event.x = BB.mix(event.x, this.lastMixedInput!.x, this.smoothing);
            event.y = BB.mix(event.y, this.lastMixedInput!.y, this.smoothing);
            event.pressure = BB.mix(event.pressure, this.lastMixedInput!.pressure, this.smoothing);
            this.lastMixedInput = {
                x: event.x,
                y: event.y,
                pressure: event.pressure,
            };

            if (this.smoothing > 0) {
                this.timeout = setTimeout(() => {
                    this.interval = setInterval(() => {
                        event = BB.copyObj(event) as TDrawMoveEvent;

                        event.x = BB.mix(inputX, this.lastMixedInput!.x, this.smoothing);
                        event.y = BB.mix(inputY, this.lastMixedInput!.y, this.smoothing);
                        event.pressure = BB.mix(
                            inputPressure,
                            this.lastMixedInput!.pressure,
                            this.smoothing,
                        );
                        this.lastMixedInput = {
                            x: event.x,
                            y: event.y,
                            pressure: event.pressure,
                        };

                        this.chainOut?.(event);
                    }, 35);
                }, 80);
            }
        }

        return event;
    }

    setChainOut(func: (drawEvent: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    setSmoothing(smoothing: number): void {
        this.smoothing = BB.clamp(smoothing, 0, 1);
    }
}
