import { BB } from '../../../../bb/bb';
import { TPointerEvent, TPointerType } from '../../../../bb/input/event.types';
import { TVector2D } from '../../../../bb/bb-types';
import { TSelectToolMode } from '../../tool-tabs/select-ui';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { TFreeTransform } from '../../../transform/transform-types';
import { checkRectFullyVisible } from '../../project-viewport/utils/check-rect-fully-visible';
import { getFitRectTransform } from '../../project-viewport/utils/get-fit-rect-transform';
import { TArrowKey, TEaselInterface, TEaselTool, TEaselToolTrigger } from '../easel.types';
import { TViewportTransform, TViewportTransformXY } from '../../project-viewport/project-viewport';
import { MultiPolygon } from 'polygon-clipping';
import { TBooleanOperation, TSelectShape } from '../../../select-tool/select-tool';
import { getSelectionPath2d } from '../../../../bb/multi-polygon/get-selection-path-2d';
import { EventChain } from '../../../../bb/input/event-chain/event-chain';
import { DoubleTapper } from '../../../../bb/input/event-chain/double-tapper';
import { TChainElement } from '../../../../bb/input/event-chain/event-chain.types';
import { CornerPanning } from '../corner-panning';
import { FreeTransform } from '../../components/free-transform';
import {
    createFfdMesh,
    evalFFD,
    findParametricCoordinate,
    TFfdLattice,
    TFfdMesh,
    TParametric2D,
    warpLatticeViaPoint,
} from '../../../transform/ffd';
import {
    RENDERED_FFD_MESH_RESOLUTION,
    TComposedTransformation,
} from '../../../transform/composed-transformation';

const FFD_DEBUG = false;

const operationToCursor: Record<TBooleanOperation, string> = {
    new: 'default',
    union: 'copy',
    difference: 'alias',
};

export type TEaselSelectParams = {
    selectMode: TSelectToolMode;

    // select

    onStartSelect: (p: TVector2D, operation: TBooleanOperation) => void;
    onGoSelect: (p: TVector2D, isShiftPressed: boolean) => void;
    onEndSelect: () => void;
    onStartMoveSelect: (p: TVector2D) => void;
    onGoMoveSelect: (p: TVector2D, isShiftPressed: boolean) => void;
    onEndMoveSelect: () => void;
    onSelectAddPoly: (path: TVector2D[], operation: TBooleanOperation) => void;
    onResetSelection: () => void;

    // transform

    onTransform: (transform: TComposedTransformation) => void;
    // gesture completed (create an undo step)
    onTransformEnd: () => void;
};

/**
 * for select tool and transform tool
 */
export class EaselSelect implements TEaselTool {
    // from params

    private readonly onStartSelect: (p: TVector2D, operation: TBooleanOperation) => void;
    private readonly onGoSelect: (p: TVector2D, isShiftPressed: boolean) => void;
    private readonly onEndSelect: () => void;
    private readonly onStartMoveSelect: (p: TVector2D) => void;
    private readonly onGoMoveSelect: (p: TVector2D, isShiftPressed: boolean) => void;
    private readonly onEndMoveSelect: () => void;
    private readonly onSelectAddPoly: (path: TVector2D[], operation: TBooleanOperation) => void;
    private readonly onResetSelection: () => void;
    private readonly onTransform: TEaselSelectParams['onTransform'];
    private readonly onTransformEnd: TEaselSelectParams['onTransformEnd'];

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
    private freeTransformTimeout: ReturnType<typeof setTimeout> | undefined;
    private transformation: TComposedTransformation | undefined;
    private freeTransformIsConstrained: boolean = true;
    private freeTransformIsSnapping: boolean = true;
    private ffdMesh: TFfdMesh | undefined;
    private warpStart:
        | {
              parametricCoordinate: TParametric2D;
              lattice: TFfdLattice;
          }
        | undefined;
    private latticePath: Path2D | undefined;

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
                this.onGoMoveSelect(cursorCanvasPos, this.easel.keyListener.isPressed('shift'));
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
                    this.onGoSelect(cursorCanvasPos, this.easel.keyListener.isPressed('shift'));
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
        if (!this.transformation || this.transformation.type !== 'ffd' || !this.ffdMesh) {
            this.easel.setCursor('default');
            // handled via this.freeTransform
            return;
        }

        // warping
        const cursorCanvasPos = this.viewportToCanvas({ x: event.relX, y: event.relY });
        const parametricCoordinate = findParametricCoordinate(
            cursorCanvasPos.x,
            cursorCanvasPos.y,
            this.ffdMesh,
        );
        if (event.type === 'pointerdown' && event.button === 'left') {
            if (parametricCoordinate) {
                this.warpStart = {
                    parametricCoordinate,
                    lattice: this.transformation.ffd,
                };
                this.easel.setCursor('move');
            }
        }
        if (event.type === 'pointermove' && this.warpStart) {
            // Apply warp
            this.transformation.ffd = warpLatticeViaPoint(
                this.warpStart.parametricCoordinate,
                cursorCanvasPos,
                this.warpStart.lattice,
            );
            const { width, height } = this.easel.getProjectSize();
            this.ffdMesh = createFfdMesh(
                RENDERED_FFD_MESH_RESOLUTION,
                RENDERED_FFD_MESH_RESOLUTION,
                this.transformation.ffd,
                width,
                height,
                true,
            );
            this.updateLatticePath();
            this.easel.requestRender();
            this.onTransform(this.transformation);
        }
        if (event.type === 'pointerup') {
            if (this.warpStart) {
                this.onTransformEnd();
            }
            this.warpStart = undefined;
        }
        if (!this.warpStart) {
            // Update cursor if not already dragging
            this.easel.setCursor(parametricCoordinate ? 'move' : 'default');
        }
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
                if (
                    this.mode === 'select' ||
                    !this.transformation ||
                    !(
                        this.transformation.type === 'free' ||
                        this.transformation.type === 'ffd+free'
                    )
                ) {
                    return;
                }
                if (
                    isNaN(transform.x) ||
                    isNaN(transform.y) ||
                    isNaN(transform.width) ||
                    isNaN(transform.height)
                ) {
                    //can be provoked by repeatedly x0.5, then dragging a corner
                    return;
                }
                this.onTransform({
                    ...this.transformation,
                    freeTransform: transform,
                });
                // avoid spamming undo steps
                if (this.freeTransformTimeout) {
                    clearTimeout(this.freeTransformTimeout);
                }
                this.freeTransformTimeout = setTimeout(() => this.onTransformEnd(), 250);
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

    private updateFreeTransformVisibility(): void {
        this.freeTransform
            ?.getElement()
            .style.setProperty('display', this.transformation?.type === 'ffd' ? 'none' : '');
    }

    private updateLatticePath(): void {
        if (!this.transformation || this.transformation.type !== 'ffd') {
            this.latticePath = undefined;
            return;
        }

        const lattice = this.transformation.ffd;
        const sampleCount = RENDERED_FFD_MESH_RESOLUTION;
        const path = new Path2D();

        function addPolyline(path: Path2D, points: TVector2D[]): void {
            path.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                path.lineTo(points[i].x, points[i].y);
            }
        }

        // horizontal lines
        for (let i = 0; i < lattice.rows; i++) {
            const t = i / (lattice.rows - 1);
            const pts: TVector2D[] = [];
            for (let e = 0; e <= sampleCount; e++) {
                pts.push(evalFFD(e / sampleCount, t, lattice));
            }
            addPolyline(path, pts);
        }

        // vertical lines
        for (let i = 0; i < lattice.cols; i++) {
            const s = i / (lattice.cols - 1);
            const pts: TVector2D[] = [];
            for (let e = 0; e <= sampleCount; e++) {
                pts.push(evalFFD(s, e / sampleCount, lattice));
            }
            addPolyline(path, pts);
        }

        this.latticePath = path;
    }

    private renderLattice(ctx: CanvasRenderingContext2D, scale: number): void {
        if (!this.latticePath) {
            return;
        }

        ctx.save();
        ctx.lineWidth = 1 / scale;
        // globalCompositeOperation = 'difference' is slow in firefox,
        // and it doesn't look all that nice in any browser.
        ctx.strokeStyle = 'rgb(128, 128, 128)';
        ctx.stroke(this.latticePath);
        if (FFD_DEBUG && this.transformation?.type === 'ffd') {
            const lattice = this.transformation.ffd;
            for (let i = 0; i < lattice.rows; i++) {
                for (let j = 0; j < lattice.cols; j++) {
                    const cp = lattice.controlPoints[i][j];
                    ctx.beginPath();
                    ctx.arc(cp.x, cp.y, 4 / scale, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.lineWidth = 1.5 / scale;
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
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
        this.onTransform = p.onTransform;
        this.onTransformEnd = p.onTransformEnd;

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
            this.ffdMesh = undefined;
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
        if (cursorPos && this.transformation && this.ffdMesh) {
            const cursorCanvasPos = this.viewportToCanvas(cursorPos);
            const param = findParametricCoordinate(
                cursorCanvasPos.x,
                cursorCanvasPos.y,
                this.ffdMesh,
            );
            this.easel.setCursor(param ? 'move' : 'default');
        } else {
            this.easel.setCursor('default');
        }
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

    private bringTransformRectIntoView(freeTransform: TFreeTransform): void {
        const viewportTransform = this.easel.getTransform();
        const easelSize = this.easel.getSize();
        const padding = 40;
        const rect = {
            x: freeTransform.x - freeTransform.width / 2,
            y: freeTransform.y - freeTransform.height / 2,
            width: freeTransform.width,
            height: freeTransform.height,
        };
        if (checkRectFullyVisible(rect, viewportTransform, easelSize, 0)) {
            return;
        }
        // Don't zoom in further than we are currently. It's less annoying.
        const maxScale = Math.max(viewportTransform.scale, 1);
        this.easel.setTransform(
            getFitRectTransform(rect, viewportTransform, easelSize, false, padding, maxScale),
        );
    }

    initialiseTransform(transform: TComposedTransformation): void {
        transform = BB.copyObj(transform);
        if (transform.type !== 'free') {
            throw new Error('must call initialiseTransform with transform.type = "free"');
        }
        this.transformation = transform;
        this.freeTransform?.initialise(transform.freeTransform);
        const { width, height } = this.easel.getProjectSize();
        this.freeTransform?.setSnappingPoints([0, width], [0, height]);
        this.bringTransformRectIntoView(transform.freeTransform);
    }

    setTransform(transform: TComposedTransformation): void {
        transform = BB.copyObj(transform);
        this.transformation = transform;
        if (transform.type === 'ffd') {
            const { width, height } = this.easel.getProjectSize();
            this.ffdMesh = createFfdMesh(
                RENDERED_FFD_MESH_RESOLUTION,
                RENDERED_FFD_MESH_RESOLUTION,
                transform.ffd,
                width,
                height,
                true,
            );
            this.easel.requestRender();
        } else {
            this.freeTransform?.initialise(transform.freeTransform);
            this.ffdMesh = undefined;
        }
        this.updateLatticePath();
        this.updateFreeTransformVisibility();
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
        if (this.mode === 'transform' && this.transformation?.type === 'ffd') {
            ctx.save();
            this.renderLattice(ctx, transform.scaleX);
            ctx.restore();
        }

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
        const movementMap: Record<TArrowKey, TVector2D> = {
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 },
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
        };
        const multiplier = this.easel.isKeyPressed('shift') ? 5 : 1;
        const movement = movementMap[direction];
        this.freeTransform.move(movement.x * multiplier, movement.y * multiplier);
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
}
