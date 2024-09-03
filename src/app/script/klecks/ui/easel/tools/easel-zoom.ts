import { BB } from '../../../../bb/bb';
import { IPointerEvent } from '../../../../bb/input/event.types';
import zoomEwImg from '/src/app/img/ui/cursor-zoom-ew.png';
import { IVector2D } from '../../../../bb/bb-types';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { applyToPoint, inverse } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { createTransform } from '../../../../bb/transform/create-transform';
import { TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';

export type TEaselZoomParams = {};

export class EaselZoom implements TEaselTool {
    private readonly svgEl: SVGElement;
    private easel: TEaselInterface = {} as TEaselInterface;
    private downPos: IVector2D | undefined = undefined;
    private downTransform: TViewportTransform | undefined;

    // ----------------------------------- public -----------------------------------
    tempTriggers: TEaselToolTrigger[] = ['z'];

    constructor(p: TEaselZoomParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent): void {
        this.easel.setCursor("url('" + zoomEwImg + "') 7 7, zoom-in");

        if (e.type === 'pointerdown' && ['left'].includes(e.button!)) {
            this.downPos = {
                x: e.relX,
                y: e.relY,
            };
            this.downTransform = BB.copyObj(this.easel.getTransform());
        }
        if (
            e.type === 'pointermove' &&
            ['left'].includes(e.button!) &&
            this.downPos &&
            this.downTransform
        ) {
            const viewportPoint = this.downPos;
            const mat = createMatrixFromTransform(this.downTransform);
            const canvasPoint = applyToPoint(inverse(mat), viewportPoint);
            const dX = e.relX - this.downPos.x;
            const newScale = BB.clamp(
                this.downTransform.scale * Math.pow(1 + 1 / 400, dX),
                this.easel.minScale,
                this.easel.maxScale,
            );
            this.easel.setTransform(
                createTransform(viewportPoint, canvasPoint, newScale, this.downTransform.angleDeg),
                true,
            );
            this.easel.requestRender();
        }
        if (e.type === 'pointerup' && e.button === undefined) {
            this.downPos = undefined;
            this.downTransform = undefined;
        }
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    activate(cursorPos?: IVector2D): void {
        this.easel.setCursor("url('" + zoomEwImg + "') 7 7, zoom-in");
    }
}
