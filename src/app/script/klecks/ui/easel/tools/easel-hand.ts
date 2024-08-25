import { BB } from '../../../../bb/bb';
import { IVector2D } from '../../../../bb/bb-types';
import { IPointerEvent, TPointerType } from '../../../../bb/input/event.types';
import { TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';

export type TEaselHandParams = {
    /* */
};

export class EaselHand implements TEaselTool {
    private readonly svgEl: SVGElement;
    private easel: TEaselInterface = {} as TEaselInterface;

    // ----------------------------------- public -----------------------------------
    doubleTapPointerTypes: TPointerType[] = ['touch', 'mouse', 'pen'];
    tempTriggers: TEaselToolTrigger[] = ['space', 'mouse-middle'];

    constructor(p: TEaselHandParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent): void {
        this.easel.setCursor('grab');

        if (e.type === 'pointerdown' && ['left', 'middle'].includes(e.button!)) {
            /* */
        }
        if (e.type === 'pointermove' && ['left', 'middle'].includes(e.button!)) {
            const vTransform = { ...this.easel.getTransform() };
            vTransform.x += e.dX;
            vTransform.y += e.dY;
            this.easel.setTransform(vTransform);
            this.easel.requestRender();
            this.easel.setCursor('grabbing');
        }
        if (e.type === 'pointerup' && e.button === undefined) {
            /* */
        }
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    activate(cursorPos?: IVector2D): void {
        this.easel.setCursor('grab');
    }
}
