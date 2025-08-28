import { BB } from '../../../../bb/bb';
import { TVector2D } from '../../../../bb/bb-types';
import { TPointerEvent } from '../../../../bb/input/event.types';
import fillImg from 'url:/src/app/img/ui/cursor-fill.png';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { TEaselInterface, TEaselTool } from '../easel.types';

export type TEaselPaintBucketParams = {
    onFill: (p: TVector2D) => void; // int position
};

export class EaselPaintBucket implements TEaselTool {
    private readonly svgEl: SVGElement;
    private readonly onFill: TEaselPaintBucketParams['onFill'];
    private easel: TEaselInterface = {} as TEaselInterface;

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselPaintBucketParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.onFill = p.onFill;
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: TPointerEvent): void {
        this.easel.setCursor("url('" + fillImg + "') 1 12, crosshair");
        const vTransform = this.easel.getTransform();
        const m = createMatrixFromTransform(vTransform);
        const p = applyToPoint(inverse(m), { x: e.relX, y: e.relY });

        if (e.type === 'pointerdown' && e.button === 'left') {
            this.onFill({
                x: Math.floor(p.x),
                y: Math.floor(p.y),
            });
        }
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    activate(cursorPos?: TVector2D): void {
        this.easel.setCursor("url('" + fillImg + "') 1 12, crosshair");
    }
}
