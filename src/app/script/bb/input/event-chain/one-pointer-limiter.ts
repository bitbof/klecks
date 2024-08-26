import { TChainOutFunc } from './event-chain.types';
import { IPointerEvent } from '../event.types';

/**
 * only lets through events from one pointer at a time.
 *
 * in IPointerEvent
 * out IPointerEvent
 */
export class OnePointerLimiter {
    private chainOut: TChainOutFunc | undefined;
    private downPointerId: number | null = null;
    private readonly ignorePointerIdArr: number[] = [];

    // ----------------------------------- public -----------------------------------
    chainIn(event: IPointerEvent): IPointerEvent | null {
        if (this.ignorePointerIdArr.includes(event.pointerId)) {
            if (event.type === 'pointerup') {
                for (let i = 0; i < this.ignorePointerIdArr.length; i++) {
                    if (this.ignorePointerIdArr[i] === event.pointerId) {
                        this.ignorePointerIdArr.splice(i, 1);
                        break;
                    }
                }
            }
            return null;
        }

        if (this.downPointerId === null) {
            if (event.type === 'pointerdown') {
                this.downPointerId = event.pointerId;
            }
            return event;
        } else {
            if (event.pointerId !== this.downPointerId) {
                if (event.type === 'pointerdown') {
                    this.ignorePointerIdArr.push(event.pointerId);
                }
                return null;
            }
            if (event.type === 'pointerup') {
                this.downPointerId = null;
            }
            return event;
        }
    }

    setChainOut(func: TChainOutFunc): void {
        this.chainOut = func;
    }
}
