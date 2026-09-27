import { BB } from '../../../../bb/bb';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { TVector2D } from '../../../../bb/bb-types';
import { setAttributes } from '../../../../bb/base/base';
import { applyToPoint, inverse } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { TPixelBrushTip } from '../../../brushes/pixel-brush';
import { getPixelDiscHalfWidths } from '../../../brushes/pixel-brush-disc';

/**
 * Outline of a mask made of centered pixel rows, shrunk by inset.
 * x relative to center, y relative to top.
 */
function getOutline(halfWidths: number[], inset: number): [number, number][] {
    // right side, top to bottom
    const right: [number, number][] = [];
    halfWidths.forEach((halfWidth, y) => {
        const above = halfWidths[y - 1] ?? 0;
        const below = halfWidths[y + 1] ?? 0;
        if (halfWidth !== above) {
            right.push([halfWidth - inset, y + (halfWidth > above ? inset : -inset)]);
        }
        if (halfWidth !== below) {
            right.push([halfWidth - inset, y + 1 + (halfWidth > below ? -inset : inset)]);
        }
    });
    // left side is mirrored, bottom to top
    const left = right.map(([x, y]): [number, number] => [-x, y]).reverse();
    return [...right, ...left];
}

export class BrushCursorPixel {
    private readonly rootEl: SVGElement;
    private tip: TPixelBrushTip = 'round';

    // ----------------------------------- public -----------------------------------
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

    update(transform: TViewportTransform, position: TVector2D, size: number): void {
        // brush pixels -> viewport
        const mat = createMatrixFromTransform(transform);
        const canvasPos = applyToPoint(inverse(mat), position);

        // same placement as PixelBrush.drawDot at pressure 1
        size = Math.round(size * 2) / 2;
        const diameter = size * 2;
        const centerX = Math.round(canvasPos.x - size) + size;
        const top = Math.round(canvasPos.y - size);
        const halfWidths =
            this.tip === 'round'
                ? getPixelDiscHalfWidths(diameter)
                : new Array(diameter).fill(size);

        const getPath = (inset: number): string => {
            const points = getOutline(halfWidths, inset).map(([x, y]) =>
                applyToPoint(mat, [centerX + x, top + y]).join(','),
            );
            return 'M ' + points.join(' ') + ' Z';
        };
        setAttributes(this.rootEl.firstChild as Element, {
            d: getPath(1 / transform.scale),
        });
        setAttributes(this.rootEl.children[1] as Element, {
            d: getPath(0),
        });
    }

    setTip(tip: TPixelBrushTip): void {
        this.tip = tip;
    }

    getElement(): SVGElement {
        return this.rootEl;
    }
}
