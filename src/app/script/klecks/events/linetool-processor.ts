import {IDrawDownEvent, IDrawMoveEvent, IDrawUpEvent, TDrawEvent} from '../kl-types';
import {BB} from '../../bb/bb';

const DIR_X = 0;
const DIR_Y = 1;

/**
 * Not really and event chain element. but pretty similar.
 *
 * Processes draw input events. When shift held -> linetool
 * line events - what KlCanvasWorkspace passes onDraw(e)
 *
 * pass input in with process(drawEvent)
 *
 * modifies draw event to include such events:
 * {
 *     type: 'line',
 *     x0: null, // you have to fill that in
 *     y0: null, // you have to fill that in
 *     pressure0: null, // you have to fill that in
 *     x1: number,
 *     y1: number,
 *     pressure1: number
 * }
 */
export class LinetoolProcessor {

    private readonly onDraw: (drawEvent: TDrawEvent) => void;
    private downEvent: IDrawDownEvent | null = null;
    private eventQueue: (IDrawDownEvent | IDrawMoveEvent | IDrawUpEvent)[] = [];
    private direction: 0 | 1 | null = null;

    // --- public ---
    constructor (
        p : {
            onDraw: (drawEvent: TDrawEvent) => void;
        }
    ) {
        this.onDraw = p.onDraw;
    }

    process (event: IDrawDownEvent | IDrawMoveEvent | IDrawUpEvent): void {
        if (event.type === 'down') {
            this.downEvent = event;
            this.direction = null;

            if (event.shiftIsPressed) {

                this.onDraw({
                    type: 'line',
                    x0: null,
                    y0: null,
                    pressure0: null,
                    x1: event.x,
                    y1: event.y,
                    pressure1: event.pressure,
                });

                this.eventQueue.push(event);
                return;
            }

        }

        if (event.type === 'move' && this.downEvent) {

            if (event.shiftIsPressed) {

                if (this.direction === null) {
                    const dX = Math.abs(event.x - this.downEvent.x);
                    const dY = Math.abs(event.y - this.downEvent.y);

                    if (dX > 5 || dY > 5) {
                        this.direction = dX > dY ? DIR_X : DIR_Y;

                        for (let i = 0; i < this.eventQueue.length; i++) {
                            const e = this.eventQueue[i];
                            if (e.type !== 'up') {
                                if (this.direction === DIR_X) {
                                    e.y = this.downEvent.y;
                                } else {
                                    e.x = this.downEvent.x;
                                }
                            }
                            this.onDraw(BB.copyObj(e));
                        }
                        this.eventQueue = [];
                    }
                }

                if (this.direction === null) {
                    this.eventQueue.push(event);
                    return;
                }

                if (this.direction === DIR_X) {
                    event.y = this.downEvent.y;
                } else {
                    event.x = this.downEvent.x;
                }

            } else {
                if (this.eventQueue.length > 0) {
                    for (let i = 0; i < this.eventQueue.length; i++) {
                        this.onDraw(BB.copyObj(this.eventQueue[i]));
                    }
                    this.eventQueue = [];
                }
            }

        }

        if (event.type === 'up') {
            this.eventQueue = [];
            this.downEvent = null;
        }

        this.onDraw(BB.copyObj(event));
    }
}
