import { BB } from '../../../../bb/bb';
import { IVector2D } from '../../../../bb/bb-types';
import { IPointerEvent } from '../../../../bb/input/event.types';
import pickerImg from '/src/app/img/ui/cursor-picker.png';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';
import { IRGB } from '../../../kl-types';

export type TEaselEyedropperParams = {
    onPick: (p: IVector2D) => IRGB;
    onPickEnd: () => void;
};

export class EaselEyedropper implements TEaselTool {
    private readonly svgEl: SVGElement;
    private readonly onPick: TEaselEyedropperParams['onPick'];
    private readonly onPickEnd: TEaselEyedropperParams['onPickEnd'];
    private easel: TEaselInterface = {} as TEaselInterface;
    private isDragging: boolean = false;
    private previewBorder: SVGElement;
    private previewColor: SVGElement;

    // ----------------------------------- public -----------------------------------
    tempTriggers: TEaselToolTrigger[] = ['mouse-right', 'alt'];

    constructor(p: TEaselEyedropperParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.onPick = p.onPick;
        this.onPickEnd = p.onPickEnd;

        //color picker preview circle
        this.previewBorder = BB.createSvg({
            elementType: 'circle',
            r: '47',
            stroke: 'black',
            'stroke-width': '22',
            fill: 'none',
        });
        this.previewColor = BB.createSvg({
            elementType: 'circle',
            r: '47',
            stroke: 'black',
            'stroke-width': '20',
            fill: 'none',
        });
        this.svgEl.append(this.previewBorder, this.previewColor);
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent): void {
        this.easel.setCursor("url('" + pickerImg + "') 0 15, crosshair");
        const transform = this.easel.getTransform();
        const m = createMatrixFromTransform(transform);
        const p = applyToPoint(inverse(m), { x: e.relX, y: e.relY });

        let color: IRGB | undefined = undefined;
        let isDown = ['left', 'right'].includes(e.button!);
        if (isDown) {
            this.svgEl.setAttribute('transform', `translate(${e.relX},${e.relY})`);
            this.svgEl.style.opacity = '1';
        } else {
            this.svgEl.style.opacity = '0';
        }

        if (e.type === 'pointerdown' && isDown) {
            color = this.onPick(p);
            this.isDragging = true;
            isDown = true;
        }
        if (e.type === 'pointermove' && isDown) {
            color = this.onPick(p);
            isDown = true;
        }
        if (e.type === 'pointerup' && e.button === undefined && this.isDragging) {
            this.onPickEnd();
            this.isDragging = false;
        }
        if (color && isDown) {
            this.previewColor.setAttribute('stroke', BB.ColorConverter.toRgbStr(color));
            const borderColor = BB.testIsWhiteBestContrast(color)
                ? 'rgba(255,255,255,0.5)'
                : 'rgba(0,0,0,0.5)';
            this.previewBorder.setAttribute('stroke', borderColor);
        }
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    activate(cursorPos?: IVector2D): void {
        this.easel.setCursor("url('" + pickerImg + "') 0 15, crosshair");
        this.isDragging = false;
        this.svgEl.style.opacity = '0';
    }

    onPointerLeave(): void {
        if (this.isDragging) {
            return;
        }
        this.svgEl.style.opacity = '0';
    }
}
