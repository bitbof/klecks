import { BB } from '../../../../bb/bb';
import { IVector2D } from '../../../../bb/bb-types';
import { IPointerEvent } from '../../../../bb/input/event.types';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { TEaselInterface, TEaselTool } from '../easel.types';

export type TEaselGradientParams = {
    onDown: (p: IVector2D, angleRad: number) => void;
    onMove: (p: IVector2D) => void;
    onUp: (p: IVector2D) => void;
};

export class EaselGradient implements TEaselTool {
    private readonly svgEl: SVGElement;
    private readonly onDown: TEaselGradientParams['onDown'];
    private readonly onMove: TEaselGradientParams['onMove'];
    private readonly onUp: TEaselGradientParams['onUp'];
    private easel: TEaselInterface = {} as TEaselInterface;
    private isDragging: boolean = false;

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselGradientParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.onDown = p.onDown;
        this.onMove = p.onMove;
        this.onUp = p.onUp;
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent): void {
        this.easel.setCursor('crosshair');
        const vTransform = this.easel.getTransform();
        const m = createMatrixFromTransform(vTransform);
        const p = applyToPoint(inverse(m), { x: e.relX, y: e.relY });

        if (e.type === 'pointerdown' && e.button === 'left') {
            this.onDown(p, (vTransform.angleDeg / 180) * Math.PI);
            this.isDragging = true;
        }
        if (e.type === 'pointermove' && e.button === 'left') {
            this.onMove(p);
        }
        if (e.type === 'pointerup' && e.button === undefined && this.isDragging) {
            this.onUp(p);
            this.isDragging = false;
        }
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    getIsLocked(): boolean {
        return this.isDragging;
    }

    activate(cursorPos?: IVector2D): void {
        this.easel.setCursor('crosshair');
        this.isDragging = false;
    }
}
