import {BB} from '../../bb/bb';
import {IRGB} from '../kl-types';

/**
 * Overlay for KlCanvasWorkspace.
 * - brush circle
 * - eyedropper circle
 * - compass needle (rotation hud)
 */
export class WorkspaceSvgOverlay {
    private readonly rootElement: SVGElement;
    private readonly brushCircleOuter: SVGElement;
    private readonly brushCircleInner: SVGElement;
    private readonly pickerPreviewBorder: SVGElement;
    private readonly pickerPreviewCol: SVGElement;
    private readonly compassSize: number;
    private readonly compass: SVGElement;
    private readonly compassInner: SVGElement;
    private readonly compassBaseCircle: SVGElement;
    private readonly compassLineCircle: SVGElement;
    private readonly compassUpperTriangle: SVGElement;
    private readonly compassLowerTriangle: SVGElement;

    // ---- public ----

    constructor (
        p: {
            width: number;
            height: number;
        }
    ) {
        this.rootElement = BB.createSvg({
            elementType: 'svg',
            width: '' + p.width,
            height: '' + p.height,
        });
        BB.css(this.rootElement, {
            position: 'absolute',
            left: '0',
            top: '0',
            pointerEvents: 'none',
            userSelect: 'none',
        });

        //brush circles
        this.brushCircleOuter = BB.createSvg({
            elementType: 'circle',
            r: '10',
            stroke: 'rgba(0,0,0,0.7)',
            'stroke-width': '1',
            fill: 'none',
        });
        this.brushCircleInner = BB.createSvg({
            elementType: 'circle',
            r: '9',
            stroke: 'rgba(255,255,255,0.7)',
            'stroke-width': '1',
            fill: 'none',
        });
        this.rootElement.append(this.brushCircleOuter, this.brushCircleInner);

        //color picker preview circle
        this.pickerPreviewBorder = BB.createSvg({
            elementType: 'circle',
            r: '47',
            stroke: 'black',
            'stroke-width': '22',
            fill: 'none',
        });
        this.pickerPreviewBorder.style.opacity = '0';
        this.pickerPreviewCol = BB.createSvg({
            elementType: 'circle',
            r: '47',
            stroke: 'black',
            'stroke-width': '20',
            fill: 'none',
        });
        this.pickerPreviewCol.style.opacity = '0';
        this.rootElement.append(this.pickerPreviewBorder, this.pickerPreviewCol);


        //rotation compass
        this.compassSize = 30;
        this.compass = BB.createSvg({
            elementType: 'g',
            transform: 'translate(' + (p.width/2) + ', ' + (p.height/2) + ')',
        });
        BB.css(this.compass, {
            transition: 'opacity 0.25s ease-in-out',
            opacity: '0',
        });
        this.compassInner = BB.createSvg({
            elementType: 'g',
            transform: 'rotate(45)',
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
            r: '' + (this.compassSize * 0.9),
        });
        this.compassUpperTriangle = BB.createSvg({
            elementType: 'path',
            fill: '#f00',
            stroke: 'none',
            d: 'M -'+(this.compassSize * 0.25)+',0 '+(this.compassSize * 0.25)+',0 0,-'+(this.compassSize * 0.9)+' z',
        });
        this.compassLowerTriangle = BB.createSvg({
            elementType: 'path',
            fill: '#fff',
            stroke: 'none',
            d: 'M -'+(this.compassSize * 0.25)+',0 '+(this.compassSize * 0.25)+',0 0,'+(this.compassSize * 0.9)+' z',
        });

        this.compassInner.append(
            this.compassBaseCircle,
            this.compassLineCircle,
            this.compassUpperTriangle,
            this.compassLowerTriangle
        );
        this.compass.append(this.compassInner);
        this.rootElement.append(this.compass);
    }

    getElement (): SVGElement {
        return this.rootElement;
    }

    setSize (width: number, height: number): void {
        this.rootElement.setAttribute('width', '' + width);
        this.rootElement.setAttribute('height', '' + height);
        this.compass.setAttribute('transform', 'translate(' + (width/2) + ', ' + (height/2) + ')');
    }

    updateCursor (p: {
        x?: number;
        y?: number;
        radius?: number;
        isVisible?: boolean;
    }): void {
        if (p.x !== undefined) {
            this.brushCircleOuter.setAttribute('cx', '' + p.x);
            this.brushCircleInner.setAttribute('cx', '' + p.x);
        }
        if (p.y !== undefined) {
            this.brushCircleOuter.setAttribute('cy', '' + p.y);
            this.brushCircleInner.setAttribute('cy', '' + p.y);
        }
        if (p.radius !== undefined) {
            this.brushCircleOuter.setAttribute('r', '' + Math.max(0, p.radius));
            this.brushCircleInner.setAttribute('r', '' + Math.max(0, p.radius - 1));
        }
        if (p.isVisible !== undefined) {
            this.brushCircleOuter.style.opacity = p.isVisible ? '1' : '0';
            this.brushCircleInner.style.opacity = p.isVisible ? '1' : '0';
        }
    }

    updateColorPreview (p: {
        x?: number;
        y?: number;
        color?: IRGB;
        isVisible?: boolean;
    }): void {
        if (p.x !== undefined) {
            this.pickerPreviewCol.setAttribute('cx', '' + p.x);
            this.pickerPreviewBorder.setAttribute('cx', '' + p.x);
        }
        if (p.y !== undefined) {
            this.pickerPreviewCol.setAttribute('cy', '' + p.y);
            this.pickerPreviewBorder.setAttribute('cy', '' + p.y);
        }
        if (p.color) {
            this.pickerPreviewCol.setAttribute('stroke', BB.ColorConverter.toRgbStr(p.color));
            const borderColor = BB.testIsWhiteBestContrast(p.color) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
            this.pickerPreviewBorder.setAttribute('stroke', borderColor);
        }
        if (p.isVisible !== undefined) {
            this.pickerPreviewCol.style.opacity = p.isVisible ? '1' : '0';
            this.pickerPreviewBorder.style.opacity = p.isVisible ? '1' : '0';
        }
    }

    updateCompass (p: {
        angleDeg?: number;
        isVisible?: boolean;
    }): void {
        if (p.angleDeg !== undefined) {
            this.compassInner.setAttribute('transform', 'rotate(' + p.angleDeg + ')');
            this.compassLineCircle.style.opacity = p.angleDeg % 90 === 0 ? '1' : '0';
        }
        if (p.isVisible !== undefined) {
            this.compass.style.opacity = p.isVisible ? '1' : '0';
        }
    }

}
