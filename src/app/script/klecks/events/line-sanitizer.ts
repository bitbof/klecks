import { TDrawEvent } from '../kl-types';

/**
 * cleans up DrawEvents. More trustworthy events. EventChain element
 *
 * in some draw event?
 * out some draw event?
 *
 * that events can only go line this: down -> n x move -> up
 * so, sanitizes this: down, down, down. becomes only one down. the other downs are ignored/swallowed
 */
export class LineSanitizer {
    private chainOut: ((drawEvent: TDrawEvent) => void) | undefined;
    private isDrawing: boolean = false;

    // ----------------------------------- public -----------------------------------

    chainIn(event: TDrawEvent): TDrawEvent | null {
        if (event.type === 'down') {
            if (this.isDrawing) {
                //console.log('line sanitizer - down, but already drawing');
                this.chainOut &&
                    this.chainOut({
                        type: 'up',
                        scale: event.scale,
                        shiftIsPressed: event.shiftIsPressed,
                        isCoalesced: false,
                    });
            } else {
                this.isDrawing = true;
            }
        }
        if (!this.isDrawing && (event.type === 'move' || event.type === 'up')) {
            //console.log('line sanitizer - ' + event.type + ' but not drawing');
            return null;
        }

        if (event.type === 'up' && this.isDrawing) {
            this.isDrawing = false;
        }

        return event;
    }

    setChainOut(func: (drawEvent: TDrawEvent) => void): void {
        this.chainOut = func;
    }

    getIsDrawing(): boolean {
        return this.isDrawing;
    }
}
