import { BB } from '../../../../bb/bb';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { IVector2D } from '../../../../bb/bb-types';
import { setAttributes } from '../../../../bb/base/base';
import { applyToPoint, inverse } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';

export class BrushCursorPixelSquare {
    private readonly rootEl: SVGElement;

    // --------------------- public ------------------
    constructor() {
        this.rootEl = BB.createSvg({
            elementType: 'g',
            childrenArr: [
                {
                    elementType: 'path',
                    fill: 'none',
                    stroke: 'rgba(255,255,255,0.7)',
                    'stroke-width': '1',
                },
                {
                    elementType: 'path',
                    fill: 'none',
                    stroke: 'rgba(0,0,0,0.7)',
                    'stroke-width': '1',
                },
            ],
        });
    }

    update(transform: TViewportTransform, position: IVector2D, size: number): void {
        const mat = createMatrixFromTransform(transform);
        size = Math.round(size * 2) / 2;
        const width = Math.round(size * 2);
        const canvasCenter = applyToPoint(inverse(mat), position);
        canvasCenter.x =
            width % 2 === 0 ? Math.round(canvasCenter.x) : Math.floor(canvasCenter.x) + 0.5;
        canvasCenter.y =
            width % 2 === 0 ? Math.round(canvasCenter.y) : Math.floor(canvasCenter.y) + 0.5;

        {
            const canvasPoints: [number, number][] = [
                [canvasCenter.x - size, canvasCenter.y - size],
                [canvasCenter.x + size, canvasCenter.y - size],
                [canvasCenter.x + size, canvasCenter.y + size],
                [canvasCenter.x - size, canvasCenter.y + size],
                [canvasCenter.x - size, canvasCenter.y - size],
            ];
            const viewportPoints = canvasPoints.map((point) => {
                return applyToPoint(mat, point);
            });

            let path = 'M ';
            viewportPoints.forEach((point) => {
                path += point.join(',') + ' ';
            });
            setAttributes(this.rootEl.children[1] as Element, {
                d: path,
            });
        }
        {
            const viewport1px = 1 / transform.scale;
            const canvasPoints: [number, number][] = [
                [canvasCenter.x - size + viewport1px, canvasCenter.y - size + viewport1px],
                [canvasCenter.x + size - viewport1px, canvasCenter.y - size + viewport1px],
                [canvasCenter.x + size - viewport1px, canvasCenter.y + size - viewport1px],
                [canvasCenter.x - size + viewport1px, canvasCenter.y + size - viewport1px],
                [canvasCenter.x - size + viewport1px, canvasCenter.y - size + viewport1px],
            ];
            const viewportPoints = canvasPoints.map((point) => {
                return applyToPoint(mat, point);
            });

            let path = 'M ';
            viewportPoints.forEach((point) => {
                path += point.join(',') + ' ';
            });
            setAttributes(this.rootEl.firstChild as Element, {
                d: path,
            });
        }
    }

    getElement(): SVGElement {
        return this.rootEl;
    }
}
