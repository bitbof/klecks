import { IVector2D } from '../../bb/bb-types';
import { Geom, MultiPolygon, Polygon } from 'polygon-clipping';
import { translateMultiPolygon } from '../../bb/multi-polygon/translate-multi-polygon';
import { getEllipsePath } from '../../bb/multi-polygon/get-ellipse-path';
import { KlCanvas } from '../canvas/kl-canvas';
import { BB } from '../../bb/bb';
import { applyPolygonClipping } from '../../bb/multi-polygon/apply-polygon-clipping';

export type TBooleanOperation = 'union' | 'difference' | 'new';
export type TSelectShape = 'rect' | 'ellipse' | 'lasso' | 'poly';

export const POLYGON_PRECISION = 2;
export function limitPrecision(num: number): number {
    return parseFloat(num.toFixed(POLYGON_PRECISION));
}
export function limitPolygonPrecision(poly: Polygon): Polygon {
    return poly.map((ring) => ring.map(([x, y]) => [limitPrecision(x), limitPrecision(y)]));
}

export type TSelectToolParams = {
    klCanvas: KlCanvas;
};

export class SelectTool {
    // from params
    private readonly klCanvas: KlCanvas;

    private shape: TSelectShape = 'rect';
    private selection: MultiPolygon | undefined;
    private selectOperation: TBooleanOperation = 'new';
    private selectDragInputs: IVector2D[] = [];
    private moveLastPos: IVector2D | undefined;
    private didMove: boolean = false; // was selection moved

    // ----------------------------------- public -----------------------------------
    constructor(p: TSelectToolParams) {
        this.klCanvas = p.klCanvas;
    }

    reset(): void {
        this.selection = undefined;
    }

    combineSelection(polygon: Polygon): MultiPolygon {
        let result: MultiPolygon = this.selection ?? [];
        if (this.selectOperation === 'new') {
            result = [polygon];
        } else {
            if (this.selection && this.selection.length > 0) {
                const operation = this.selectOperation === 'difference' ? 'difference' : 'union';
                result = applyPolygonClipping(operation, this.selection, polygon);
            } else {
                if (this.selectOperation === 'union') {
                    result = [polygon];
                }
                // noop if difference on empty selection
            }
        }
        return result;
    }

    /** current state of selection */
    getSelection(): MultiPolygon | undefined {
        // combine selections
        let selection: MultiPolygon = this.selection || [];

        if (this.selectDragInputs.length > 1) {
            // currently inputting

            const operation = this.selectOperation === 'difference' ? 'difference' : 'union';

            if (this.shape === 'rect') {
                const first = this.selectDragInputs[0];
                const last = this.selectDragInputs[this.selectDragInputs.length - 1];
                // floor and ceil already limit precision
                const minX = Math.floor(Math.min(first.x, last.x));
                const minY = Math.floor(Math.min(first.y, last.y));
                const maxX = Math.ceil(Math.max(first.x, last.x));
                const maxY = Math.ceil(Math.max(first.y, last.y));

                selection = this.combineSelection([
                    [
                        [minX, minY],
                        [maxX, minY],
                        [maxX, maxY],
                        [minX, maxY],
                    ],
                ]);
            } else if (this.shape === 'ellipse') {
                const first = this.selectDragInputs[0];
                const last = this.selectDragInputs[this.selectDragInputs.length - 1];

                const cx = (first.x + last.x) / 2;
                const cy = (first.y + last.y) / 2;
                const rx = Math.abs(last.x - first.x) / 2;
                const ry = Math.abs(last.y - first.y) / 2;

                selection = this.combineSelection(
                    limitPolygonPrecision(getEllipsePath(cx, cy, rx, ry, 50)),
                );
            } else if (this.shape === 'lasso') {
                selection = this.combineSelection([
                    this.selectDragInputs.map((p) => [limitPrecision(p.x), limitPrecision(p.y)]),
                ] as Polygon);
            }
        }

        return selection.length === 0 ? undefined : selection;
    }

    // --- selecting ---
    startSelect(pos: IVector2D, operation: TBooleanOperation): void {
        this.selectOperation = operation;
        if (this.selectOperation === 'new') {
            this.reset();
        }
        this.selectDragInputs = [pos];
    }

    goSelect(pos: IVector2D): void {
        this.selectDragInputs.push({
            x: pos.x,
            y: pos.y,
        });
    }

    endSelect(): void {
        if (this.selectDragInputs.length > 1) {
            // commit
            this.selection = this.getSelection();
        } else {
            this.reset();
        }
        this.selectDragInputs = [];
    }

    addPoly(polygon: IVector2D[], operation: TBooleanOperation): void {
        this.selectOperation = operation;
        this.selection = this.combineSelection([
            polygon.map((p) => [limitPrecision(p.x), limitPrecision(p.y)]),
        ]);
    }

    // --- moving selection ---
    startMoveSelect(pos: IVector2D): void {
        this.moveLastPos = pos;
        this.didMove = false;
    }

    goMoveSelect(pos: IVector2D): void {
        if (!this.moveLastPos) {
            return;
        }
        this.didMove = true;
        const dx = Math.round(pos.x - this.moveLastPos.x);
        const dy = Math.round(pos.y - this.moveLastPos.y);
        if (this.selection) {
            this.selection = translateMultiPolygon(this.selection, dx, dy);
        }
        this.moveLastPos = {
            x: this.moveLastPos.x + dx,
            y: this.moveLastPos.y + dy,
        };
    }

    endMoveSelect(): void {
        this.moveLastPos = undefined;
    }

    getDidMove(): boolean {
        return this.didMove;
    }

    selectAll(): void {
        this.reset();
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        this.selection = [
            [
                [
                    [0, 0],
                    [width, 0],
                    [width, height],
                    [0, height],
                    [0, 0],
                ],
            ],
        ];
    }

    invertSelection(): void {
        const selection = this.selection ?? [];
        const width = this.klCanvas.getWidth();
        const height = this.klCanvas.getHeight();
        this.selection = applyPolygonClipping(
            'difference',
            [
                [
                    [0, 0],
                    [width, 0],
                    [width, height],
                    [0, height],
                ],
            ],
            selection,
        );
    }

    setShape(shape: TSelectShape): void {
        this.shape = shape;
    }

    getShape(): TSelectShape {
        return this.shape;
    }

    setSelection(selection: MultiPolygon | undefined): void {
        this.selection = selection ? BB.copyObj(selection).map(limitPolygonPrecision) : undefined;
    }
}
