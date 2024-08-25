import { IPointerEvent } from '../event.types';
import { copyObj } from '../../base/base';

export interface ICoalescedPointerEvent extends IPointerEvent {
    isCoalesced: boolean;
}

/**
 * A ChainElement. Splits up coalesced events into their own pointermove events. Otherwise regular pass through.
 *
 * in: IPointerEvent
 * out: IPointerEvent with property isCoalesced: boolean
 *
 * todo: eventPreventDefault and eventStopPropagation are broken events w coalesced events. (because of json parse json stringify)
 * but how could that even work?
 */
export class CoalescedExploder {
    private chainOut: ((e: ICoalescedPointerEvent) => void) | undefined;

    // ----------------------------------- public -----------------------------------

    setChainOut(func: (e: ICoalescedPointerEvent) => void) {
        this.chainOut = func;
    }

    chainIn(event: IPointerEvent): IPointerEvent | null {
        if (event.type === 'pointermove') {
            if (event.coalescedArr && event.coalescedArr.length > 0) {
                for (let i = 0; i < event.coalescedArr.length; i++) {
                    const eventCopy: ICoalescedPointerEvent = copyObj(
                        event,
                    ) as ICoalescedPointerEvent;
                    if (i === 0) {
                        eventCopy.coalescedArr = [];
                    }
                    const coalescedItem = event.coalescedArr[i];

                    eventCopy.pageX = coalescedItem.pageX;
                    eventCopy.pageY = coalescedItem.pageY;
                    eventCopy.relX = coalescedItem.relX;
                    eventCopy.relY = coalescedItem.relY;
                    eventCopy.dX = coalescedItem.dX;
                    eventCopy.dY = coalescedItem.dY;
                    eventCopy.time = coalescedItem.time;
                    eventCopy.isCoalesced = i < event.coalescedArr.length - 1;

                    this.chainOut && this.chainOut(eventCopy);
                }
            } else {
                return event;
            }
        } else {
            return event;
        }

        return null;
    }
}
