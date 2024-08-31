import { IChainElement, TChainOutFunc } from './event-chain.types';
import { IPointerEvent } from '../event.types';

/**
 * for chaining event processing. useful for gestures (double tap, pinch zoom, max pointer filter).
 * each element in the chain might hold back the events, swallow them, transform them, or create new ones
 */
export class EventChain {
    private readonly chainArr: IChainElement[];
    private chainOut: TChainOutFunc | undefined;

    private continueChain(i: number, event: IPointerEvent): null {
        for (; i < this.chainArr.length; i++) {
            event = this.chainArr[i].chainIn(event);
            if (event === null) {
                return null;
            }
        }
        this.chainOut && this.chainOut(event);
        return null;
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: { chainArr: IChainElement[] }) {
        this.chainArr = p.chainArr;

        for (let i = 0; i < this.chainArr.length; i++) {
            ((i) => {
                this.chainArr[i].setChainOut((event: IPointerEvent) => {
                    this.continueChain(i + 1, event);
                });
            })(i);
        }
    }

    /**
     * feed an event into the chain
     */
    chainIn(event: IPointerEvent): null {
        return this.continueChain(0, event);
    }

    /**
     * func will be called when event has passed through the chain
     */
    setChainOut(func: TChainOutFunc): void {
        this.chainOut = func;
    }
}
