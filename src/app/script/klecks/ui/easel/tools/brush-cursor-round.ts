import { BB } from '../../../../bb/bb';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { IVector2D } from '../../../../bb/bb-types';

export class BrushCursorRound {
    private readonly rootEl: SVGElement;

    // --------------------- public ------------------
    constructor() {
        this.rootEl = BB.createSvg({
            elementType: 'g',
            childrenArr: [
                {
                    elementType: 'circle',
                    cx: '0',
                    cy: '0',
                    fill: 'none',
                    stroke: 'rgba(255,255,255,0.7)',
                    'stroke-width': '1',
                },
                {
                    elementType: 'circle',
                    cx: '0',
                    cy: '0',
                    fill: 'none',
                    stroke: 'rgba(0,0,0,0.7)',
                    'stroke-width': '1',
                },
            ],
        });
    }

    update(transform: TViewportTransform, position: IVector2D, size: number): void {
        BB.setAttributes(this.rootEl.children[0], {
            r: '' + Math.max(0, size * transform.scale - 1),
        });
        BB.setAttributes(this.rootEl.children[1], {
            r: '' + size * transform.scale,
        });
        BB.setAttributes(this.rootEl, {
            transform: `translate(${position.x} ${position.y})`,
        });
    }

    getElement(): SVGElement {
        return this.rootEl;
    }
}
