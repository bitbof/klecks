export interface IWheelCleanerEvent {
    deltaY: number;
    pageX: number;
    pageY: number;
    clientX: number;
    clientY: number;
}

const SEQUENCE_TIMEOUT_MS = 200;

/**
 * Filters wheel events. removes swipe scrolling and pinch scrolling that trackpads do. (as best as it can)
 * Normalizes regular scrolls.
 *
 * Why:
 * - trackpad scrolling is different from old school mouse scrolling
 * - but there is no way to learn from the browser if it's trackpad scrolling
 * - browsers don't even give access to the raw swiping or pinching movement, but some abstraction on top, making the scrolling
 *      continue an arbitrary amount, at an arbitrary scale
 * - each browser does this differently. So you can't offer a consistent/controlled experience
 *
 * - also trackpads are painful to draw with. So supporting a trackpad-based workflow makes not much sense.
 */
export class WheelCleaner {
    private readonly knownUnitArr: number[] = [100];
    private sequenceLength: number = 0;
    private sequenceUnit: null | number = null;
    private endSequenceTimeout: undefined | ReturnType<typeof setTimeout>;
    private toEmitDelta: null | number = null;
    private position: null | {
        pageX: number;
        pageY: number;
        clientX: number;
        clientY: number;
    } = null;

    private emit(delta: number): void {
        if (this.position === null || this.sequenceUnit === null) {
            return;
        }
        this.callback({
            deltaY: Math.round(delta / this.sequenceUnit),
            pageX: this.position.pageX,
            pageY: this.position.pageY,
            clientX: this.position.clientX,
            clientY: this.position.clientY,
        });
    }

    private endSequence(): void {
        if (this.toEmitDelta !== null) {
            this.emit(this.toEmitDelta);
            this.toEmitDelta = null;
        }
        if (this.sequenceUnit !== null && !this.knownUnitArr.includes(this.sequenceUnit)) {
            this.knownUnitArr.push(this.sequenceUnit);
        }
        this.sequenceLength = 0;
        this.sequenceUnit = null;
    }

    // ----------------------------------- public -----------------------------------

    constructor(private callback: (p: IWheelCleanerEvent) => void) {}

    process(event: WheelEvent): void {
        this.position = {
            pageX: event.pageX,
            pageY: event.pageY,
            clientX: event.clientX,
            clientY: event.clientY,
        };

        if (this.endSequenceTimeout) {
            clearTimeout(this.endSequenceTimeout);
        }
        this.endSequenceTimeout = setTimeout(() => this.endSequence(), SEQUENCE_TIMEOUT_MS);

        //prep delta
        let delta = event.deltaY;
        if ('deltaMode' in event && event.deltaMode === 1) {
            delta *= 100 / 3;
        }
        const absDelta = Math.abs(delta);

        //sequence begins
        if (this.sequenceLength === 0) {
            this.sequenceLength++;
            if (absDelta < 50) {
                //dirty - probably a swipe scroll or pinch scroll on trackpad
                return;
            }

            this.sequenceUnit = absDelta;
            if (this.knownUnitArr.includes(this.sequenceUnit)) {
                //we know this unit - emit right away
                this.emit(delta);
            } else {
                //unknown unit - wait until next event or sequence end, to have more certainty that it's clean
                this.toEmitDelta = delta;
            }
            return;
        }

        if (this.sequenceUnit === null) {
            //previously determined dirty sequence
            this.toEmitDelta = null;
            return;
        }

        //sequence continues
        if (absDelta === 0) {
            //ignore zero scroll
            return;
        }
        if (
            absDelta === this.sequenceUnit ||
            (absDelta / this.sequenceUnit) % 1 < 0.0001 // a multiple
        ) {
            //fine
        } else if ((this.sequenceUnit / absDelta) % 1 < 0.0001) {
            //unit was actually a multiple - update it
            this.sequenceUnit = absDelta;
        } else if (absDelta !== this.sequenceUnit) {
            //not clean - delta is varying - probably a swipe scroll or pinch scroll on trackpad
            this.sequenceUnit = null;
            this.toEmitDelta = null;
            return;
        }

        if (this.toEmitDelta !== null) {
            this.emit(this.toEmitDelta);
            this.toEmitDelta = null;
        }
        this.emit(delta);
    }
}
