import { BB } from '../../../../bb/bb';
import { IVector2D } from '../../../../bb/bb-types';
import { IPointerEvent } from '../../../../bb/input/event.types';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { TEaselInterface, TEaselTool } from '../easel.types';
import { CornerPanning } from '../corner-panning';

export type tEaselShapeParams = {
    onDown: (p: IVector2D, angleRad: number) => void;
    onMove: (p: IVector2D) => void;
    onUp: (p: IVector2D) => void;
};

export class EaselShape implements TEaselTool {
    private readonly svgEl: SVGElement;
    private readonly onDown: tEaselShapeParams['onDown'];
    private readonly onMove: tEaselShapeParams['onMove'];
    private readonly onUp: tEaselShapeParams['onUp'];
    private easel: TEaselInterface = {} as TEaselInterface;
    private isDragging: boolean = false;
    private cornerPanning: CornerPanning;

    // ----------------------------------- public -----------------------------------
    constructor(p: tEaselShapeParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.onDown = p.onDown;
        this.onMove = p.onMove;
        this.onUp = p.onUp;

        this.cornerPanning = new CornerPanning({
            getEaselSize: () => this.easel.getSize(),
            getTransform: () => this.easel.getTargetTransform(),
            setTransform: (transform) => this.easel.setTransform(transform, true),
            testCanPan: (buttonIsPressed) => {
                return buttonIsPressed;
            },
            onRepeatEvent: (e) => {
                this.onPointer(e, true);
            },
        });
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent, isRepeat?: boolean): void {
        if (!isRepeat) {
            this.cornerPanning.onPointer(e);
        }

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
