import { NFingerTapper } from '../../../bb/input/event-chain/n-finger-tapper';
import { DoubleTapper, IDoubleTapperEvent } from '../../../bb/input/event-chain/double-tapper';
import { PinchZoomer, TPinchZoomerEvent } from '../../../bb/input/event-chain/pinch-zoomer';
import { BB } from '../../../bb/bb';
import { EventChain } from '../../../bb/input/event-chain/event-chain';
import { IChainElement } from '../../../bb/input/event-chain/event-chain.types';
import { IPointerEvent, TPointerType } from '../../../bb/input/event.types';

export type TEaselPointerPreprocessor = {
    onChainOut: (e: IPointerEvent) => void;
    onDoubleTap: (e: IDoubleTapperEvent) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onPinch: (e: TPinchZoomerEvent) => void;
};

/**
 * lets pointer events go through an event chain,
 * which checks for double tapping and other gestures,
 * then filters to a single pointer
 */
export class EaselPointerPreprocessor {
    private readonly pointerEventChain: EventChain;
    private readonly twoFingerTap: NFingerTapper | undefined;
    private readonly threeFingerTap: NFingerTapper | undefined;
    private readonly mainDoubleTapper: DoubleTapper;
    private readonly middleDoubleTapper: DoubleTapper;
    private readonly pinchZoomer: PinchZoomer;

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselPointerPreprocessor) {
        const nFingerSubChain: IChainElement[] = [];
        if (p.onUndo) {
            this.twoFingerTap = new BB.NFingerTapper({
                fingers: 2,
                onTap: p.onUndo,
            });
            nFingerSubChain.push(this.twoFingerTap as IChainElement);
        }
        if (p.onRedo) {
            this.threeFingerTap = new BB.NFingerTapper({
                fingers: 3,
                onTap: p.onRedo,
            });
            nFingerSubChain.push(this.threeFingerTap as IChainElement);
        }
        this.mainDoubleTapper = new BB.DoubleTapper({ onDoubleTap: p.onDoubleTap });
        this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        this.middleDoubleTapper = new BB.DoubleTapper({ onDoubleTap: p.onDoubleTap });
        this.middleDoubleTapper.setAllowedButtonArr(['middle']);
        this.pinchZoomer = new BB.PinchZoomer({
            onPinch: p.onPinch,
        });

        this.pointerEventChain = new EventChain({
            chainArr: [
                ...nFingerSubChain,
                this.mainDoubleTapper as IChainElement,
                this.middleDoubleTapper as IChainElement,
                this.pinchZoomer as IChainElement,
                new BB.OnePointerLimiter() as IChainElement,
            ],
        });
        this.pointerEventChain.setChainOut(p.onChainOut);
    }

    chainIn(e: IPointerEvent): void {
        this.pointerEventChain.chainIn(e);
    }

    setDoubleTapPointerTypes(p: TPointerType[]): void {
        this.mainDoubleTapper.setAllowedPointerTypeArr(p);
    }

    destroy() {
        // todo
    }
}
