import { TDrawDownEvent, TDrawEvent, TDrawLine, TDrawMoveEvent, TDrawUpEvent } from '../kl-types';
import { TSanitizedDrawEvent } from './kl-event-types';


// Draw-points are rounded to an integer in order to save memory and bandwidth, and also because you
// can not draw more precise than 1x1px. Precision, Scale and other values are rounded to 3 decimals.
const r0 = Math.round;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * This Recorder-class lives in the Draw-Event Chain. It records all events that gets
 * passed through and also is able to re-emit previously recorded events onto the chain again.
 * Recorded events are translated into a memory-efficient string representation.
 *
 * An instance of this class should be created with KlEventRecorder.createChainRecorder()
 */
export class KlChainRecorder {
    private chainOut: ((event: TDrawEvent) => void) | undefined;
    private onLineEnded: ((drawEventCache: TSanitizedDrawEvent[]) => void) | undefined;
    private drawEventCache: TSanitizedDrawEvent[] = [];
    private isChainDisabled: boolean = false;

    // ----------------------------------- public -----------------------------------
    constructor(onLineEnded?: (drawEventCache: TSanitizedDrawEvent[]) => void) {
        this.onLineEnded = onLineEnded;
    }

    chainIn(event: TDrawEvent): TDrawEvent | null {
        if (this.isChainDisabled)
            return null; // While replaying animation is active, do not process new events

        const event2 = this.translateToStringRepresentation(event);
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

    private translateToStringRepresentation(event: TDrawEvent): TSanitizedDrawEvent | null {
        // Adjustments to save memory and bandwidth

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

    private translateStringToEvent(str: TSanitizedDrawEvent): TDrawEvent | null {
        const typeChar = str.charAt(0);
        if (typeChar == 'd' || typeChar == 'D') {
            const shiftIsPressed = typeChar == 'D';
            const [posPart, rest] = str.slice(1).split('@');
            const [xStr, yStr, pressureStr] = posPart.split('|');
            const scale = parseFloat(rest);
            return {
                type: 'down',
                x: parseInt(xStr),
                y: parseInt(yStr),
                pressure: parseFloat(pressureStr),
                scale: scale,
                shiftIsPressed: shiftIsPressed,
            } as TDrawDownEvent;
        }

        if (typeChar == 'm' || typeChar == 'M') {
            const shiftIsPressed = typeChar == 'M';
            const [posPart, rest] = str.slice(1).split('@');
            const [xStr, yStr, pressureStr] = posPart.split('|');
            const scale = parseFloat(rest);
            return {
                type: 'move',
                x: parseInt(xStr),
                y: parseInt(yStr),
                pressure: parseFloat(pressureStr),
                scale: scale,
                shiftIsPressed: shiftIsPressed,
            } as TDrawMoveEvent;
        }

        if (typeChar == 'u' || typeChar == 'U') {
            const shiftIsPressed = typeChar == 'U';
            const rest = str.slice(1).split('@')[1];
            const scale = parseFloat(rest);
            return {
                type: 'up',
                scale: scale,
                isCoalesced: false,
                shiftIsPressed: shiftIsPressed,
            } as TDrawUpEvent;
        }

        if (typeChar == 'L') {
            const linePart = str.slice(1);
            const [startPart, endPart] = linePart.split('-');
            const [x0Str, y0Str, pressure0Str] = startPart.split('|');
            const [x1Str, y1Str, pressure1Str] = endPart.split('|');
            return {
                type: 'line',
                x0: x0Str != 'x' ? parseInt(x0Str) : null,
                y0: y0Str != 'x' ? parseInt(y0Str) : null,
                pressure0: pressure0Str != 'x' ? parseFloat(pressure0Str) : null,
                x1: parseInt(x1Str),
                y1: parseInt(y1Str),
                pressure1: parseFloat(pressure1Str),
            } as TDrawLine;
        }

        return null;
    }

    emitReplayedEvent(drawEvents: TSanitizedDrawEvent[]) {
        if (!this.chainOut)
            return; // Chain disabled

        for (const ev of drawEvents) {
            const event = this.translateStringToEvent(ev);
            if (event) {
                this.chainOut(event);
            }
        }
    }

    /**
     * Disables chain processing, swallowing all incoming events and do not record anything.
     * Set this, while a replay animation is ongoing.
     */
    setChainDisabled(isDisabled: boolean) {
        this.isChainDisabled = isDisabled;
    }

}
