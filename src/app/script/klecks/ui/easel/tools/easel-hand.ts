import { BB } from '../../../../bb/bb';
import { IVector2D } from '../../../../bb/bb-types';
import { IPointerEvent, TPointerType } from '../../../../bb/input/event.types';
import { TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';
import { InertiaScrolling } from '../inertia-scrolling';

export type TEaselHandParams = {
    /* */
};

export class EaselHand implements TEaselTool {
    private readonly svgEl: SVGElement;
    private easel: TEaselInterface = {} as TEaselInterface;
    private inertiaScrolling: InertiaScrolling;

    // ----------------------------------- public -----------------------------------
    doubleTapPointerTypes: TPointerType[] = ['touch', 'mouse', 'pen'];
    tempTriggers: TEaselToolTrigger[] = ['space', 'mouse-middle'];

    constructor(p: TEaselHandParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.inertiaScrolling = new InertiaScrolling({
            getTransform: () => this.easel.getTransform(),
            setTransform: (transform) => this.easel.setTransform(transform, true),
        });
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent): void {
        this.easel.setCursor('grab');

        if (e.type === 'pointerdown' && ['left', 'middle'].includes(e.button!)) {
            this.inertiaScrolling.dragStart();
            this.easel.setCursor('grabbing');
        }
        if (e.type === 'pointermove' && ['left', 'middle'].includes(e.button!)) {
            const vTransform = { ...this.easel.getTransform() };
            vTransform.x += e.dX;
            vTransform.y += e.dY;
            this.easel.setTransform(vTransform, true);
            this.easel.requestRender();
            this.easel.setCursor('grabbing');
            this.inertiaScrolling.dragMove(e.dX, e.dY);
        }
        if (e.type === 'pointerup' && e.button === undefined) {
            this.inertiaScrolling.dragEnd();
        }
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    activate(cursorPos?: IVector2D): void {
        this.easel.setCursor('grab');
    }

    setUseInertiaScrolling(b: boolean): void {
        this.inertiaScrolling.setIsEnabled(b);
    }
}
