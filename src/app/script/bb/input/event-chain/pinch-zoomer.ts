import { dist, pointsToAngleRad } from '../../math/math';
import { IPointerEvent } from '../event.types';

export type TPinchZoomerEvent =
    | { type: 'end' }
    | {
          type: 'move';

          downRelX: number;
          downRelY: number;
          relX: number;
          relY: number;

          angleRad: number;
          scale: number;
      };

type TTouchPointer = {
    pointerId: number;
    relX: number;
    relY: number;
    downRelX?: number; // only for first
    downRelY?: number;
};

type TPinchGesture = {
    touchPointerArr: TTouchPointer[];
    otherPointerIdArr: number[];
    isInProgress: boolean;
};

/**
 * A ChainElement. Detects a pinch zooming (2 touch pointers). If one finger lifts, then will use the remaining.
 * Further pointers are ignored, but their events get swallowed during the pinching.
 * pinching ends when ALL pointers are lifted.
 * Events passed through if no pinching.
 *
 * in IPointerEvent
 * out IPointerEvent
 */
export class PinchZoomer {
    private readonly firstFingerMaxDistancePx = 10;
    private readonly untilSecondFingerDurationMs = 250;

    private chainOut: ((e: IPointerEvent) => void) | undefined;
    private readonly pointersDownIdArr: number[] = [];
    private gestureObj: null | TPinchGesture = null;
    private eventQueueArr: IPointerEvent[] = [];
    private nowTime: number = performance.now();
    private readonly timeoutObj: {
        secondFingerTimeout: ReturnType<typeof setTimeout> | null;
    } = {
        secondFingerTimeout: null,
    };
    private pincherArr: {
        pointerId: number;
        relX: number;
        relY: number;
        downRelX: number;
        downRelY: number;
    }[] = [];
    private readonly onPinch: (e: TPinchZoomerEvent) => void;

    private end(): void {
        this.gestureObj = null;
        this.eventQueueArr = [];
    }

    private fail(doSwallow?: boolean): void {
        if (!this.gestureObj) {
            // no gesture happening -> ignore
            return;
        }

        this.timeoutObj.secondFingerTimeout && clearTimeout(this.timeoutObj.secondFingerTimeout);
        if (!doSwallow) {
            for (let i = 0; i < this.eventQueueArr.length; i++) {
                this.chainOut && this.chainOut(this.eventQueueArr[i]);
            }
        }
        this.end();
    }

    private setupFailTimeout(timeMS: number): boolean {
        const diff = timeMS - this.nowTime;
        if (diff <= 0) {
            // time already up
            return false;
        }
        this.timeoutObj.secondFingerTimeout = setTimeout(() => this.fail(), diff);
        return true;
    }

    private processEvent(event: IPointerEvent): void {
        if (event.type === 'pointerdown') {
            this.pointersDownIdArr.push(event.pointerId);
        } else if (event.type === 'pointerup') {
            for (let i = 0; i < this.pointersDownIdArr.length; i++) {
                if (this.pointersDownIdArr[i] === event.pointerId) {
                    this.pointersDownIdArr.splice(i, 1);
                    break;
                }
            }
        }

        //pass through scenarios
        if (
            !this.gestureObj &&
            (event.pointerType !== 'touch' || // wrong pointer type
                (event.type === 'pointermove' && this.pointersDownIdArr.length > 0) || // failed before
                this.pointersDownIdArr.length > 1 || // failed before
                event.type === 'pointerup') // failed before
        ) {
            return;
        }

        this.nowTime = performance.now();

        //pointer down
        if (event.type === 'pointerdown') {
            if (this.gestureObj) {
                if (event.pointerType === 'touch') {
                    // touch finger down - as nth pointer

                    this.gestureObj.touchPointerArr.push({
                        pointerId: event.pointerId,
                        relX: event.relX,
                        relY: event.relY,
                    });

                    if (this.gestureObj.isInProgress) {
                        this.continuePinch(this.gestureObj, {
                            type: 'down',
                            index: this.gestureObj.touchPointerArr.length - 1,
                        });
                    } else {
                        this.timeoutObj.secondFingerTimeout &&
                            clearTimeout(this.timeoutObj.secondFingerTimeout);
                        this.gestureObj.isInProgress = true;
                        this.beginPinch(this.gestureObj);
                    }
                    return;
                } else {
                    // non-touch finger down - as nth pointer

                    if (this.gestureObj.isInProgress) {
                        this.gestureObj.otherPointerIdArr.push(event.pointerId);
                    } else {
                        // second pointer wrong type -> fail
                        this.fail();
                    }
                    return;
                }
            } else {
                // first finger down - can only be touch if no gestureObj
                this.gestureObj = {
                    touchPointerArr: [
                        {
                            pointerId: event.pointerId,
                            relX: event.relX,
                            relY: event.relY,
                            downRelX: event.relX,
                            downRelY: event.relY,
                        },
                    ],
                    otherPointerIdArr: [],
                    isInProgress: false,
                };
                if (!this.setupFailTimeout(event.time + this.untilSecondFingerDurationMs)) {
                    // time ran out -> fail
                    this.fail();
                    return;
                }
                return;
            }
        }

        // should not happen. something went wrong
        if (!this.gestureObj) {
            // throw? would make it less robust
            this.fail();
            return;
        }

        //pointer move
        if (event.type === 'pointermove' && event.pointerType === 'touch') {
            //gesture object should always exist here

            let touchPointerObj: TTouchPointer | null = null;
            let i = 0;
            for (; i < this.gestureObj.touchPointerArr.length; i++) {
                if (event.pointerId === this.gestureObj.touchPointerArr[i].pointerId) {
                    touchPointerObj = this.gestureObj.touchPointerArr[i];
                    break;
                }
            }

            //null should not be possible. something went wrong
            if (!touchPointerObj) {
                // throw? would make it less robust
                this.fail();
                return;
            }

            touchPointerObj.relX = event.relX;
            touchPointerObj.relY = event.relY;

            if (!this.gestureObj.isInProgress) {
                // only one finger down & pinching hasn't started

                // should not happen. something went wrong
                if (
                    !('downRelX' in touchPointerObj && touchPointerObj.downRelX !== undefined) ||
                    !('downRelY' in touchPointerObj && touchPointerObj.downRelY !== undefined)
                ) {
                    this.fail();
                    return;
                }

                const distance = dist(
                    touchPointerObj.downRelX,
                    touchPointerObj.downRelY,
                    touchPointerObj.relX,
                    touchPointerObj.relY,
                );
                if (distance > this.firstFingerMaxDistancePx) {
                    // moved too much -> fail
                    this.fail();
                    return;
                }
            } else {
                if (i < 2) {
                    // only first two touches can affect pinching
                    this.continuePinch(this.gestureObj, {
                        type: 'move',
                        index: i,
                    });
                }
            }

            return;
        }

        //pointer up
        if (event.type === 'pointerup') {
            //gesture object should always exist here

            if (event.pointerType === 'touch') {
                let i = 0;
                for (; i < this.gestureObj.touchPointerArr.length; i++) {
                    if (this.gestureObj.touchPointerArr[i].pointerId === event.pointerId) {
                        this.gestureObj.touchPointerArr.splice(i, 1);
                        break;
                    }
                }
                if (this.gestureObj.touchPointerArr.length > 0) {
                    this.continuePinch(this.gestureObj, {
                        type: 'up',
                        index: i,
                    });
                }
            } else {
                // non-touch
                for (let i = 0; i < this.gestureObj.otherPointerIdArr.length; i++) {
                    if (this.gestureObj.otherPointerIdArr[i] === event.pointerId) {
                        this.gestureObj.otherPointerIdArr.splice(i, 1);
                        break;
                    }
                }
            }

            //all fingers lifted?
            if (
                this.gestureObj.touchPointerArr.length === 0 &&
                this.gestureObj.otherPointerIdArr.length === 0
            ) {
                if (this.gestureObj.isInProgress) {
                    // lifted last finger -> end of pinching
                    this.end();
                    this.endPinch();
                } else {
                    // lifted finger again before pinching started -> fail
                    this.fail();
                }
                return;
            }
        }
    }

    private beginPinch(gestureObj: TPinchGesture): void {
        for (let i = 0; i < gestureObj.touchPointerArr.length; i++) {
            const pointerObj = gestureObj.touchPointerArr[i];
            this.pincherArr.push({
                pointerId: pointerObj.pointerId,
                relX: pointerObj.relX,
                relY: pointerObj.relY,
                downRelX: pointerObj.relX,
                downRelY: pointerObj.relY,
            });
        }

        const event: TPinchZoomerEvent = {
            type: 'move',

            // temp
            downRelX: 0,
            downRelY: 0,
            relX: 0,
            relY: 0,

            angleRad: 0,
            scale: 1,
        };

        if (this.pincherArr.length === 1) {
            event.relX = this.pincherArr[0].downRelX;
            event.relY = this.pincherArr[0].downRelY;
        } else {
            event.relX = 0.5 * (this.pincherArr[0].downRelX + this.pincherArr[1].downRelX);
            event.relY = 0.5 * (this.pincherArr[0].downRelY + this.pincherArr[1].downRelY);
        }
        event.downRelX = event.relX;
        event.downRelY = event.relY;

        this.onPinch(event);
    }

    //actionObj = {type: 'down'|'move'|'up', index: number}
    private continuePinch(
        gestureObj: TPinchGesture,
        actionObj: {
            type: 'down' | 'move' | 'up';
            index: number;
        },
    ): void {
        if (actionObj.index > 1) {
            // only first two pointers matter
            return;
        }

        if (actionObj.type === 'move') {
            let event: TPinchZoomerEvent;
            this.pincherArr[actionObj.index].relX =
                gestureObj.touchPointerArr[actionObj.index].relX;
            this.pincherArr[actionObj.index].relY =
                gestureObj.touchPointerArr[actionObj.index].relY;

            if (this.pincherArr.length === 1) {
                event = {
                    type: 'move',
                    downRelX: this.pincherArr[0].downRelX,
                    downRelY: this.pincherArr[0].downRelY,
                    relX: this.pincherArr[0].relX,
                    relY: this.pincherArr[0].relY,
                    angleRad: 0,
                    scale: 1,
                };
            } else {
                const startDist = dist(
                    this.pincherArr[0].downRelX,
                    this.pincherArr[0].downRelY,
                    this.pincherArr[1].downRelX,
                    this.pincherArr[1].downRelY,
                );
                const distance = dist(
                    this.pincherArr[0].relX,
                    this.pincherArr[0].relY,
                    this.pincherArr[1].relX,
                    this.pincherArr[1].relY,
                );

                const startAngle = pointsToAngleRad(
                    {
                        x: this.pincherArr[0].downRelX,
                        y: this.pincherArr[0].downRelY,
                    },
                    {
                        x: this.pincherArr[1].downRelX,
                        y: this.pincherArr[1].downRelY,
                    },
                );
                const angle = pointsToAngleRad(
                    {
                        x: this.pincherArr[0].relX,
                        y: this.pincherArr[0].relY,
                    },
                    { x: this.pincherArr[1].relX, y: this.pincherArr[1].relY },
                );

                event = {
                    type: 'move',
                    downRelX: 0.5 * (this.pincherArr[0].downRelX + this.pincherArr[1].downRelX),
                    downRelY: 0.5 * (this.pincherArr[0].downRelY + this.pincherArr[1].downRelY),
                    relX: 0.5 * (this.pincherArr[0].relX + this.pincherArr[1].relX),
                    relY: 0.5 * (this.pincherArr[0].relY + this.pincherArr[1].relY),
                    angleRad: angle - startAngle,
                    scale: distance / startDist,
                };
            }

            this.onPinch(event);
        } else if (actionObj.type === 'down' || actionObj.type === 'up') {
            this.endPinch();
            this.beginPinch(gestureObj);
        }
    }

    private endPinch(): void {
        this.pincherArr = [];
        this.onPinch({
            type: 'end',
        });
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: { onPinch: (e: TPinchZoomerEvent) => void }) {
        this.onPinch = p.onPinch;
    }

    chainIn(event: IPointerEvent): IPointerEvent | null {
        this.processEvent(event);
        if (this.gestureObj) {
            if (!this.gestureObj.isInProgress) {
                // might still fail -> into queue
                this.eventQueueArr.push(event);
            }
        } else {
            return event;
        }
        return null;
    }

    setChainOut(func: (e: IPointerEvent) => void): void {
        this.chainOut = func;
    }
}
