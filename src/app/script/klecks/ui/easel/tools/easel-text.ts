import { BB } from '../../../../bb/bb';
import { TVector2D } from '../../../../bb/bb-types';
import { TPointerEvent } from '../../../../bb/input/event.types';
import textImg from 'url:/src/app/img/ui/cursor-text.png';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { TEaselInterface, TEaselTool } from '../easel.types';

export type TEaselTextParams = {
    onDown: (p: TVector2D, angleRad: number) => void;
};

export class EaselText implements TEaselTool {
    private readonly svgEl: SVGElement;
    private readonly onDown: TEaselTextParams['onDown'];
    private easel: TEaselInterface = {} as TEaselInterface;

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselTextParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.onDown = p.onDown;
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: TPointerEvent): void {
        this.easel.setCursor("url('" + textImg + "') 1 12, crosshair");
        const vTransform = this.easel.getTransform();
        const m = createMatrixFromTransform(vTransform);
        const p = applyToPoint(inverse(m), { x: e.relX, y: e.relY });

        if (e.type === 'pointerdown' && e.button === 'left') {
            this.onDown(p, (vTransform.angleDeg / 180) * Math.PI);
        }
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    activate(cursorPos?: TVector2D): void {
        this.easel.setCursor("url('" + textImg + "') 1 12, crosshair");
    }
}
