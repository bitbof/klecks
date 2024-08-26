import { TChainOutFunc } from './event-chain.types';
import { dist } from '../../math/math';
import { IPointerEvent, TPointerButton, TPointerType } from '../event.types';

export interface IDoubleTapperEvent {
    pageX: number;
    pageY: number;
    relX: number;
    relY: number;
}

type TDoubleTapperTimeoutType = 'fail' | 'maxUntilSecondDown' | 'success';

/**
 * A ChainElement. Detects double taps.
 *
 * in IPointerEvent
 * out IPointerEvent
 */
export class DoubleTapper {
    private readonly onDoubleTap: (e: IDoubleTapperEvent) => void;
    private chainOut: TChainOutFunc | undefined;
    private allowedPointerTypeArr: TPointerType[] = ['touch', 'mouse', 'pen'];
    private allowedButtonArr: TPointerButton[] = ['left'];
    private minSilenceBeforeDurationMs: number = 400;
    private maxPressedDurationMs: number = 300;
    private maxPressedDistancePx: number = 10;
    private maxInbetweenDistancePx: number = 19;
    private maxUpToUpDurationMs: number = 500;
    private maxUntilSecondDownDurationMs: number = 300;
    private minSilenceAfterMs: number = 250;
    private sequenceArr: (
        | {
              isDown: boolean;
              time: number;
              position: [number, number];
              pointerId: number;
          }
        | {
              isUp: boolean;
              time: number;
              position: [number, number];
          }
        | {
              pageX: number;
              pageY: number;
              relX: number;
              relY: number;
          }
    )[] = [];
    private pointersDownIdArr: number[] = [];
    private lastUpTime: number = 0;
    private nowTime: number = 0;
    private eventQueueArr: IPointerEvent[] = [];
    private timeoutObj: {
        [K in TDoubleTapperTimeoutType]: ReturnType<typeof setTimeout> | null;
    } = {
        fail: null,
        maxUntilSecondDown: null,
        success: null,
    };
    private readonly gestureFailed: () => void;

    // double tap achieved
    private success(): void {
        this.timeoutObj.fail = null;
        this.timeoutObj.success = null;
        this.eventQueueArr = []; // events get swallowed
        const lastSequenceItem = this.sequenceArr[this.sequenceArr.length - 1];
        this.sequenceArr = [];
        if ('pageX' in lastSequenceItem) {
            this.onDoubleTap({
                pageX: lastSequenceItem.pageX,
                pageY: lastSequenceItem.pageY,
                relX: lastSequenceItem.relX,
                relY: lastSequenceItem.relY,
            });
        }
    }

    // returns false if time already up. otherwise sets up timeout
    private setupTimeout(
        timeoutStr: TDoubleTapperTimeoutType,
        targetFunc: () => void,
        timeMS: number,
        noComparison?: boolean,
    ): boolean {
        const diff = timeMS - this.nowTime;
        // console.log(fingers + ': ' + timeoutStr + ' diff', diff);
        if (diff <= 0 && !noComparison) {
            // time already up
            return false;
        }
        this.timeoutObj[timeoutStr] = setTimeout(targetFunc, Math.max(0, diff));
        return true;
    }

    /**
     * @param event object - a pointer event from BB.PointerListener
     */
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

        if (!this.allowedPointerTypeArr.includes(event.pointerType)) {
            //wrong input type -> fail
            //console.log('wrong input type -> fail');
            this.gestureFailed();
            return;
        }

        this.nowTime = performance.now();
        const lastSequenceItem =
            this.sequenceArr.length > 0 ? this.sequenceArr[this.sequenceArr.length - 1] : null;
        if (event.type === 'pointerup') {
            this.lastUpTime = event.time;
        }

        if (event.type === 'pointerdown') {
            if (this.pointersDownIdArr.length > 1) {
                // more than one pointer down -> fail
                //console.log('more than one pointer down -> fail');
                this.gestureFailed();
                return;
            }
            if (this.timeoutObj.success !== null) {
                // silence-after not achieved -> fail
                //console.log('silence-after not achieved -> fail');
                this.gestureFailed();
                return;
            }
            if (
                this.sequenceArr.length === 0 &&
                this.nowTime - this.lastUpTime < this.minSilenceBeforeDurationMs
            ) {
                // silence before not achieved -> fail
                //console.log('silence before not achieved -> fail');
                this.gestureFailed();
                return;
            }
            if (event.button && !this.allowedButtonArr.includes(event.button)) {
                // wrong button -> fail
                //console.log('wrong button -> fail', event.button, allowedButtonArr);
                this.gestureFailed();
                return;
            }
            if (
                (lastSequenceItem && 'isDown' in lastSequenceItem && lastSequenceItem.isDown) ||
                this.sequenceArr.length > 2
            ) {
                // jumbled -> fail
                //console.log('jumbled -> fail');
                this.gestureFailed();
                return;
            }
            if (lastSequenceItem && 'position' in lastSequenceItem) {
                const distance = dist(
                    lastSequenceItem.position[0],
                    lastSequenceItem.position[1],
                    event.pageX,
                    event.pageY,
                );
                if (distance > this.maxInbetweenDistancePx) {
                    //moved too much -> reset
                    //console.log('maxInbetweenDistancePx -> reset');
                    this.gestureFailed();

                    if (
                        'time' in lastSequenceItem &&
                        this.nowTime - lastSequenceItem.time < this.minSilenceBeforeDurationMs
                    ) {
                        //silence before not achieved -> fail
                        return;
                    }
                }
            }
            this.sequenceArr.push({
                isDown: true,
                time: this.nowTime,
                position: [event.pageX, event.pageY],
                pointerId: event.pointerId,
            });
            //maxUntilSecondDown

            if (this.sequenceArr.length > 1) {
                this.timeoutObj.maxUntilSecondDown &&
                    clearTimeout(this.timeoutObj.maxUntilSecondDown);
            } else if (
                !this.setupTimeout(
                    'maxUntilSecondDown',
                    () => this.gestureFailed(),
                    event.time + this.maxUntilSecondDownDurationMs,
                )
            ) {
                //console.log('event.time + maxPressedDurationMs -> fail');
                this.gestureFailed();
                return;
            }

            this.timeoutObj.fail && clearTimeout(this.timeoutObj.fail);
            if (
                !this.setupTimeout(
                    'fail',
                    () => this.gestureFailed(),
                    event.time + this.maxPressedDurationMs,
                )
            ) {
                //console.log('event.time + maxPressedDurationMs -> fail');
                this.gestureFailed();
                return;
            }
        }
        if (
            lastSequenceItem &&
            event.type === 'pointermove' &&
            'pointerId' in lastSequenceItem &&
            lastSequenceItem.pointerId === event.pointerId
        ) {
            /*if (lastSequenceItem.pointerId !== event.pointerId) { //another pointer mixing in -> fail
                console.log('another pointer mixing in -> fail');
                this.fail();
                return;
            }*/
            const distance = dist(
                lastSequenceItem.position[0],
                lastSequenceItem.position[1],
                event.pageX,
                event.pageY,
            );
            if (distance > this.maxPressedDistancePx) {
                //moved too much -> fail
                //console.log('maxPressedDistancePx -> fail');
                this.gestureFailed();
                return;
            }
        }
        if (lastSequenceItem && event.type === 'pointerup') {
            if ('pointerId' in lastSequenceItem && lastSequenceItem.pointerId !== event.pointerId) {
                //another pointer mixing in -> fail
                this.gestureFailed();
                return;
            }
            if (
                'time' in lastSequenceItem &&
                this.nowTime >= lastSequenceItem.time + this.maxPressedDurationMs
            ) {
                //pressed too long -> fail
                this.gestureFailed();
                return;
            }
            this.timeoutObj.fail && clearTimeout(this.timeoutObj.fail);

            if (this.sequenceArr.length < 3) {
                if (
                    !this.setupTimeout(
                        'fail',
                        () => this.gestureFailed(),
                        event.time + this.maxUpToUpDurationMs,
                    )
                ) {
                    this.gestureFailed();
                    return;
                }

                this.sequenceArr = [
                    lastSequenceItem,
                    {
                        isUp: true,
                        time: this.nowTime,
                        position: [event.pageX, event.pageY],
                    },
                ];
                return;
            }

            if (
                'time' in this.sequenceArr[1] &&
                this.nowTime < this.sequenceArr[1].time + this.maxUpToUpDurationMs
            ) {
                // double tap almost success
                // only needs silence
                this.sequenceArr.push({
                    pageX: event.pageX,
                    pageY: event.pageY,
                    relX: event.relX,
                    relY: event.relY,
                });
                if (
                    !this.setupTimeout(
                        'success',
                        () => this.success(),
                        event.time + this.minSilenceAfterMs,
                        true,
                    )
                ) {
                    this.gestureFailed();
                }
            } else {
                // time up -> fail
                this.gestureFailed();
            }
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        onDoubleTap: (e: IDoubleTapperEvent) => void; // fires when double tap occurs
        isInstant?: boolean;
    }) {
        this.onDoubleTap = p.onDoubleTap;
        if (p.isInstant) {
            this.minSilenceBeforeDurationMs = 0;
            this.minSilenceAfterMs = 0;
        }
        this.gestureFailed = () => {
            if (this.sequenceArr.length === 0) {
                // no gesture started -> can be ignored
                return;
            }
            this.timeoutObj.fail && clearTimeout(this.timeoutObj.fail);
            this.timeoutObj.maxUntilSecondDown && clearTimeout(this.timeoutObj.maxUntilSecondDown);
            this.timeoutObj.success && clearTimeout(this.timeoutObj.success);
            this.timeoutObj.fail = null;
            this.timeoutObj.maxUntilSecondDown = null;
            this.timeoutObj.success = null;

            if (this.chainOut) {
                for (let i = 0; i < this.eventQueueArr.length; i++) {
                    this.chainOut(this.eventQueueArr[i]);
                }
            }

            this.eventQueueArr = [];
            this.sequenceArr = [];
        };
    }

    chainIn(event: IPointerEvent): IPointerEvent | null {
        this.processEvent(event);

        if (this.sequenceArr.length === 0) {
            //existing events can not become a double tap
            this.gestureFailed();
            return event;
        }
        // events might become a double tap -> queue
        this.eventQueueArr.push(event);
        return null;
    }

    setChainOut(func: TChainOutFunc): void {
        this.chainOut = func;
    }

    setAllowedPointerTypeArr(arr: TPointerType[]): void {
        this.allowedPointerTypeArr = [...arr];
    }

    setAllowedButtonArr(arr: TPointerButton[]): void {
        this.allowedButtonArr = [...arr];
    }
}
