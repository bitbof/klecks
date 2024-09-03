import { BB } from '../../../../bb/bb';
import { IPointerEvent } from '../../../../bb/input/event.types';
import { IVector2D } from '../../../../bb/bb-types';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { createTransform } from '../../../../bb/transform/create-transform';
import { TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';
import { minimizeAngleDeg } from '../../../../bb/math/math';

export type TEaselRotateParams = {
    /* */
};

export class EaselRotate implements TEaselTool {
    private readonly svgEl: SVGElement;
    private easel: TEaselInterface = {} as TEaselInterface;
    private downPos: IVector2D | undefined = undefined;
    private downTransform: TViewportTransform | undefined;

    private readonly compassSize: number;
    private readonly compass: SVGElement;
    private readonly compassInner: SVGElement;
    private readonly compassBaseCircle: SVGElement;
    private readonly compassLineCircle: SVGElement;
    private readonly compassUpperTriangle: SVGElement;
    private readonly compassLowerTriangle: SVGElement;
    private readonly needleWrapper: SVGElement;

    // ----------------------------------- public -----------------------------------
    tempTriggers: TEaselToolTrigger[] = ['r'];

    constructor(p: TEaselRotateParams) {
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });

        //rotation compass
        this.compassSize = 30;
        this.compass = BB.createSvg({
            elementType: 'g',
        });
        BB.css(this.compass, {
            transition: 'opacity 0.25s ease-in-out',
        });
        this.compassInner = BB.createSvg({
            elementType: 'g',
        });
        this.compassBaseCircle = BB.createSvg({
            elementType: 'circle',
            fill: 'rgba(0,0,0,0.9)',
            stroke: 'none',
            cx: '0',
            cy: '0',
            r: '' + this.compassSize,
        });
        this.compassLineCircle = BB.createSvg({
            elementType: 'circle',
            fill: 'none',
            stroke: 'rgba(255,255,255,0.75)',
            'stroke-width': '1',
            cx: '0',
            cy: '0',
            r: '' + this.compassSize * 0.9,
        });
        BB.css(this.compassLineCircle, {
            transition: 'opacity 0.1s ease-in-out',
        });
        this.needleWrapper = BB.createSvg({
            elementType: 'g',
            'transform-origin': '0 0',
        });
        this.compassUpperTriangle = BB.createSvg({
            elementType: 'path',
            fill: '#f00',
            stroke: 'none',
            d:
                'M -' +
                this.compassSize * 0.25 +
                ',0 ' +
                this.compassSize * 0.25 +
                ',0 0,-' +
                this.compassSize * 0.9 +
                ' z',
        });
        this.compassLowerTriangle = BB.createSvg({
            elementType: 'path',
            fill: '#fff',
            stroke: 'none',
            d:
                'M -' +
                this.compassSize * 0.25 +
                ',0 ' +
                this.compassSize * 0.25 +
                ',0 0,' +
                this.compassSize * 0.9 +
                ' z',
        });
        this.needleWrapper.append(this.compassUpperTriangle, this.compassLowerTriangle);

        this.compassInner.append(
            this.compassBaseCircle,
            this.compassLineCircle,
            this.needleWrapper,
        );
        this.compass.append(this.compassInner);
        this.svgEl.append(this.compass);
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent): void {
        this.easel.setCursor(e.button === 'left' ? 'grabbing' : 'grab');

        if (e.type === 'pointerdown' && e.button === 'left') {
            this.downPos = {
                x: e.relX,
                y: e.relY,
            };
            this.downTransform = BB.copyObj(this.easel.getTargetTransform());
        } else if (e.button === 'left' && this.downPos && this.downTransform) {
            const { width, height } = this.easel.getSize();

            const centerObj = {
                x: width / 2,
                y: height / 2,
            };

            const startAngleRad = BB.Vec2.angle(centerObj, this.downPos);
            const newAngleRad = BB.Vec2.angle(centerObj, {
                x: e.relX,
                y: e.relY,
            });
            const dAngleDeg = ((newAngleRad - startAngleRad) / Math.PI) * 180;
            let newAngleDeg = this.downTransform.angleDeg + dAngleDeg;
            if (this.easel.isKeyPressed('shift')) {
                newAngleDeg = Math.round(newAngleDeg / 45) * 45;
            }
            newAngleDeg = minimizeAngleDeg(newAngleDeg);

            //rotate transform
            const mat = createMatrixFromTransform(this.downTransform);
            const canvasPoint = applyToPoint(inverse(mat), centerObj);
            this.easel.setTransform(
                createTransform(centerObj, canvasPoint, this.downTransform.scale, newAngleDeg),
                !this.easel.isKeyPressed('shift'),
            );
            this.easel.requestRender();
        } else if (e.type === 'pointerup' && this.downPos) {
            this.downPos = undefined;
            this.downTransform = undefined;
        }
    }

    onUpdateTransform(transform: TViewportTransform): void {
        const targetTransform = this.easel.getTargetTransform();
        this.needleWrapper.setAttribute('transform', 'rotate(' + transform.angleDeg + ')');
        this.compassLineCircle.style.opacity = targetTransform.angleDeg % 90 === 0 ? '1' : '0';
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    activate(cursorPos?: IVector2D): void {
        this.easel.setCursor('grab');
        const { width, height } = this.easel.getSize();
        this.compass.setAttribute('transform', 'translate(' + width / 2 + ', ' + height / 2 + ')');
        this.onUpdateTransform(this.easel.getTransform());
    }

    onKeyDown(keyStr: string, event: KeyboardEvent, comboStr: string) {
        if (['r+left', 'r+right'].includes(comboStr)) {
            if (keyStr === 'left') {
                this.easel.setAngleDeg(-15, true);
            }
            if (keyStr === 'right') {
                this.easel.setAngleDeg(15, true);
            }
        }
        if (['r+up'].includes(comboStr)) {
            this.easel.setAngleDeg(0, false);
        }
    }

    onResize(width: number, height: number): void {
        this.compass.setAttribute('transform', 'translate(' + width / 2 + ', ' + height / 2 + ')');
    }
}
