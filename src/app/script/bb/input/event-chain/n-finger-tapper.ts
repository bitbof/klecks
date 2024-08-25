import { dist } from '../../math/math';
import { IPointerEvent } from '../event.types';

/**
 * A ChainElement. Detects a single tap with N 'touch' pointers
 *
 * in IPointerEvent
 * out IPointerEvent
 */
export class NFingerTapper {
    private readonly minSilenceBeforeDurationMs = 50;
    private readonly maxTapMs = 500;
    private readonly maxFirstLastFingerDownMs = 250;
    private readonly maxPressedDistancePx = 12; //5 + fingers * 5;

    private chainOut: ((e: IPointerEvent) => void) | undefined;
    private fingerArr: {
        pointerId: number;
        downTimeMs: number;
        downPageX: number;
        downPageY: number;
        isUp?: boolean;
    }[] = [];
    private eventQueueArr: IPointerEvent[] = [];
    private firstDownTime: number = 0;
    private lastEventTime: number = 0;
    private nowTime: number = performance.now();
    private readonly pointersDownIdArr: number[] = [];
    private readonly fingers: number;
    private readonly onTap: () => void;
    private readonly timeoutObj: {
        firstLastDownTimeout: ReturnType<typeof setTimeout> | null;
        tapTimeout: ReturnType<typeof setTimeout> | null;
    } = {
        firstLastDownTimeout: null,
        tapTimeout: null,
    };

    private failGesture(): void {
        if (this.eventQueueArr.length === 0) {
            return;
        }
        this.timeoutObj.firstLastDownTimeout && clearTimeout(this.timeoutObj.firstLastDownTimeout);
        this.timeoutObj.tapTimeout && clearTimeout(this.timeoutObj.tapTimeout);
        for (let i = 0; i < this.eventQueueArr.length; i++) {
            this.chainOut && this.chainOut(this.eventQueueArr[i]);
        }
        this.eventQueueArr = [];
        this.fingerArr = [];
    }

    private success(): void {
        this.timeoutObj.firstLastDownTimeout && clearTimeout(this.timeoutObj.firstLastDownTimeout);
        this.timeoutObj.tapTimeout && clearTimeout(this.timeoutObj.tapTimeout);
        this.eventQueueArr = []; // events get swallowed
        this.fingerArr = [];
        this.onTap();
    }

    private setupTimeout(
        timeoutStr: 'firstLastDownTimeout' | 'tapTimeout',
        timeMS: number,
    ): boolean {
        const diff = timeMS - this.nowTime;
        //console.log(fingers + ': ' + timeoutStr + ' diff', diff);
        if (diff <= 0) {
            // time already up
            return false;
        }
        this.timeoutObj[timeoutStr] = setTimeout(() => this.failGesture(), diff);
        return true;
    }

    private processEvent(event: IPointerEvent): true | void {
        const tempLastEventTime = this.lastEventTime;
        this.lastEventTime = event.time;

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

        if (event.pointerType !== 'touch') {
            if (this.fingerArr.length > 0) {
                // already in gesture -> fail
                this.failGesture();
            }
            return;
        }

        this.nowTime = performance.now();

        if (event.type === 'pointerdown') {
            //console.log('down');
            if (this.fingerArr.length + 1 !== this.pointersDownIdArr.length) {
                // failed before, and some fingers are still down -> fail
                this.failGesture();
                return;
            }
            if (this.fingerArr.length === this.fingers) {
                // too many fingers down -> fail
                //console.log(fingers + ': too many fingers down -> fail');
                this.failGesture();
                return;
            }
            if (
                this.fingerArr.length > 0 &&
                event.time - this.maxFirstLastFingerDownMs > this.fingerArr[0].downTimeMs
            ) {
                // took too long to touch with all fingers -> fail
                //console.log(fingers + ': took too long to touch with all fingers -> fail');
                this.failGesture();
                return;
            }
            if (
                this.fingerArr.length === 0 &&
                event.time - this.minSilenceBeforeDurationMs < tempLastEventTime
            ) {
                // not enough silence before -> fail
                //console.log(fingers + ': not enough silence before -> fail');
                this.failGesture();
                return;
            }

            if (this.fingerArr.length === 0) {
                this.firstDownTime = event.time;

                if (
                    !this.setupTimeout(
                        'firstLastDownTimeout',
                        event.time + this.maxFirstLastFingerDownMs,
                    ) ||
                    !this.setupTimeout('tapTimeout', event.time + this.maxTapMs)
                ) {
                    // timeouts already up -> fail
                    this.failGesture();
                    return;
                }
            }
            this.fingerArr.push({
                pointerId: event.pointerId,
                downTimeMs: event.time,
                downPageX: event.pageX,
                downPageY: event.pageY,
            });
            return;
        }

        if (event.type === 'pointermove') {
            if (this.fingerArr.length === 0) {
                //not in a gesture -> ignore
                return;
            }

            let fingerObj = null;
            for (let i = 0; i < this.fingerArr.length; i++) {
                if (this.fingerArr[i].pointerId === event.pointerId) {
                    fingerObj = this.fingerArr[i];
                    break;
                }
            }
            if (fingerObj === null) {
                // finger not part of the tap is on screen -> fail
                this.failGesture();
                return;
            }

            if (event.time - this.maxTapMs > this.firstDownTime) {
                // tap took too long -> fail
                //console.log(fingers + ': tap took too long -> fail');
                this.failGesture();
                return;
            }

            const distance = dist(
                event.pageX,
                event.pageY,
                fingerObj.downPageX,
                fingerObj.downPageY,
            );
            if (distance > this.maxPressedDistancePx) {
                // finger moved too much -> fail
                //console.log(fingers + ': a finger moved too much -> fail', distance);
                this.failGesture();
                return;
            }
        }

        if (event.type === 'pointerup') {
            if (this.fingerArr.length === 0) {
                //not in a gesture -> ignore
                return;
            }

            //console.log('up', event.pageX, event.pageY);
            if (this.fingerArr.length !== this.fingers) {
                // not enough fingers -> fail
                //console.log(fingers + ': not enough fingers -> fail');
                this.failGesture();
                return;
            }

            let fingerObj = null;
            let i = 0;
            for (; i < this.fingerArr.length; i++) {
                if (this.fingerArr[i].pointerId === event.pointerId) {
                    fingerObj = this.fingerArr[i];
                    break;
                }
            }
            if (fingerObj === null) {
                //do nothing
                return;
            }

            if (event.time - this.maxTapMs > this.firstDownTime) {
                // tap took too long -> fail
                //console.log(fingers + ': tap took too long -> fail');
                this.failGesture();
                return;
            }

            const distance = dist(
                event.pageX,
                event.pageY,
                fingerObj.downPageX,
                fingerObj.downPageY,
            );
            if (distance > this.maxPressedDistancePx) {
                // finger moved too much -> fail
                //console.log(fingers + ': b finger moved too much -> fail', distance, event.pageX, event.pageY);
                //console.log(fingerArr);
                this.failGesture();
                return;
            }

            fingerObj.isUp = true;

            let allAreUp = true;
            for (let i = 0; i < this.fingerArr.length; i++) {
                if (!this.fingerArr[i].isUp) {
                    allAreUp = false;
                    break;
                }
            }
            //console.log('fingerArr', fingerArr);

            if (allAreUp) {
                // success
                this.success();
                return true;
            }
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: { fingers: number; onTap: () => void }) {
        this.fingers = p.fingers;
        this.onTap = p.onTap;
    }

    chainIn(event: IPointerEvent): IPointerEvent | null {
        const result = this.processEvent(event);

        //console.log(fingerArr.length);

        if (result === true) {
            //tap success -> event gets swallowed
            return null;
        }
        if (this.fingerArr.length === 0) {
            return event;
        } else {
            this.eventQueueArr.push(event);
        }

        return null;
    }

    setChainOut(func: (e: IPointerEvent) => void): void {
        this.chainOut = func;
    }
}
