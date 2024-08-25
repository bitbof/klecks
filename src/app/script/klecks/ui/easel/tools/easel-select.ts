import { BB } from '../../../../bb/bb';
import { IPointerEvent, TPointerType } from '../../../../bb/input/event.types';
import { IVector2D } from '../../../../bb/bb-types';
import { TSelectToolMode } from '../../tool-tabs/select-ui';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { TArrowKey, TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';
import { TViewportTransform, TViewportTransformXY } from '../../project-viewport/project-viewport';
import { rotate, snapAngleDeg } from '../../../../bb/math/math';
import { MultiPolygon } from 'polygon-clipping';
import { TBooleanOperation, TSelectShape } from '../../../select-tool/select-tool';
import { getSelectionPath2d } from '../../../../bb/multi-polygon/get-selection-path-2d';
import { EventChain } from '../../../../bb/input/event-chain/event-chain';
import { DoubleTapper } from '../../../../bb/input/event-chain/double-tapper';
import { IChainElement } from '../../../../bb/input/event-chain/event-chain.types';

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
    onStartSelect: (p: IVector2D, operation: TBooleanOperation) => void;
    onGoSelect: (p: IVector2D) => void;
    onEndSelect: () => void;
    onStartMoveSelect: (p: IVector2D) => void;
    onGoMoveSelect: (p: IVector2D) => void;
    onEndMoveSelect: () => void;
    onSelectAddPoly: (path: IVector2D[], operation: TBooleanOperation) => void;
    onTranslateTransform: (d: IVector2D) => void;
    onResetSelection: () => void;
};

/**
 * for select tool and transform tool
 */
export class EaselSelect implements TEaselTool {
    // from params
    private readonly onStartSelect: (p: IVector2D, operation: TBooleanOperation) => void;
    private readonly onGoSelect: (p: IVector2D) => void;
    private readonly onEndSelect: () => void;
    private readonly onStartMoveSelect: (p: IVector2D) => void;
    private readonly onGoMoveSelect: (p: IVector2D) => void;
    private readonly onEndMoveSelect: () => void;
    private readonly onSelectAddPoly: (path: IVector2D[], operation: TBooleanOperation) => void;
    private readonly onTranslateTransform: TEaselSelectParams['onTranslateTransform'];
    private readonly onResetSelection: () => void;

    private readonly svgEl: SVGElement;
    private easel: TEaselInterface = {} as TEaselInterface;
    private viewportTransform: TViewportTransform = {} as TViewportTransform;
    private tempCtx: CanvasRenderingContext2D = BB.ctx(BB.canvas(1, 1)); // used for isPointInPath()
    private pointerChain: EventChain;

    // state
    private canvasSelection: MultiPolygon = [];
    private selectionPath: Path2D = getSelectionPath2d([]);
    private mode: TSelectToolMode = 'select';
    private isDragging: boolean = false;

    // select-mode state
    private selectSelectMode: 'select' | 'move' = 'select';
    private didSelectionMove: boolean = false;
    private defaultBooleanOperation: TBooleanOperation = 'new'; // set by the UI
    private appliedBooleanOperation: TBooleanOperation | undefined; // once dragging, the locked in boolean operation
    private selectShape: TSelectShape = 'rect';
    private polyShape: (IVector2D & { temp?: true })[] = [];

    // transform-mode state
    private movement: IVector2D | undefined = undefined;
    private lastCanvasMovement: IVector2D | undefined = undefined;

    private viewportToCanvas(p: IVector2D): IVector2D {
        const matrix = inverse(createMatrixFromTransform(this.easel.getTransform()));
        return applyToPoint(matrix, p);
    }

    private updateSelectionPath(): void {
        this.selectionPath = getSelectionPath2d(this.canvasSelection);
    }

    private resetPolyShape(): void {
        this.polyShape = [];
        this.doubleTapPointerTypes = ['touch'];
        this.easel.updateDoubleTapPointerTypes();
        this.easel.requestRender(); // because polyShape might have changed
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
        cursorCanvasPos: IVector2D,
    ): boolean {
        const isOverSelection =
            this.polyShape.length < 2 &&
            this.selectionPath &&
            this.tempCtx.isPointInPath(this.selectionPath, cursorCanvasPos.x, cursorCanvasPos.y);
        return effectiveOperation === 'new' && isOverSelection;
    }

    private selectOnPointer(event: IPointerEvent): void {
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

                    this.polyShape.push(cursorCanvasPos);

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

    private transformOnPointer(event: IPointerEvent): void {
        this.easel.setCursor('move');
        if (event.type === 'pointerdown' && event.button === 'left') {
            this.movement = { x: 0, y: 0 };
            this.lastCanvasMovement = { x: 0, y: 0 };
            this.updateSelectionPath();
            this.isDragging = true;
        }
        if (event.type === 'pointermove' && event.button === 'left') {
            this.movement!.x += event.dX;
            this.movement!.y += event.dY;
            this.updateSelectionPath();

            const viewportMovement = this.movement!;

            const viewportTransform = this.easel.getTransform();
            let canvasMovement = BB.Vec2.mul(viewportMovement, 1 / viewportTransform.scale);
            canvasMovement = rotate(
                canvasMovement.x,
                canvasMovement.y,
                -this.viewportTransform.angleDeg,
            );
            canvasMovement.x = Math.round(canvasMovement.x);
            canvasMovement.y = Math.round(canvasMovement.y);

            const d = {
                x: Math.round(canvasMovement.x - this.lastCanvasMovement!.x),
                y: Math.round(canvasMovement.y - this.lastCanvasMovement!.y),
            };

            if (d.x !== 0 || d.y !== 0) {
                this.onTranslateTransform(d);
                this.lastCanvasMovement = {
                    x: this.lastCanvasMovement!.x + d.x,
                    y: this.lastCanvasMovement!.y + d.y,
                };
            }
        }
        if (event.type === 'pointerup' && event.button === undefined && this.isDragging) {
            this.movement = undefined;
            this.updateSelectionPath();
            this.isDragging = false;
        }
    }

    private onPointerChainOut(event: IPointerEvent): void {
        if (this.mode === 'select') {
            this.selectOnPointer(event);
        } else {
            this.transformOnPointer(event);
        }
    }

    // ----------------------------------- public -----------------------------------
    doubleTapPointerTypes: TPointerType[] = ['touch'];
    blockTrigger: TEaselToolTrigger = 'alt';

    constructor(p: TEaselSelectParams) {
        this.onTranslateTransform = p.onTranslateTransform;
        this.mode = p.selectMode;
        this.onStartSelect = p.onStartSelect;
        this.onGoSelect = p.onGoSelect;
        this.onEndSelect = p.onEndSelect;
        this.onStartMoveSelect = p.onStartMoveSelect;
        this.onGoMoveSelect = p.onGoMoveSelect;
        this.onEndMoveSelect = p.onEndMoveSelect;
        this.onSelectAddPoly = p.onSelectAddPoly;
        this.onResetSelection = p.onResetSelection;

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
                }) as IChainElement,
            ],
        });

        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(event: IPointerEvent): void {
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
    }

    activate(cursorPos?: IVector2D, poppedTemp?: boolean): void {
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
    }

    onUpdateSelection(selection: MultiPolygon | undefined): void {
        this.canvasSelection = selection || [];
        this.updateSelectionPath();
    }

    setRenderedSelection(selection: MultiPolygon | undefined): void {
        this.easel.setRenderedSelection(selection);
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

    onKeyDown(keyStr: string): void {
        if (keyStr === 'esc') {
            this.resetPolyShape();
        }
    }

    onClickOutside(): void {
        this.resetPolyShape();
    }

    onBlur(): void {
        this.resetPolyShape();
    }

    onArrowKeys(direction: TArrowKey): boolean {
        if (this.mode === 'select') {
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

        // accommodate easel rotation
        const rotatedDirection = rotate(
            movement.x,
            movement.y,
            -snapAngleDeg(this.easel.getTransform().angleDeg, 90, 90),
        );

        this.onTranslateTransform(rotatedDirection);
        return true;
    }
}
