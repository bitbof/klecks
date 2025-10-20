import { TDrawEvent } from '../kl-types';
import { TSanitizedDrawEvent } from './kl-event-recorder';


// Draw-points are rounded to an integer in order to save memory and bandwidth, and also because you
// can not draw more precise than 1x1px. Precision, Scale and other values are rounded to 3 decimals.
const r0 = Math.round;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export class KlChainRecorder {
    private chainOut: ((event: TDrawEvent) => void) | undefined;
    private onLineEnded: ((drawEventCache: TSanitizedDrawEvent[]) => void) | undefined;
    private drawEventCache: TSanitizedDrawEvent[] = [];

    // ----------------------------------- public -----------------------------------
    constructor(onLineEnded?: (drawEventCache: TSanitizedDrawEvent[]) => void) {
        this.onLineEnded = onLineEnded;
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        const event2 = this.sanitizeEvent(event);
        if (event2) {
            this.drawEventCache.push(event2);
        }

        if (event.type == 'up') {
            // Line ended
            this.onLineEnded && this.onLineEnded(this.drawEventCache);
            this.drawEventCache = [];
        } else if (event.type == 'line') {
            // Simple line drawn
            this.onLineEnded && this.onLineEnded(this.drawEventCache);
            this.drawEventCache = [];
        }

        return event;
    }

    setChainOut(func: (event: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    sanitizeEvent(event: TDrawEvent): TSanitizedDrawEvent | null {
        // Some adjustments to save memory

        // Remove coalesced events because they only add minor details
        if ('isCoalesced' in event && event.isCoalesced) {
            return null;
        }

        if (event.type == 'down') {
            return (event.shiftIsPressed ? 'D' : 'd') +
                `${r0(event.x)}|${r0(event.y)}|${r3(event.pressure)}@${r3(event.scale)}`;
        }
        if (event.type == 'move') {
            return (event.shiftIsPressed ? 'M' : 'm') +
                `${r0(event.x)}|${r0(event.y)}|${r3(event.pressure)}@${r3(event.scale)}`;
        }
        if (event.type == 'up') {
            return (event.shiftIsPressed ? 'U' : 'u') +
                `@${r3(event.scale)}`;
        }
        if (event.type == 'line') {
            return 'L' +
                `${event.x0 !== null ? r0(event.x0) : 'x'}|${event.y0 !== null ? r0(event.y0) : 'x'}|${event.pressure0 !== null ? r3(event.pressure0) : 'x'}` +
                `-${r0(event.x1)}|${r0(event.y1)}|${r3(event.pressure1)}`;
        }

        // unknown event type
        return null;
    }

}
