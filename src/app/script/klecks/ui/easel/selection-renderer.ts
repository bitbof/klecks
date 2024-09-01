import { TViewportTransform } from '../project-viewport/project-viewport';
import { MultiPolygon, Pair } from 'polygon-clipping';
import { BB } from '../../../bb/bb';
import * as classes from './selection-renderer.module.scss';
import { Matrix } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { getSvgPathD } from '../../../bb/multi-polygon/get-selection-path-2d';
import { transformMultiPolygon } from '../../../bb/multi-polygon/transform-multi-polygon';
import { applyPolygonClipping } from '../../../bb/multi-polygon/apply-polygon-clipping';

export type TSelectionRendererParams = {
    transform: TViewportTransform;
    selection?: MultiPolygon;
    width: number; // size of viewport
    height: number; // size of viewport
};

// makes right angle rects look more crisp
export function roundPoly(multiPolygon: MultiPolygon): MultiPolygon {
    return multiPolygon.map((poly) => {
        return poly.map((ring) => {
            return ring.map((point) => {
                return [Math.round(point[0] + 0.5) - 0.5, Math.round(point[1] + 0.5) - 0.5] as Pair; // on .5
            });
        });
    });
}

export class SelectionRenderer {
    private readonly rootEl: SVGElement;
    private readonly svgPath1: SVGPathElement;
    private readonly svgPath2: SVGPathElement;

    private viewportTransform: TViewportTransform;
    private viewportMat: Matrix;
    private selection: undefined | MultiPolygon; // selection of project
    private renderedSelection: null | undefined | MultiPolygon = null; // overwrites this.selection, unless it's null
    private viewportWidth: number;
    private viewportHeight: number;

    private update(): void {
        const selection = this.renderedSelection === null ? this.selection : this.renderedSelection;

        if (!selection) {
            this.svgPath1.setAttribute('d', '');
            this.svgPath2.setAttribute('d', '');
            return;
        }

        // firefox has problems with non-scaling-stroke, so we scale manually.
        // ^ it has visual glitches when the transformation changes.
        const transformedSelection = transformMultiPolygon(selection, this.viewportMat);

        // Firefox has bad performance when zoomed in far (guess: it doesn't clip the path)
        // So we clip manually.
        const clipPadding = 10;
        const clippedSelection = applyPolygonClipping('intersection', transformedSelection, [
            [
                [-clipPadding, -clipPadding],
                [this.viewportWidth + clipPadding, -clipPadding],
                [this.viewportWidth + clipPadding, this.viewportHeight + clipPadding],
                [-clipPadding, this.viewportHeight + clipPadding],
                [-clipPadding, -clipPadding],
            ],
        ]);

        const d = getSvgPathD(roundPoly(clippedSelection));
        this.svgPath1.setAttribute('d', d);
        this.svgPath2.setAttribute('d', d);
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TSelectionRendererParams) {
        this.viewportTransform = p.transform;
        this.viewportMat = createMatrixFromTransform(this.viewportTransform);
        this.selection = p.selection;
        this.viewportWidth = p.width;
        this.viewportHeight = p.height;

        this.svgPath1 = BB.createSvg({
            elementType: 'path',
            'vector-effect': 'non-scaling-stroke',
        }) as SVGPathElement;
        this.svgPath1.classList.add(classes.whitePath);

        this.svgPath2 = BB.createSvg({
            elementType: 'path',
            'vector-effect': 'non-scaling-stroke',
        }) as SVGPathElement;
        this.svgPath2.classList.add(classes.blackPath);
        this.rootEl = BB.createSvg({
            elementType: 'g',
        });
        this.rootEl.append(this.svgPath1, this.svgPath2);
    }

    setTransform(transform: TViewportTransform): void {
        this.viewportTransform = transform;
        this.viewportMat = createMatrixFromTransform(this.viewportTransform);
        this.update();
    }

    setSelection(selection?: MultiPolygon): void {
        if (this.selection === selection) {
            return;
        }
        this.selection = selection;
        // only need to update when this.selection is used
        if (this.renderedSelection === null) {
            this.update();
        }
    }

    // overwrite project selection
    setRenderedSelection(renderedSelection?: MultiPolygon, isImmediate?: boolean): void {
        if (this.renderedSelection === renderedSelection) {
            return;
        }
        this.renderedSelection = renderedSelection;
        this.update();
    }

    // render project selection again
    clearRenderedSelection(isImmediate?: boolean): void {
        this.renderedSelection = null;
        if (!isImmediate) {
            // good enough to update on next setSelection. (to prevent flickering)
            return;
        }
        this.update();
    }

    setSize(width: number, height: number): void {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    getElement(): SVGElement {
        return this.rootEl;
    }

    destroy(): void {
        this.rootEl.remove();
        this.selection = undefined;
    }
}
