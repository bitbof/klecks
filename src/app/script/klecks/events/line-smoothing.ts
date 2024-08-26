import { BB } from '../../bb/bb';
import { IDrawMoveEvent, TDrawEvent } from '../kl-types';

/**
 * Line smoothing. EventChain element. Smoothing via blending new position with old position.
 * for onDraw events from KlCanvasWorkspace.
 *
 * in some draw event
 * out some draw event
 *
 * type: 'line' Events are just passed through.
 */
export class LineSmoothing {
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
    constructor(p: {
        smoothing: number; // 0-1, 0: no smoothing, 1: 100% smoothing -> would never catch up
    }) {
        this.smoothing = BB.clamp(p.smoothing, 0, 1);
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        event = BB.copyObj(event);
        this.timeout && clearTimeout(this.timeout);
        this.interval && clearInterval(this.interval);

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
                        event = JSON.parse(JSON.stringify(event)) as IDrawMoveEvent;

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

                        this.chainOut && this.chainOut(event);
                    }, 35);
                }, 80);
            }
        }

        return event;
    }

    setChainOut(func: (drawEvent: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    setSmoothing(s: number): void {
        this.smoothing = BB.clamp(s, 0, 1);
    }
}
