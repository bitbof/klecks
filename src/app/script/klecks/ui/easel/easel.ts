import { c } from '../../../bb/base/c';
import { ProjectViewport, TViewportTransform } from '../project-viewport/project-viewport';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { BB } from '../../../bb/bb';
import { toMetaTransform } from '../../../bb/transform/to-meta-transform';
import { createTransform } from '../../../bb/transform/create-transform';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import { EaselPointerPreprocessor } from './easel-pointer-preprocessor';
import { KeyListener } from '../../../bb/input/key-listener';
import {
    TArrowKey,
    TEaselInterface,
    TEaselProject,
    TEaselTool,
    TEaselToolTrigger,
} from './easel.types';
import { IBounds, IVector2D } from '../../../bb/bb-types';
import { zoomByStep } from '../project-viewport/utils/zoom-by-step';
import { SelectionRenderer } from './selection-renderer';
import { TVec4 } from '../../../bb/math/matrix';
import { klConfig } from '../../kl-config';
import { minimizeAngleDeg, snapAngleDeg } from '../../../bb/math/math';
import {
    defaultDoubleTapPointerTypes,
    EASEL_MAX_SCALE,
    EASEL_MIN_SCALE,
    TEMP_TRIGGERS,
    TEMP_TRIGGERS_KEYS,
} from './easel.config';
import { isTransformEqual } from '../project-viewport/utils/is-transform-equal';
import { blendTransform } from '../project-viewport/utils/blend-transform';

function getToolEntries<GToolId extends string>(
    tools: Record<GToolId, TEaselTool>,
): [GToolId, TEaselTool][] {
    return Object.entries(tools) as [GToolId, TEaselTool][];
}

export type TEaselParams<GToolId extends string> = {
    width: number; // size of DOM element
    height: number; // size of DOM element
    project: TEaselProject;
    tools: Record<GToolId, TEaselTool>;
    tool: NoInfer<GToolId>;
    onTransformChange: (transform: TViewportTransform, scaleOrAngleChanged: boolean) => void; // whenever Viewport changes
    onUndo?: () => void; // gesture triggers undo
    onRedo?: () => void; // gesture triggers redo
};

/**
 * An interactive project viewport, that also renders the selection. You interact with it through modes (aka tools).
 * One tool is active at a time. temp trigger can overwrite it temporarily.
 */
export class Easel<GToolId extends string> {
    private readonly rootEl: HTMLElement;
    private readonly svgEl: SVGElement; // each tool gets an element in this SVG tag, for an SVG overlay
    private readonly viewport: ProjectViewport;
    private readonly pointerPreprocessor: EaselPointerPreprocessor;
    private readonly pointerListener: PointerListener;
    private readonly windowPointerListener: (e: PointerEvent) => void;
    private readonly keyListener: KeyListener;
    private readonly selectionRenderer: SelectionRenderer;

    // from params
    private readonly toolsMap: TEaselParams<GToolId>['tools'];
    // temp tool is tool that is active during holding a key or mouse button (e.g. hold space -> hand tool)
    private readonly tempTools: Record<TEaselToolTrigger, GToolId | undefined>;
    private readonly onTransformChange: (
        transform: TViewportTransform,
        scaleOrAngleChanged: boolean,
    ) => void;
    private readonly onUndo: (() => void) | undefined;
    private readonly onRedo: (() => void) | undefined;

    // state
    private project: TEaselProject;
    private width: number;
    private height: number;
    private tool: GToolId;
    private tempTool: GToolId | undefined;
    private animationFrameId: ReturnType<typeof requestAnimationFrame> | undefined;
    private doRender = false; // true -> will render on next renderLoop
    private cursorPos: IVector2D | undefined; // so brush cursor not top left corner after reload
    private isFrozen: boolean = false; // disable interaction with the easel whatsoever
    private lastRenderedTransform: TViewportTransform = {} as TViewportTransform; // previously rendered viewport transformation
    private pinchInitialTransform: TViewportTransform | undefined; // when starting a pinch-to-zoom gesture
    private targetTransform: TViewportTransform = {} as TViewportTransform;

    // custom interface passed to tools
    private readonly easelInterface: TEaselInterface = {
        setCursor: (cursor) => (this.rootEl.style.cursor = cursor),
        getTransform: () => this.viewport.getTransform(),
        getTargetTransform: () => this.targetTransform,
        getSize: () => ({ width: this.width, height: this.height }),
        getProjectSize: () => ({ width: this.project.width, height: this.project.height }),
        setTransform: (transform, isImmediate) => this.setTargetTransform(transform, isImmediate),
        requestRender: () => this.requestRender(),
        isKeyPressed: (keyStr) => this.keyListener.isPressed(keyStr),
        minScale: EASEL_MIN_SCALE,
        maxScale: EASEL_MAX_SCALE,
        setAngleDeg: (...args) => this.setAngleDeg(...args),
        keyListener: {} as KeyListener, // this.keyListener
        updateDoubleTapPointerTypes: () => this.updateDoubleTapPointerTypes(),
        setRenderedSelection: (selection) => this.selectionRenderer.setRenderedSelection(selection),
        clearRenderedSelection: (isImmediate) =>
            this.selectionRenderer.clearRenderedSelection(isImmediate),
    };

    private setTargetTransform(transform: TViewportTransform, isImmediate?: boolean): void {
        if (isImmediate) {
            this.viewport.setTransform(transform);
        }
        this.targetTransform = transform;
        this.doRender = true;
    }

    private updateToolSvgs(): void {
        const tool = this.tempTool ?? this.tool;
        Object.keys(this.toolsMap).forEach((toolId) => {
            this.toolsMap[toolId as GToolId].getSvgElement().style.display =
                toolId === tool ? '' : 'none';
        });
    }

    // different tools allow different pointer types to trigger the gesture
    private updateDoubleTapPointerTypes(): void {
        const pointerTypes =
            this.toolsMap[this.tempTool ?? this.tool].doubleTapPointerTypes ??
            defaultDoubleTapPointerTypes;
        this.pointerPreprocessor.setDoubleTapPointerTypes(pointerTypes);
    }

    private lastFrameTimestamp: number = 0;
    /**
     * Only call once from outside. Will perpetuate itself and render when doRender = true
     */
    private renderLoop(): void {
        const now = performance.now();
        const deltaMs = now - this.lastFrameTimestamp;
        this.lastFrameTimestamp = now;
        this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
        if (!this.doRender) {
            return;
        }
        const tool = this.getActiveTool();
        const oldTransform = this.viewport.getTransform();
        let newTransform = oldTransform;
        if (isTransformEqual(oldTransform, this.targetTransform)) {
            this.doRender = false;
        } else {
            const defaultDeltaMs = 1000 / 60;
            const timeFactor = deltaMs / defaultDeltaMs;
            const easeFactor = 1 - 0.7 ** timeFactor;

            newTransform = blendTransform(
                oldTransform,
                this.targetTransform,
                {
                    width: this.project.width,
                    height: this.project.height,
                },
                {
                    x: this.width / 2,
                    y: this.height / 2,
                },
                easeFactor,
            );
            this.viewport.setTransform(newTransform);
        }

        // todo: is last renderedTransform needed?

        const isPositionChanged =
            newTransform.x !== this.lastRenderedTransform.x ||
            newTransform.y !== this.lastRenderedTransform.y;
        const isScaleOrAngleChanged =
            newTransform.scale !== this.lastRenderedTransform.scale ||
            newTransform.angleDeg !== this.lastRenderedTransform.angleDeg;

        this.viewport.render(!isTransformEqual(oldTransform, newTransform));
        if (isPositionChanged || isScaleOrAngleChanged) {
            tool.onUpdateTransform?.(newTransform);
            this.selectionRenderer.setTransform(newTransform);
            this.onTransformChange(this.targetTransform, isScaleOrAngleChanged);
            this.lastRenderedTransform = newTransform;
        }
    }

    /**
     * activate temporary tool. Can only push one.
     */
    private pushTempTool(toolId: GToolId | undefined): void {
        if (this.tempTool !== undefined || toolId === undefined) {
            return;
        }
        const tool = this.toolsMap[this.tool];
        if (tool.getIsLocked?.()) {
            return;
        }

        this.tempTool = toolId;
        this.getActiveTool().activate?.(this.cursorPos);
        this.updateToolSvgs();
        this.updateDoubleTapPointerTypes();
    }

    /**
     * Turn off temporary tool
     */
    private popTempTool(toolId: GToolId | undefined): void {
        if (this.tempTool !== toolId || toolId === undefined) {
            return;
        }
        this.tempTool = undefined;
        this.getActiveTool().activate?.(this.cursorPos, true);
        this.updateToolSvgs();
        this.updateDoubleTapPointerTypes();
    }

    private getActiveTool(): TEaselTool {
        return this.toolsMap[this.tempTool ?? this.tool];
    }

    private getResetTransform(): TViewportTransform {
        return createTransform(
            {
                x: this.width / 2,
                y: this.height / 2,
            },
            { x: this.project.width / 2, y: this.project.height / 2 },
            1,
            0,
        );
    }

    private getFitTransform(): TViewportTransform {
        const oldTransform = this.viewport.getTransform();
        // rotate
        let newAngleDeg = oldTransform.angleDeg;
        if (newAngleDeg === 45) {
            // would otherwise get rounded to 90
            newAngleDeg = 0;
        }
        newAngleDeg = snapAngleDeg(newAngleDeg, 90, 90);

        //calc width and height of bounds
        const projectWidth = this.project.width;
        const projectHeight = this.project.height;
        const canvasPointsArr = [
            [0, 0], // top left
            [projectWidth, 0], // top right
            [projectWidth, projectHeight], // bottom right
            [0, projectHeight], // bottom left
            [projectWidth / 2, projectHeight / 2], // center
        ];

        //setup transformation matrix
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(
            matrix,
            BB.Matrix.createRotationMatrix((newAngleDeg / 180) * Math.PI),
        );

        //rotate points
        for (let i = 0; i < canvasPointsArr.length; i++) {
            let coords: TVec4 = [canvasPointsArr[i][0], canvasPointsArr[i][1], 0, 1];
            coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
            canvasPointsArr[i][0] = coords[0];
            canvasPointsArr[i][1] = coords[1];
        }

        const boundsObj: Partial<IBounds> = {};
        for (let i = 0; i < canvasPointsArr.length; i++) {
            if (boundsObj.x1 === undefined || canvasPointsArr[i][0] < boundsObj.x1) {
                boundsObj.x1 = canvasPointsArr[i][0];
            }
            if (boundsObj.y1 === undefined || canvasPointsArr[i][1] < boundsObj.y1) {
                boundsObj.y1 = canvasPointsArr[i][1];
            }
            if (boundsObj.x2 === undefined || canvasPointsArr[i][0] > boundsObj.x2) {
                boundsObj.x2 = canvasPointsArr[i][0];
            }
            if (boundsObj.y2 === undefined || canvasPointsArr[i][1] > boundsObj.y2) {
                boundsObj.y2 = canvasPointsArr[i][1];
            }
        }
        const boundsWidth = boundsObj.x2! - boundsObj.x1!;
        const boundsHeight = boundsObj.y2! - boundsObj.y1!;

        //fit bounds
        const padding = 0;
        const { width: fitWidth } = BB.fitInto(
            boundsWidth,
            boundsHeight,
            this.width - padding,
            this.height - padding,
            1,
        );

        //determine scale
        const factor = Math.min(EASEL_MAX_SCALE, fitWidth / boundsWidth);

        const viewportRect = { width: this.width, height: this.height };
        const viewportCenterP = {
            x: viewportRect.width / 2,
            y: viewportRect.height / 2,
        };
        return createTransform(
            viewportCenterP,
            { x: projectWidth / 2, y: projectHeight / 2 },
            factor,
            newAngleDeg,
        );
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselParams<GToolId>) {
        this.project = p.project;
        this.width = p.width;
        this.height = p.height;
        this.tool = p.tool;
        this.toolsMap = { ...p.tools };
        this.onTransformChange = p.onTransformChange;
        this.onUndo = p.onUndo;
        this.onRedo = p.onRedo;

        this.tempTools = Object.fromEntries(
            TEMP_TRIGGERS.map((trigger) => {
                return [
                    trigger,
                    getToolEntries(this.toolsMap)
                        .filter(([toolName, tool]) => {
                            return tool.tempTriggers && tool.tempTriggers.includes(trigger);
                        })
                        .map((i) => i[0])[0],
                ];
            }),
        ) as Record<TEaselToolTrigger, GToolId | undefined>;

        this.viewport = new ProjectViewport({
            width: this.width,
            height: this.height,
            project: {
                width: this.project.width,
                height: this.project.height,
                layers: this.project.layers,
            },
            transform: this.getResetTransform(),
            renderAfter: (ctx, renderedTransform) => {
                const tool = this.getActiveTool();
                tool.renderAfterViewport?.(ctx, renderedTransform);
            },
        });

        Object.values<TEaselTool>(this.toolsMap).forEach((tool) => {
            tool.setEaselInterface?.(this.easelInterface);
            tool.onResize?.(this.width, this.height);
        });

        let mouseMiddleIsDown = false;
        let mouseRightIsDown = false;

        let angleIsExtraSticky = false;
        this.pointerPreprocessor = new EaselPointerPreprocessor({
            onUndo: this.onUndo,
            onRedo: this.onRedo,
            onPinch: (event) => {
                if (event.type === 'move') {
                    const transform = this.viewport.getTransform();
                    if (!this.pinchInitialTransform) {
                        this.pinchInitialTransform = BB.copyObj(transform);
                        angleIsExtraSticky = this.pinchInitialTransform.angleDeg % 180 === 0;
                    }

                    let newAngleDeg =
                        this.pinchInitialTransform.angleDeg + (event.angleRad / Math.PI) * 180;
                    newAngleDeg = minimizeAngleDeg(
                        snapAngleDeg(newAngleDeg, 90, angleIsExtraSticky ? 12 : 4),
                    );
                    if (newAngleDeg % 90 !== 0) {
                        angleIsExtraSticky = false;
                    }

                    const metaTransform = toMetaTransform(this.pinchInitialTransform, {
                        x: event.downRelX,
                        y: event.downRelY,
                    });
                    metaTransform.scale = BB.clamp(
                        this.pinchInitialTransform.scale * event.scale,
                        EASEL_MIN_SCALE,
                        EASEL_MAX_SCALE,
                    );
                    metaTransform.viewportP.x += event.relX - event.downRelX;
                    metaTransform.viewportP.y += event.relY - event.downRelY;
                    metaTransform.angleDeg = newAngleDeg;

                    this.setTargetTransform(
                        createTransform(
                            metaTransform.viewportP,
                            metaTransform.canvasP,
                            metaTransform.scale,
                            metaTransform.angleDeg,
                        ),
                        true,
                    );
                    this.requestRender();
                } else if (event.type === 'end') {
                    this.pinchInitialTransform = undefined;
                }
            },
            onDoubleTap: (e) => {
                if (this.fitTransform()) {
                    this.requestRender();
                } else {
                    this.scale(2, e.relX, e.relY);
                }
            },
            onChainOut: (e) => {
                this.cursorPos = {
                    x: e.relX,
                    y: e.relY,
                };
                if (e.type === 'pointerdown') {
                    if (e.button === 'middle') {
                        mouseMiddleIsDown = true;
                        this.pushTempTool(this.tempTools['mouse-middle']);
                    }
                    if (e.button === 'right') {
                        mouseRightIsDown = true;
                        this.pushTempTool(this.tempTools['mouse-right']);
                    }
                } else if (e.type === 'pointermove') {
                    // noop?
                } else if (e.type === 'pointerup') {
                    if (mouseMiddleIsDown) {
                        mouseMiddleIsDown = false;
                        this.getActiveTool().onPointer(e);
                        this.popTempTool(this.tempTools['mouse-middle']);
                        return;
                    }
                    if (mouseRightIsDown) {
                        mouseRightIsDown = false;
                        this.getActiveTool().onPointer(e);
                        this.popTempTool(this.tempTools['mouse-right']);
                        return;
                    }
                }
                this.getActiveTool().onPointer(e);
            },
        });
        /*
        // My trackpad pinching (via PointerListener) doesn't currently work with Safari on macOS.
        // So I tried GestureListener, which works, but doesn't mesh well with the other event listeners.
        let lastScale = 0;
        this.gestureListener = new GestureListener({
            target: this.viewport.getElement(),
            onStart: (e) => {
                lastScale = e.scale;
            },
            onChange: (e) => {
                const deltaScale = e.scale / lastScale;
                lastScale = e.scale;

                // zoom
                const transform = this.viewport.getTransform();
                const viewportPoint = {
                    x: e.layerX,
                    y: e.layerY,
                };
                const mat = createMatrixFromTransform(transform);
                const canvasPoint = applyToPoint(inverse(mat), viewportPoint);
                const newScale = BB.clamp(
                    transform.scale * deltaScale,
                    EASEL_MIN_SCALE,
                    EASEL_MAX_SCALE,
                );
                this.setTransform(
                    createTransform(viewportPoint, canvasPoint, newScale, transform.angleDeg),
                );
                this.requestRender();
            },
        });*/

        this.pointerListener = new PointerListener({
            target: this.viewport.getElement(),
            onPointer: (e) => {
                this.pointerPreprocessor.chainIn(e);
            },
            onWheel: (e) => {
                e.event?.preventDefault();
                let isImmediate = false;
                if (Math.abs(e.deltaY) < 0.8) {
                    isImmediate = true;
                }
                if (e.event && e.event.ctrlKey && !this.keyListener.isPressed('ctrl')) {
                    isImmediate = true;
                    let factor = 1;
                    if (e.event.deltaMode === 0) {
                        factor = 6;
                    }
                    e.deltaY *= factor;
                }
                if (this.keyListener.isPressed('shift')) {
                    e.deltaY /= 4;
                }

                // zoom
                const transform = this.targetTransform;
                const viewportPoint = {
                    x: e.relX,
                    y: e.relY,
                };
                const mat = createMatrixFromTransform(transform);
                const canvasPoint = applyToPoint(inverse(mat), viewportPoint);
                const newScale = BB.clamp(
                    transform.scale * Math.pow(1 + 4 / 10, -e.deltaY),
                    EASEL_MIN_SCALE,
                    EASEL_MAX_SCALE,
                );
                this.setTargetTransform(
                    createTransform(viewportPoint, canvasPoint, newScale, transform.angleDeg),
                    isImmediate,
                );
            },
            onEnterLeave: (isOver) => {
                const tool = this.getActiveTool();
                if (!isOver) {
                    this.cursorPos = undefined;
                    tool.onPointerLeave?.();
                }
            },
            useDirtyWheel: true,
            isWheelPassive: false,
            maxPointers: 3, // 3 fingers needed for redo gesture
        });

        this.windowPointerListener = (e: PointerEvent) => {
            if (this.isFrozen) {
                return;
            }
            if (!this.rootEl.contains(e.target as Node)) {
                this.getActiveTool().onClickOutside?.();
            }
        };
        window.addEventListener('pointerdown', this.windowPointerListener);

        this.keyListener = new KeyListener({
            onDown: (keyStr, e, comboStr, isRepeat) => {
                if (this.isFrozen) {
                    return;
                }

                if (comboStr === 'plus') {
                    const oldScale = this.getTransform().scale;
                    const newScale = zoomByStep(
                        oldScale,
                        this.keyListener.isPressed('shift') ? 1 / 8 : 1 / 2,
                    );
                    this.scale(newScale / oldScale);
                }
                if (comboStr === 'minus') {
                    const oldScale = this.getTransform().scale;
                    const newScale = zoomByStep(
                        oldScale,
                        this.keyListener.isPressed('shift') ? -1 / 8 : -1 / 2,
                    );
                    this.scale(newScale / oldScale);
                }
                if (this.keyListener.comboOnlyContains(['left', 'right', 'up', 'down'])) {
                    const activeTool = this.getActiveTool();
                    if (!activeTool.onArrowKeys?.(keyStr as TArrowKey)) {
                        const stepSize = 40;
                        if (keyStr === 'left') {
                            this.translate(stepSize, 0);
                        }
                        if (keyStr === 'right') {
                            this.translate(-stepSize, 0);
                        }
                        if (keyStr === 'up') {
                            this.translate(0, stepSize);
                        }
                        if (keyStr === 'down') {
                            this.translate(0, -stepSize);
                        }
                    }
                }

                // activate temporary tool
                TEMP_TRIGGERS_KEYS.forEach((keyTrigger) => {
                    if (
                        comboStr === keyTrigger &&
                        this.toolsMap[this.tool].blockTrigger !== keyTrigger
                    ) {
                        this.pushTempTool(this.tempTools[keyTrigger]);
                    }
                });
                const tool = this.toolsMap[this.tempTool ?? this.tool];
                tool.onKeyDown?.(keyStr, e, comboStr, isRepeat);
            },
            onUp: (keyStr, e, oldComboStr) => {
                if (this.isFrozen) {
                    return;
                }

                // turn off temporary tool again
                TEMP_TRIGGERS_KEYS.forEach((keyTrigger) => {
                    if (
                        keyStr === keyTrigger &&
                        this.toolsMap[this.tool].blockTrigger !== keyTrigger
                    ) {
                        this.popTempTool(this.tempTools[keyTrigger]);
                    }
                });
                const tool = this.toolsMap[this.tempTool ?? this.tool];
                tool.onKeyUp?.(keyStr, e, oldComboStr);
            },
            onBlur: () => {
                const tool = this.toolsMap[this.tempTool ?? this.tool];
                tool.onBlur?.();
            },
        });
        this.easelInterface.keyListener = this.keyListener;

        this.selectionRenderer = new SelectionRenderer({
            transform: this.viewport.getTransform(),
            selection: this.project.selection,
            width: this.width,
            height: this.height,
        });

        this.svgEl = BB.createSvg({
            elementType: 'svg',
            width: '' + this.width,
            height: '' + this.height,
        });
        BB.css(this.svgEl, {
            position: 'absolute',
            left: '0',
            top: '0',
            pointerEvents: 'none',
        });
        this.svgEl.append(
            this.selectionRenderer.getElement(),
            ...Object.values<TEaselTool>(this.toolsMap).map((item) => item.getSvgElement()),
        );
        this.updateToolSvgs();

        this.rootEl = c(
            {
                css: {
                    userSelect: 'none',
                    touchAction: 'none',
                    overscrollBehaviorX: 'none',
                },
            },
            [this.viewport.getElement(), this.svgEl],
        );

        // prevent contextmenu
        this.rootEl.addEventListener(
            'contextmenu',
            (e) => {
                e.preventDefault();
                return false;
            },
            { passive: false },
        );

        // Carried over from old KlCanvasWorkspace. Prevent some default browser behavior. Todo what breaks if removed?
        this.rootEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            return false;
        });
        // Carried over from old KlCanvasWorkspace. Prevent some default browser behavior. Todo what breaks if removed?
        this.rootEl.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        this.toolsMap[this.tool].activate?.(this.cursorPos);
        this.renderLoop();
    }

    /** update and render */
    setProject(project: TEaselProject): void {
        this.project = project;
        this.viewport.setProject({
            width: this.project.width,
            height: this.project.height,
            layers: this.project.layers,
        });
        this.selectionRenderer.setSelection(this.project.selection);
        this.getActiveTool().onUpdateSelection?.(this.project.selection);
        this.requestRender();
    }

    /** update and render */
    setSize(width: number, height: number): void {
        const m = createMatrixFromTransform(this.viewport.getTransform());
        const canvasCenterPoint = applyToPoint(inverse(m), {
            x: this.width / 2,
            y: this.height / 2,
        });

        this.width = width;
        this.height = height;
        BB.setAttributes(this.svgEl, {
            width: '' + this.width,
            height: '' + this.height,
        });
        this.selectionRenderer.setSize(width, height);
        this.getActiveTool().onResize?.(width, height);
        this.viewport.setSize(width, height);
        const transform = this.viewport.getTransform();
        this.setTargetTransform(
            createTransform(
                {
                    x: this.width / 2,
                    y: this.height / 2,
                },
                canvasCenterPoint,
                transform.scale,
                transform.angleDeg,
            ),
            true,
        );

        this.requestRender();
    }

    requestRender(): void {
        this.doRender = true;
    }

    getTransform(): TViewportTransform {
        return this.viewport.getTransform();
    }

    setTransform(transform: TViewportTransform): void {
        this.setTargetTransform(transform, true);
    }

    setTool(toolId: GToolId): void {
        if (toolId === this.tool) {
            return;
        }
        this.tool = toolId;
        this.toolsMap[this.tool].activate?.(this.cursorPos);
        this.updateToolSvgs();
        this.updateDoubleTapPointerTypes();
        this.requestRender();
    }

    getTool(): GToolId {
        return this.tool;
    }

    translate(dX: number, dY: number): void {
        const transform = this.targetTransform;
        this.setTargetTransform({
            ...transform,
            x: transform.x + dX,
            y: transform.y + dY,
        });
    }

    scale(factor: number, viewportX?: number, viewportY?: number): void {
        const before = this.targetTransform;
        const viewportRect = { width: this.width, height: this.height };
        viewportX = viewportX ?? viewportRect.width / 2;
        viewportY = viewportY ?? viewportRect.height / 2;

        const metaTransform = toMetaTransform(before, { x: viewportX, y: viewportY });
        metaTransform.scale = BB.clamp(
            metaTransform.scale * factor,
            EASEL_MIN_SCALE,
            EASEL_MAX_SCALE,
        );

        this.setTargetTransform(
            createTransform(
                metaTransform.viewportP,
                metaTransform.canvasP,
                metaTransform.scale,
                metaTransform.angleDeg,
            ),
        );
    }

    resetTransform(isImmediate?: boolean): void {
        const transform = this.getResetTransform();
        this.setTargetTransform(transform, isImmediate);
        this.requestRender();
    }

    fitTransform(isImmediate?: boolean): boolean {
        const oldTransform = this.viewport.getTransform();
        const transform = this.getFitTransform();

        const isPositionChanged = transform.x !== oldTransform.x || transform.y !== oldTransform.y;
        const isScaleOrAngleChanged =
            transform.scale !== oldTransform.scale || transform.angleDeg !== oldTransform.angleDeg;

        if (!isPositionChanged && !isScaleOrAngleChanged) {
            return false;
        }

        this.setTargetTransform(transform, isImmediate);
        return true;
    }

    /**
     * Automatically decide what is best. E.g. if it's pixel art, Fit might be better.
     */
    resetOrFitTransform(isImmediate?: boolean): void {
        const threshold = 4; // >= 400% zoom. pixelated, not blurry
        if (
            !klConfig.disableAutoFit &&
            this.project.width <= this.width / threshold &&
            this.project.height <= this.height / threshold
        ) {
            this.fitTransform(isImmediate);
        } else {
            this.resetTransform(isImmediate);
        }
    }

    setAngleDeg(angleDeg: number, isRelative: undefined | boolean) {
        const viewportTransform = this.targetTransform;
        const viewportMat = createMatrixFromTransform(viewportTransform);
        const viewportRect = { width: this.width, height: this.height };
        const viewportCenterP = {
            x: viewportRect.width / 2,
            y: viewportRect.height / 2,
        };
        const newAngleDeg = minimizeAngleDeg(
            isRelative ? viewportTransform.angleDeg + angleDeg : angleDeg,
        );

        const newViewportTransform = createTransform(
            viewportCenterP,
            applyToPoint(inverse(viewportMat), viewportCenterP),
            viewportTransform.scale,
            newAngleDeg,
        );
        this.setTargetTransform(newViewportTransform);
    }

    getIsLocked(): boolean {
        return this.getActiveTool().getIsLocked?.() ?? false;
    }

    setIsFrozen(b: boolean): void {
        this.isFrozen = b;
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.viewport.destroy();
        this.pointerListener.destroy();
        this.keyListener.destroy();
        this.animationFrameId !== undefined && cancelAnimationFrame(this.animationFrameId);
        this.selectionRenderer.destroy();
        window.removeEventListener('pointerdown', this.windowPointerListener);
    }
}
