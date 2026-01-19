import { BB } from '../../../../bb/bb';
import { TPointerEvent, TPointerType } from '../../../../bb/input/event.types';
import { TBounds, TVector2D } from '../../../../bb/bb-types';
import { TSelectToolMode } from '../../tool-tabs/select-ui';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, compose, inverse, Matrix, rotate, translate } from 'transformation-matrix';
import { TArrowKey, TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';
import { TViewportTransform, TViewportTransformXY } from '../../project-viewport/project-viewport';
import { boundsToRect, pointsToAngleDeg } from '../../../../bb/math/math';
import { MultiPolygon } from 'polygon-clipping';
import { TBooleanOperation, TSelectShape } from '../../../select-tool/select-tool';
import { getSelectionPath2d } from '../../../../bb/multi-polygon/get-selection-path-2d';
import { EventChain } from '../../../../bb/input/event-chain/event-chain';
import { DoubleTapper } from '../../../../bb/input/event-chain/double-tapper';
import { TChainElement } from '../../../../bb/input/event-chain/event-chain.types';
import { CornerPanning } from '../corner-panning';
import { FreeTransform } from '../../components/free-transform';
import { freeTransformToMatrix } from '../../../select-tool/select-transform-tool';
import { TFreeTransform } from '../../components/free-transform-utils';

function transformFreeTransformViaMatrix(
    freeTransform: TFreeTransform,
    matrix: Matrix,
): TFreeTransform {
    const width = freeTransform.width;
    const height = freeTransform.height;
    const toCanvasMatrix = compose(
        translate(freeTransform.x, freeTransform.y),
        rotate((freeTransform.angleDeg / 180) * Math.PI),
    );

    const centerAfter = applyToPoint(matrix, freeTransform);

    // determine angle
    const upBefore = applyToPoint(toCanvasMatrix, { x: 0, y: 1 });
    const upAfter = applyToPoint(matrix, upBefore);
    const angleDeg = pointsToAngleDeg(centerAfter, upAfter) - 90;

    const tlBefore = applyToPoint(toCanvasMatrix, { x: -width / 2, y: -height / 2 });
    const trBefore = applyToPoint(toCanvasMatrix, { x: width / 2, y: -height / 2 });
    const blBefore = applyToPoint(toCanvasMatrix, { x: -width / 2, y: height / 2 });
    // transform each and undo rotation
    const matrixWithoutRotation = compose(
        rotate((-angleDeg / 180) * Math.PI, centerAfter.x, centerAfter.y),
        matrix,
    );
    const tlAfter = applyToPoint(matrixWithoutRotation, tlBefore);
    const trAfter = applyToPoint(matrixWithoutRotation, trBefore);
    const blAfter = applyToPoint(matrixWithoutRotation, blBefore);

    const newWidth = trAfter.x - tlAfter.x;
    const newHeight = blAfter.y - tlAfter.y;

    return {
        x: centerAfter.x,
        y: centerAfter.y,
        width: Math.round(newWidth),
        height: Math.round(newHeight),
        angleDeg: angleDeg,
    } as TFreeTransform;
}

const modeToCursor: Record<TSelectToolMode, string> = {
    select: 'default',
    transform: 'move',
};

const operationToCursor: Record<TBooleanOperation, string> = {
    new: 'default',
    union: 'copy',
    difference: 'alias',
};

export type TEaselSelectParams = {
    selectMode: TSelectToolMode;

    // select

    onStartSelect: (p: TVector2D, operation: TBooleanOperation) => void;
    onGoSelect: (p: TVector2D) => void;
    onEndSelect: () => void;
    onStartMoveSelect: (p: TVector2D) => void;
    onGoMoveSelect: (p: TVector2D) => void;
    onEndMoveSelect: () => void;
    onSelectAddPoly: (path: TVector2D[], operation: TBooleanOperation) => void;
    onResetSelection: () => void;

    // transform

    onFreeTransform: (matrix: Matrix) => void;
};

/**
 * for select tool and transform tool
 */
export class EaselSelect implements TEaselTool {
    // from params

    private readonly onStartSelect: (p: TVector2D, operation: TBooleanOperation) => void;
    private readonly onGoSelect: (p: TVector2D) => void;
    private readonly onEndSelect: () => void;
    private readonly onStartMoveSelect: (p: TVector2D) => void;
    private readonly onGoMoveSelect: (p: TVector2D) => void;
    private readonly onEndMoveSelect: () => void;
    private readonly onSelectAddPoly: (path: TVector2D[], operation: TBooleanOperation) => void;
    private readonly onResetSelection: () => void;
    private readonly onFreeTransform: TEaselSelectParams['onFreeTransform'];

    private readonly svgEl: SVGElement;
    private readonly htmlEl: HTMLElement;
    private easel: TEaselInterface = {} as TEaselInterface;
    private viewportTransform: TViewportTransform = {} as TViewportTransform;
    private tempCtx: CanvasRenderingContext2D = BB.ctx(BB.canvas(1, 1)); // used for isPointInPath()
    private pointerChain: EventChain;
    private cornerPanning: CornerPanning;

    // state

    private canvasSelection: MultiPolygon = [];
    private selection: MultiPolygon | undefined;
    private selectionPath: Path2D = getSelectionPath2d([]);
    private selectionBounds: TBounds | undefined;
    private mode: TSelectToolMode = 'select';
    private isDragging: boolean = false;

    // select-mode state

    private selectSelectMode: 'select' | 'move' = 'select';
    private didSelectionMove: boolean = false;
    private defaultBooleanOperation: TBooleanOperation = 'new'; // set by the UI
    private appliedBooleanOperation: TBooleanOperation | undefined; // once dragging, the locked in boolean operation
    private selectShape: TSelectShape = 'rect';
    private polyShape: (TVector2D & { temp?: true })[] = [];

    // transform-mode state

    private freeTransform: FreeTransform | undefined;
    // selection sample changes its transform with each clone. So we need to store the starting point transformation,
    // or it could have been a getter
    private initialTransformMatrix: Matrix = {} as Matrix;
    private initialFreeTransform: TFreeTransform = {} as TFreeTransform;
    private freeTransformIsConstrained: boolean = true;
    private freeTransformIsSnapping: boolean = true;

    private viewportToCanvas(p: TVector2D): TVector2D {
        const matrix = inverse(createMatrixFromTransform(this.easel.getTransform()));
        return applyToPoint(matrix, p);
    }

    private updateSelectionPath(): void {
        this.selectionPath = getSelectionPath2d(this.canvasSelection);
    }

    private resetPolyShape(): boolean {
        if (this.polyShape.length === 0) {
            return false;
        }
        this.polyShape = [];
        this.doubleTapPointerTypes = ['touch'];
        this.easel.updateDoubleTapPointerTypes();
        this.easel.requestRender(); // because polyShape might have changed
        return true;
    }

    /** boolean operation if you also consider keys */
    private getEffectiveBooleanOperation(): TBooleanOperation {
        const isSubtract =
            this.defaultBooleanOperation === 'new'
                ? this.easel.keyListener.isPressed('alt')
                : this.defaultBooleanOperation === 'difference';
        const isAdd =
            this.defaultBooleanOperation === 'new'
                ? this.easel.keyListener.isPressed('shift')
                : this.defaultBooleanOperation === 'union';

        if (isSubtract) {
            return 'difference';
        }
        if (isAdd) {
            return 'union';
        }
        return 'new';
    }

    private getDoMoveSelection(
        effectiveOperation: TBooleanOperation,
        cursorCanvasPos: TVector2D,
    ): boolean {
        const isOverSelection =
            this.polyShape.length < 2 &&
            this.selectionPath &&
            this.tempCtx.isPointInPath(this.selectionPath, cursorCanvasPos.x, cursorCanvasPos.y);
        return effectiveOperation === 'new' && isOverSelection;
    }

    // can be repeatedly called with the same event
    private selectOnPointer(event: TPointerEvent): void {
        const effectiveOperation = this.getEffectiveBooleanOperation();
        const wasDragging = this.isDragging;
        const cursorCanvasPos = this.viewportToCanvas({ x: event.relX, y: event.relY });
        const doMove = this.getDoMoveSelection(effectiveOperation, cursorCanvasPos);

        if (event.type === 'pointerdown') {
            this.isDragging = true;
            if (doMove) {
                this.selectSelectMode = 'move';
            } else {
                this.selectSelectMode = 'select';
            }
        }
        if (event.type === 'pointerup') {
            this.isDragging = false;
        }

        if (this.selectSelectMode === 'move') {
            if (event.type === 'pointerdown' && event.button === 'left') {
                this.didSelectionMove = false;
                this.onStartMoveSelect(cursorCanvasPos);
            }
            if (event.type === 'pointermove' && event.button === 'left') {
                this.didSelectionMove = true;
                this.onGoMoveSelect(cursorCanvasPos);
            }
            if (event.type === 'pointerup') {
                this.onEndMoveSelect();
                if (!this.didSelectionMove) {
                    this.onResetSelection();
                }
            }
        } else {
            // select

            if (this.selectShape === 'poly') {
                if (event.type === 'pointermove') {
                    if (this.polyShape[this.polyShape.length - 1]?.temp) {
                        this.polyShape.pop();
                    }
                    this.polyShape.push({
                        ...cursorCanvasPos,
                        temp: true,
                    });
                    this.easel.requestRender();
                }
                if (event.type === 'pointerup' && wasDragging) {
                    if (this.polyShape.length < 2) {
                        this.appliedBooleanOperation = effectiveOperation;
                    }

                    this.doubleTapPointerTypes = [];
                    this.easel.updateDoubleTapPointerTypes();

                    if (this.polyShape[this.polyShape.length - 1]?.temp) {
                        this.polyShape.pop();
                    }
                    const lastPolyShapePoint = this.polyShape[this.polyShape.length - 1];
                    if (
                        !lastPolyShapePoint ||
                        cursorCanvasPos.x !== lastPolyShapePoint.x ||
                        cursorCanvasPos.y !== lastPolyShapePoint.y
                    ) {
                        this.polyShape.push(cursorCanvasPos);
                        this.easel.requestRender();
                    }

                    const first = this.polyShape[0];
                    const last = this.polyShape[this.polyShape.length - 1];
                    if (
                        this.polyShape.length > 2 &&
                        BB.dist(first.x, first.y, last.x, last.y) * this.viewportTransform.scale < 4
                    ) {
                        this.polyShape.pop();
                        this.polyShape.push({ ...this.polyShape[0] });
                        const shape = this.polyShape;
                        this.polyShape = [];
                        this.onSelectAddPoly(shape, this.appliedBooleanOperation!);
                        this.appliedBooleanOperation = undefined;
                    }
                }
            } else {
                if (event.type === 'pointerdown' && event.button === 'left') {
                    this.appliedBooleanOperation = effectiveOperation;
                    this.onStartSelect(cursorCanvasPos, this.appliedBooleanOperation!);
                }
                if (event.type === 'pointermove' && event.button === 'left' && this.isDragging) {
                    this.onGoSelect(cursorCanvasPos);
                }
                if (event.type === 'pointerup' && wasDragging) {
                    this.onEndSelect();
                    this.appliedBooleanOperation = undefined;
                }
            }
        }

        if (!event.button) {
            if (doMove) {
                this.selectSelectMode = 'move';
            } else {
                this.selectSelectMode = 'select';
            }
        }

        if (this.selectSelectMode === 'move') {
            this.easel.setCursor('move');
        } else {
            this.easel.setCursor(
                operationToCursor[this.appliedBooleanOperation ?? effectiveOperation],
            );
        }
    }

    // can be repeatedly called with the same event
    private transformOnPointer(event: TPointerEvent): void {
        this.easel.setCursor('default');
        // handled via this.freeTransform atm
    }

    private onPointerChainOut(event: TPointerEvent): void {
        if (this.mode === 'select') {
            this.cornerPanning.onPointer(event);
            this.selectOnPointer(event);
        } else {
            this.transformOnPointer(event);
        }
    }

    private createFreeTransform(): void {
        let isFirstCallback = true;
        this.freeTransform = new FreeTransform({
            x: 1,
            y: 1,
            width: 1,
            height: 1,
            angleDeg: 0,
            isConstrained: this.freeTransformIsConstrained,
            snapX: [],
            snapY: [],
            viewportTransform: { scale: 1, x: 0, y: 0, angleDeg: 0 },
            callback: (transform) => {
                if (isFirstCallback) {
                    isFirstCallback = false;
                    return;
                }
                if (!this.selection || this.mode === 'select' || !this.selectionBounds) {
                    return;
                }
                const freeTransformMatrix = freeTransformToMatrix(transform, this.selectionBounds);
                const matrix = compose(freeTransformMatrix, inverse(this.initialTransformMatrix));
                this.onFreeTransform(matrix);
            },
            onWheel: this.easel.onWheel,
            wheelParent: this.easel.getElement(),
        });
        this.freeTransform.setSnapping(this.freeTransformIsSnapping);
        this.htmlEl.append(this.freeTransform.getElement());
        this.freeTransform.setViewportTransform(this.viewportTransform);
    }

    private destroyFreeTransform(): void {
        this.freeTransform?.getElement().remove();
        this.freeTransform?.destroy();
        this.freeTransform = undefined;
    }

    // ----------------------------------- public -----------------------------------

    doubleTapPointerTypes: TPointerType[] = ['touch'];
    blockTrigger: TEaselToolTrigger = 'alt';

    constructor(p: TEaselSelectParams) {
        this.mode = p.selectMode;
        this.onStartSelect = p.onStartSelect;
        this.onGoSelect = p.onGoSelect;
        this.onEndSelect = p.onEndSelect;
        this.onStartMoveSelect = p.onStartMoveSelect;
        this.onGoMoveSelect = p.onGoMoveSelect;
        this.onEndMoveSelect = p.onEndMoveSelect;
        this.onSelectAddPoly = p.onSelectAddPoly;
        this.onResetSelection = p.onResetSelection;
        this.onFreeTransform = p.onFreeTransform;

        this.cornerPanning = new CornerPanning({
            getEaselSize: () => this.easel.getSize(),
            getTransform: () => this.easel.getTargetTransform(),
            setTransform: (transform) => this.easel.setTransform(transform, true),
            testCanPan: (buttonIsPressed) => {
                return (
                    (buttonIsPressed || this.polyShape.length > 1) &&
                    !(this.selectShape === 'lasso' && this.selectSelectMode === 'select')
                );
            },
            onRepeatEvent: (e) => {
                if (this.mode === 'select') {
                    this.selectOnPointer(e);
                } else {
                    this.transformOnPointer(e);
                }
            },
        });

        this.pointerChain = new EventChain({
            chainArr: [
                new DoubleTapper({
                    onDoubleTap: (e) => {
                        if (this.polyShape.length < 3) {
                            return;
                        }
                        const shape = this.polyShape.map((item) => ({ x: item.x, y: item.y }));
                        this.resetPolyShape();
                        if (shape.length > 1) {
                            shape.push({ ...shape[0] });
                            p.onSelectAddPoly(shape, this.appliedBooleanOperation!);
                        }
                    },
                    isInstant: true,
                }) as TChainElement,
            ],
        });

        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.htmlEl = BB.el();
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    getHtmlOverlayElement(): HTMLElement {
        return this.htmlEl;
    }

    onPointer(event: TPointerEvent): void {
        this.onPointerChainOut(event);
        this.pointerChain.chainIn(event);
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
        this.viewportTransform = this.easel.getTransform();
    }

    setMode(mode: TSelectToolMode): void {
        this.mode = mode;
        this.resetPolyShape();
        if (this.mode === 'transform') {
            this.createFreeTransform();
        } else {
            this.destroyFreeTransform();
        }
    }

    onTool(toolId: string): void {
        if (toolId === 'select') {
            this.htmlEl.style.display = 'block';
        } else {
            this.htmlEl.style.display = 'none';
        }
    }

    activate(cursorPos?: TVector2D, poppedTemp?: boolean): void {
        this.easel.setCursor(modeToCursor[this.mode]);
        this.isDragging = false;
        this.onUpdateTransform(this.easel.getTransform());
        if (!poppedTemp) {
            this.resetPolyShape();
        }
    }

    onUpdateTransform(transform: TViewportTransform): void {
        this.viewportTransform = transform;
        this.updateSelectionPath();
        this.freeTransform?.setViewportTransform(transform);
    }

    onUpdateSelection(selection: MultiPolygon | undefined): void {
        this.canvasSelection = selection || [];
        this.updateSelectionPath();
    }

    setRenderedSelection(selection: MultiPolygon | undefined): void {
        this.selection = selection;
        this.easel.setRenderedSelection(selection);
    }

    updateInitialTransformMatrix(): void {
        if (!this.freeTransform) {
            return;
        }
        const transform = this.freeTransform.getValue();
        this.initialFreeTransform = transform;
        this.initialTransformMatrix = freeTransformToMatrix(transform, this.selectionBounds!);
    }

    initialiseTransform(bounds: TBounds): void {
        this.selectionBounds = {
            x1: 0,
            y1: 0,
            x2: bounds.x2 - bounds.x1,
            y2: bounds.y2 - bounds.y1,
        };
        const rect = boundsToRect(bounds, false);
        this.freeTransform?.initialise({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            width: rect.width,
            height: rect.height,
            angleDeg: 0,
        });
        const { width, height } = this.easel.getProjectSize();
        this.freeTransform?.setSnappingPoints([0, width], [0, height]);
        this.updateInitialTransformMatrix();
    }

    setTransform(matrix: Matrix): void {
        const newFreeTransform = transformFreeTransformViaMatrix(this.initialFreeTransform, matrix);
        this.freeTransform?.initialise(newFreeTransform);
    }

    clearRenderedSelection(isImmediate?: boolean): void {
        this.easel.clearRenderedSelection(isImmediate);
    }

    setBooleanOperation(operation: TBooleanOperation): void {
        this.defaultBooleanOperation = operation;
    }

    setSelectShape(shape: TSelectShape): void {
        this.resetPolyShape();
        this.selectShape = shape;
    }

    getIsLocked(): boolean {
        return this.isDragging;
    }

    renderAfterViewport(ctx: CanvasRenderingContext2D, transform: TViewportTransformXY): void {
        if (this.polyShape.length < 2) {
            return;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'difference';
        ctx.beginPath();
        const shape = this.polyShape;
        ctx.moveTo(shape[0].x, shape[0].y);
        for (let i = 1; i < shape.length; i++) {
            ctx.lineTo(shape[i].x, shape[i].y);
        }
        ctx.lineWidth = 1 / transform.scaleX;
        ctx.strokeStyle = 'white';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    }

    onKeyDown(keyStr: string, e: KeyboardEvent): void {
        if (keyStr === 'esc') {
            if (this.resetPolyShape()) {
                e.preventDefault();
            }
        }
    }

    onClickOutside(): void {
        this.resetPolyShape();
    }

    onBlur(): void {
        this.resetPolyShape();
    }

    onArrowKeys(direction: TArrowKey): boolean {
        if (!this.freeTransform) {
            return false;
        }
        let movement = { x: 0, y: 0 };
        if (direction === 'left') {
            movement = {
                x: -1,
                y: 0,
            };
        }
        if (direction === 'right') {
            movement = {
                x: 1,
                y: 0,
            };
        }
        if (direction === 'up') {
            movement = {
                x: 0,
                y: -1,
            };
        }
        if (direction === 'down') {
            movement = {
                x: 0,
                y: 1,
            };
        }
        if (this.easel.isKeyPressed('shift')) {
            movement.x *= 5;
            movement.y *= 5;
        }
        this.freeTransform.move(movement.x, movement.y);
        return true;
    }

    setIsConstrained(isConstrained: boolean): void {
        this.freeTransformIsConstrained = isConstrained;
        this.freeTransform?.setIsConstrained(isConstrained);
    }

    setIsSnapping(isSnapping: boolean): void {
        this.freeTransformIsSnapping = isSnapping;
        this.freeTransform?.setSnapping(isSnapping);
    }

    getFreeTransformTransformation(): TFreeTransform | undefined {
        return this.freeTransform?.getValue();
    }

    rotateFreeTransform(angleDeg: number): void {
        if (!this.freeTransform || !this.selectionBounds) {
            return;
        }
        const newAngle = (this.freeTransform.getValue().angleDeg + angleDeg) % 360;
        this.freeTransform.setAngleDeg(newAngle);
        const freeTransformMatrix = freeTransformToMatrix(
            this.freeTransform.getValue(),
            this.selectionBounds,
        );
        const matrix = compose(freeTransformMatrix, inverse(this.initialTransformMatrix));
        this.onFreeTransform(matrix);
    }
}
