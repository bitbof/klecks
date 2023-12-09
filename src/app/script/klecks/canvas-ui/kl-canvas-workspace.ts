import {BB} from '../../bb/bb';
import {IRGB, ITransform, TDrawEvent} from '../kl-types';
import {WorkspaceSvgOverlay} from './workspace-svg-overlay';
import {klHistory} from '../history/kl-history';
import pickerImg from '/src/app/img/ui/cursor-picker.png';
import zoomEwImg from '/src/app/img/ui/cursor-zoom-ew.png';
import fillImg from '/src/app/img/ui/cursor-fill.png';
import textImg from '/src/app/img/ui/cursor-text.png';
import {IBounds, IPressureInput, IVector2D} from '../../bb/bb-types';
import {KlCanvas} from '../canvas/kl-canvas';
import {KeyListener, TOnKeyDown, TOnKeyUp} from '../../bb/input/key-listener';
import {KL} from '../kl';
import {LinetoolProcessor} from '../events/linetool-processor';
import {PinchZoomer} from '../../bb/input/event-chain/pinch-zoomer';
import {DoubleTapper, IDoubleTapperEvent} from '../../bb/input/event-chain/double-tapper';
import {NFingerTapper} from '../../bb/input/event-chain/n-finger-tapper';
import {EventChain} from '../../bb/input/event-chain/event-chain';
import {PointerListener} from '../../bb/input/pointer-listener';
import {theme} from '../../theme/theme';
import {TVec4} from '../../bb/math/matrix';
import {IChainElement} from '../../bb/input/event-chain/event-chain.types';
import {ICoalescedPointerEvent} from '../../bb/input/event-chain/coalesced-exploder';
import {klConfig} from '../kl-config';

export interface IViewChangeEvent {
    changed: ('scale' | 'angle')[];
    angle: number;
    scale: number;
}

type TModeStr = 'draw' | 'pick' | 'hand' | 'shape' | 'fill' | 'gradient' | 'text'; // | 'transform' | 'select'

type TInputProcessorKeys = |
    'draw' |
    'fill' |
    'gradient' |
    'text' |
    'shape' |
    'hand' |
    'spaceHand' |
    'zoom' |
    'picker' |
    'altPicker' |
    'rotate';

type TInputProcessorItem = {
    onPointer: (val: ICoalescedPointerEvent) => void;
    onKeyDown: TOnKeyDown;
    onKeyUp: TOnKeyUp;
}

const MIN_SCALE = 1 / 16;
const MAX_SCALE = Math.pow(2, 7);
enum TMode {
    Draw,
    Hand,
    HandGrabbing,
    Pick,
    Zoom,
    Rotate,
    Rotating,
    Fill,
    Gradient,
    Text,
    Shape,
}
const ANIMATION_SPEED = 0.3; // rate of transition towards targetTransform

/**
 * Work area that displays the KlCanvas.
 * - pan, zoom, rotate (also via multi-touch)
 * - input modes: drawing, hand, pick, fill, text // transform, select
 * - drawing input events
 * - view change events
 * - eyedropper input events (pick)
 * - draws cursor, eyedropper overlay
 *
 * subscribes to klCanvas changes
 * listens to kl history for changes
 * and you can manually trigger redraw
 */
export class KlCanvasWorkspace {

    private readonly rootEl: HTMLElement;
    private klCanvas: KlCanvas;
    private readonly renderTargetCanvas: HTMLCanvasElement;
    private readonly renderTargetCtx: CanvasRenderingContext2D;
    private renderWidth: number;
    private renderHeight: number;
    private readonly compositeCanvas: HTMLCanvasElement; // for drawing klcanvas layer composite
    private readonly compositeCtx: CanvasRenderingContext2D;
    private doResizeCanvas: boolean;
    private oldTransformObj: ITransform | null;
    private targetTransformObj: ITransform; // animation target
    private highResTransformObj: ITransform; // animated, internal high-res
    private readonly renderedTransformObj: ITransform; // same as highRes, but rounded - what's actually displayed
    private cursorPos: IVector2D;
    private readonly usesCssCursor: boolean;
    private bgVisible: boolean;
    private transformIsDirty: boolean;
    private doAnimateTranslate: boolean;
    private svgOverlay: WorkspaceSvgOverlay;
    private readonly emptyCanvas: HTMLCanvasElement;
    private readonly emptyLightCanvas: HTMLCanvasElement;
    private keyListener: KeyListener;
    private currentMode: TMode;
    private globalMode: TMode;
    private renderTime: number; // for debugging - average ms per render()
    private lastDrawEvent: IPressureInput | null; // previous drawing input
    private linetoolProcessor: LinetoolProcessor;
    private pointer: IVector2D | null; // position of cursor
    private isDrawing: boolean;
    private inputProcessorObj: {
        [key in TInputProcessorKeys]: TInputProcessorItem;
    };
    private currentInputProcessor: TInputProcessorItem | null;
    private angleIsExtraSticky: boolean;
    private readonly pinchZoomer: PinchZoomer;
    private readonly mainDoubleTapper: DoubleTapper;
    private readonly middleDoubleTapper: DoubleTapper;
    private readonly twoFingerTap: NFingerTapper;
    private readonly threeFingerTap: NFingerTapper;
    private pointerEventChain: EventChain;
    private pointerListener: PointerListener | undefined;
    private brushRadius: number;
    private animationFrameRequested: boolean;
    private lastRenderedState: number; // KlHistory state - to detect if there are changes to draw
    private lastRenderTime: number; // ms from performance.now()
    private hideBrushCursorTimeout: (ReturnType<typeof setTimeout>) | undefined;
    private readonly onViewChange: (e:  IViewChangeEvent) => void;

    private getRenderedTransform (): ITransform {
        // rounded x & y so canvas is less blurry.
        const result = this.renderedTransformObj;
        result.x = this.highResTransformObj.x;
        result.y = this.highResTransformObj.y;
        result.scale = this.highResTransformObj.scale;
        result.angle = this.highResTransformObj.angle;

        if (result.angle % (Math.PI / 2) === 0 && result.scale % 1 === 0) {
            result.x = Math.round(result.x);
            result.y = Math.round(result.y);
        }

        return result;
    }

    private updateChangeListener (): void {
        this.klCanvas.addChangeListener(() => {
            this.lastRenderedState = -1;
            this.reqFrame();
        });
    }

    private updateCursor (modeInt: TMode, doForce?: boolean): void {
        if (modeInt === this.currentMode && !doForce) {
            return;
        }
        const oldMode = this.currentMode;
        this.currentMode = modeInt;
        this.lastRenderedState = -1;
        if (this.currentMode === TMode.Draw) {
            this.rootEl.style.cursor = 'crosshair';
        } else if (this.currentMode === TMode.Hand) {
            this.rootEl.style.cursor = 'grab';
        } else if (this.currentMode === TMode.HandGrabbing) {
            this.rootEl.style.cursor = 'grabbing';
        } else if (this.currentMode === TMode.Pick) {
            this.rootEl.style.cursor = "url('" + pickerImg + "') 0 15, crosshair";
        } else if (this.currentMode === TMode.Zoom) {
            this.rootEl.style.cursor = "url('" + zoomEwImg + "') 7 7, zoom-in";
        } else if (this.currentMode === TMode.Rotate) {
            this.rootEl.style.cursor = 'grab';
        } else if (this.currentMode === TMode.Rotating) {
            this.rootEl.style.cursor = 'grabbing';
        } else if (this.currentMode === TMode.Fill) {
            this.rootEl.style.cursor = "url('" + fillImg + "') 1 12, crosshair";
        } else if (this.currentMode === TMode.Gradient) {
            this.rootEl.style.cursor = 'crosshair';
        } else if (this.currentMode === TMode.Text) {
            this.rootEl.style.cursor = "url('" + textImg + "') 1 12, crosshair";
        } else if (this.currentMode === TMode.Shape) {
            this.rootEl.style.cursor = 'crosshair';
        }

        if ([TMode.Draw, TMode.Pick, TMode.Fill, TMode.Text, TMode.Shape].includes(this.globalMode)) {
            const oldIsHand = [TMode.Hand, TMode.HandGrabbing].includes(oldMode);
            const currentIsHand = [TMode.Hand, TMode.HandGrabbing].includes(this.currentMode);
            if (!oldIsHand && currentIsHand) {
                this.mainDoubleTapper.setAllowedPointerTypeArr(['mouse', 'pen', 'touch']);
            }
            if (oldIsHand && !currentIsHand) {
                this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
            }
        }

        if (this.currentMode !== TMode.Pick) {
            this.svgOverlay.updateColorPreview({isVisible: false});
        }
    }

    /**
     * returns false if no change of zoom
     * @param stepNum
     * @param centerX
     * @param centerY
     * @private
     */
    private internalZoomByStep (stepNum: number, centerX: number, centerY: number): boolean {
        const step = Math.log2(this.targetTransformObj.scale);

        let newStep = step / Math.abs(stepNum);
        newStep += stepNum > 0 ? 1 : -1;
        newStep = Math.round(newStep);
        newStep *= Math.abs(stepNum);
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.pow(2, newStep)));

        //has zoomed?
        if (newScale === this.targetTransformObj.scale) {
            return false;
        }

        const effectiveFactor = newScale / this.targetTransformObj.scale;
        this.targetTransformObj.scale = newScale;

        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(centerX, centerY));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(effectiveFactor));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-centerX, -centerY));

        let origin: TVec4 = [this.targetTransformObj.x, this.targetTransformObj.y, 0, 1];
        origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);
        this.targetTransformObj.x = origin[0];
        this.targetTransformObj.y = origin[1];

        this.transformIsDirty = true;

        return true;
    }

    /**
     * mixes two transform objects. modifies A
     * @param transformA
     * @param transformB
     * @param blendFactor 0 -> A, 1 -> B
     * @private
     */
    private mixTransformObj (transformA: ITransform, transformB: ITransform, blendFactor: number): void {
        if (transformA.angle === transformB.angle) {
            transformA.scale = BB.mix(transformA.scale, transformB.scale, blendFactor);
            transformA.x = BB.mix(transformA.x, transformB.x, blendFactor);
            transformA.y = BB.mix(transformA.y, transformB.y, blendFactor);
            transformA.angle = BB.mix(transformA.angle, transformB.angle, blendFactor);
            return;
        }

        const w = this.klCanvas.getWidth();
        const h = this.klCanvas.getHeight();

        // --- determine centerPosA, centerPosB ---
        const centerPosA = this.canvasToWorkspaceCoord({
            x: w / 2,
            y: h / 2,
        }, transformA);
        const centerPosB = this.canvasToWorkspaceCoord({
            x: w / 2,
            y: h / 2,
        }, transformB);

        // --- centerPosMixed ---
        transformA.x = BB.mix(centerPosA.x , centerPosB.x, blendFactor);
        transformA.y = BB.mix(centerPosA.y , centerPosB.y, blendFactor);

        // --- scale and angle ---
        transformA.scale = BB.mix(transformA.scale, transformB.scale, blendFactor);
        transformA.angle = BB.mix(transformA.angle, transformB.angle, blendFactor);

        // --- x and y ---
        const mixedPos = this.canvasToWorkspaceCoord({
            x: -w / 2,
            y: -h / 2,
        }, transformA);
        transformA.x = mixedPos.x;
        transformA.y = mixedPos.y;
    }

    private render (): void {
        if (this.doResizeCanvas) {
            this.doResizeCanvas = false;
            this.renderTargetCanvas.width = this.renderWidth;
            this.renderTargetCanvas.height = this.renderHeight;
        }
        this.renderContext(this.renderTargetCtx);
    }

    /**
     * is the gray background that surrounds canvas visible?
     * @private
     */
    private testBgVisible (): boolean {
        //bring workspace points (corners of workspace) into canvas coordinate system
        //then check if any corner point is outside of the canvas -> that means the bg is visible

        const workspacePointArr = [
            [0, 0], // top left
            [this.renderWidth, 0], // top right
            [this.renderWidth, this.renderHeight], // bottom right
            [0, this.renderHeight], // bottom left
        ];

        const art = this.getRenderedTransform();

        //setup transformation matrix
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(1/art.scale));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(-art.angle));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-art.x, -art.y));

        //transform points, then test if outside of canvas
        for (let i = 0; i < workspacePointArr.length; i++) {
            let coords: TVec4 = [workspacePointArr[i][0], workspacePointArr[i][1], 0, 1];
            coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);

            if (
                !(0 <= coords[0] && coords[0] <= this.klCanvas.getWidth() &&
                    0 <= coords[1] && coords[1] <= this.klCanvas.getHeight())
            ){
                //if not inside -> bg visible
                return true;
            }
        }
        return false;
    }

    private renderContext (ctx: CanvasRenderingContext2D): void {
        const w = this.klCanvas.getWidth();
        const h = this.klCanvas.getHeight();

        const art = this.getRenderedTransform();
        const isDark = theme.isDark();

        if (art.scale >= 4 || (art.scale === 1 && art.angle === 0)) {
            ctx.imageSmoothingEnabled = false;
        } else {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality  = 'low'; // art.scale >= 1 ? 'low' : 'medium';
        }
        //ctx.imageSmoothingEnabled = false;
        //renderTargetCtx.globalCompositeOperation  = 'multiply';



        ctx.save();
        {
            if (this.bgVisible) {
                ctx.fillStyle = isDark ? 'rgb(33, 33, 33)' : 'rgb(158,158,158)'; // 'rgb(185,185,185)';
                ctx.fillRect(0, 0, this.renderWidth, this.renderHeight);
            } else {
                ctx.clearRect(0, 0, this.renderWidth, this.renderHeight);
            }



            if (this.bgVisible) {
                ctx.save();

                ctx.translate(art.x, art.y);
                ctx.scale(art.scale, art.scale);
                ctx.rotate(art.angle);

                ctx.imageSmoothingEnabled = false;

                //outline
                const borderSize = 1;
                ctx.globalAlpha = isDark ? 0.25 : 0.2;
                ctx.drawImage(
                    isDark ? this.emptyLightCanvas : this.emptyCanvas,
                    -borderSize / art.scale,
                    -borderSize / art.scale,
                    w + borderSize * 2 / art.scale,
                    h + borderSize * 2 / art.scale
                );
                ctx.globalAlpha = 1;

                //erase
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(this.emptyCanvas, 0, 0, w, h);

                ctx.restore();
            }

            /*const region = new Path2D();
            region.rect(80, 10, 20, 130);
            ctx.clip(region);*/

            ctx.translate(art.x, art.y);
            ctx.scale(art.scale, art.scale);
            ctx.rotate(art.angle);

            const layerArr = this.klCanvas.getLayersFast();
            for (let i = 0; i < layerArr.length; i++) {
                if (!layerArr[i].isVisible || layerArr[i].opacity === 0) {
                    continue;
                }

                ctx.globalAlpha = layerArr[i].opacity;
                ctx.globalCompositeOperation = layerArr[i].mixModeStr;

                const compositeObj = layerArr[i].canvas.compositeObj;
                if (compositeObj) {
                    if (this.compositeCanvas.width !== layerArr[i].canvas.width || this.compositeCanvas.height !== layerArr[i].canvas.height) {
                        this.compositeCanvas.width = layerArr[i].canvas.width;
                        this.compositeCanvas.height = layerArr[i].canvas.height;
                    } else {
                        this.compositeCtx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
                    }
                    this.compositeCtx.drawImage(layerArr[i].canvas, 0, 0);
                    compositeObj.draw(this.compositeCtx);
                    ctx.drawImage(this.compositeCanvas, 0, 0, w, h);
                } else {
                    ctx.drawImage(layerArr[i].canvas, 0, 0, w, h);
                }
            }
            ctx.globalAlpha = 1;



        }
        ctx.restore();

        // rotation hud
        if (TMode.Rotate === this.currentMode || TMode.Rotating === this.currentMode) {
            this.svgOverlay.updateCompass({
                isVisible: true,
                angleDeg: art.angle / Math.PI * 180,
            });
        } else {
            this.svgOverlay.updateCompass({
                isVisible: false,
            });
        }
    }

    private workspaceToCanvasCoord (p: IVector2D): IVector2D {
        const art = this.getRenderedTransform();
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(1/art.scale));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(-art.angle));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-art.x, -art.y));

        let coords: TVec4 = [p.x, p.y, 0, 1];
        coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);

        return {
            x: coords[0],
            y: coords[1],
        };
    }

    private canvasToWorkspaceCoord (p: IVector2D, transformObj: ITransform): IVector2D {
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(transformObj.x, transformObj.y));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(transformObj.angle));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(transformObj.scale));

        let coords: TVec4 = [p.x, p.y, 0, 1];
        coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);

        return {
            x: coords[0],
            y: coords[1],
        };
    }

    private snapAngleRad (angleRad: number, snapDegIncrement: number, maxDistDeg: number): number {
        let angleDeg = angleRad * 180 / Math.PI;
        const modDeg = Math.abs(angleDeg % snapDegIncrement);
        const dist = Math.min(modDeg, snapDegIncrement - modDeg);

        if (dist <= maxDistDeg) {
            angleDeg = Math.round(angleDeg / snapDegIncrement) * snapDegIncrement;
        }

        return angleDeg / 180 * Math.PI;
    }

    /**
     * angle always in range [-PI, PI]
     * @param angleRad
     * @private
     */
    private minimizeAngleRad (angleRad: number): number {
        angleRad = angleRad % (2 * Math.PI);
        if (angleRad > Math.PI) {
            angleRad -= 2 * Math.PI;
        } else if (angleRad < -Math.PI) {
            angleRad += 2 * Math.PI;
        }
        return angleRad;
    }

    private resetInputProcessor (): void {
        this.currentInputProcessor = null;
        this.updateCursor(this.globalMode);
        this.reqFrame(true);
    }

    private reqFrame (doRedrawCanvas?: boolean): void {
        this.animationFrameRequested = true;
        if (doRedrawCanvas) {
            this.lastRenderedState = -1;
        }
    }

    private updateLoop (): void {
        window.requestAnimationFrame(() => this.updateLoop());
        const newState = klHistory.getState();
        const doRender = this.lastRenderedState < newState;

        //handle variable framerate
        const nowTime = performance.now();
        const elapsedFrames = (nowTime - this.lastRenderTime) * 60 / 1000; //how many frames elapsed since last render if fps were 60fps
        this.lastRenderTime = nowTime;

        if (this.animationFrameRequested || doRender) {
            this.animationFrameRequested = false;
            this.checkChange(elapsedFrames);
        }
    }

    private checkChange (elapsedFrames: number): void {

        const newState = klHistory.getState();
        const doRender = this.lastRenderedState < newState ||
            this.highResTransformObj.scale !== this.targetTransformObj.scale ||
            this.highResTransformObj.x !== this.targetTransformObj.x ||
            this.highResTransformObj.y !== this.targetTransformObj.y;

        //update transform
        if (
            !this.doAnimateTranslate &&
            (
                this.highResTransformObj.scale === this.targetTransformObj.scale ||
                Math.abs(this.highResTransformObj.scale - this.targetTransformObj.scale) < 0.008 * this.targetTransformObj.scale
            )
        ) {
            this.highResTransformObj.scale = this.targetTransformObj.scale;
            this.highResTransformObj.x = this.targetTransformObj.x;
            this.highResTransformObj.y = this.targetTransformObj.y;
            this.highResTransformObj.angle = this.targetTransformObj.angle;
            if (this.transformIsDirty) {
                this.transformIsDirty = false;
                this.bgVisible = this.testBgVisible();
            }

            this.svgOverlay.updateCursor({radius: this.brushRadius * this.highResTransformObj.scale});
        } else if (
            (this.highResTransformObj.x === this.targetTransformObj.x || Math.abs(this.highResTransformObj.x - this.targetTransformObj.x) < 0.5) &&
            (this.highResTransformObj.y === this.targetTransformObj.y || Math.abs(this.highResTransformObj.y - this.targetTransformObj.y) < 0.5) &&
            (
                this.highResTransformObj.scale === this.targetTransformObj.scale ||
                Math.abs(this.highResTransformObj.scale - this.targetTransformObj.scale) < 0.008 * this.targetTransformObj.scale
            )
        ) {
            this.highResTransformObj.scale = this.targetTransformObj.scale;
            this.highResTransformObj.x = this.targetTransformObj.x;
            this.highResTransformObj.y = this.targetTransformObj.y;
            this.highResTransformObj.angle = this.targetTransformObj.angle;
            this. doAnimateTranslate = false;
            if (this.transformIsDirty) {
                this.transformIsDirty = false;
                this.bgVisible = this.testBgVisible();
            }

            this.svgOverlay.updateCursor({radius: this.brushRadius * this.highResTransformObj.scale});
        } else {
            this.reqFrame(); //probably needs another frame
            const blendFactor = Math.min(1, ANIMATION_SPEED * elapsedFrames);
            this.mixTransformObj(this.highResTransformObj, this.targetTransformObj, blendFactor);
            this.bgVisible = true; // spare yourself the calculation
            this.svgOverlay.updateCursor({radius: this.brushRadius * this.highResTransformObj.scale});
        }

        if (this.pointer && this.currentMode == TMode.Draw && !this.usesCssCursor) {
            this.svgOverlay.updateCursor({
                x: this.pointer.x,
                y: this.pointer.y,
                isVisible: true,
            });
        } else {
            this.svgOverlay.updateCursor({isVisible: false});
        }


        if (doRender) {
            //console.log('scale', this.renderedTransform.scale, 'x', this.renderedTransform.x, 'y', this.renderedTransform.y);
            this.lastRenderedState = newState;
            const start = performance.now();
            this.render();
            this.renderTime = BB.mix(this.renderTime, performance.now() - start, 0.05);
        }
        //setTimeout(this.checkChange, 100);



        if (doRender) {

            //console.log('rendertime ms: ', this.renderTime);
        }

    }

    // ---- public ----

    constructor (
        p: {
            klCanvas: KlCanvas;
            width: number;
            height: number;
            onDraw: (val: TDrawEvent) => void;
            onPick: (rgb: IRGB, isPointerup: boolean) => void;
            onFill: (canvasX: number, canvasY: number) => void;
            onGradient: (type: 'down' | 'up' | 'move', canvasX: number, canvasY: number, angleRad: number) => void;
            onText: (canvasX: number, canvasY: number, angleRad: number) => void;
            onShape: (type: 'down' | 'up' | 'move', canvasX: number, canvasY: number, angleRad: number) => void;
            onViewChange: (e:  IViewChangeEvent) => void;
            onUndo: () => void;
            onRedo: () => void;
        }
    ) {
        this.rootEl = BB.el({
            css: {
                position: 'absolute',
                left: '0',
                right: '0',
                top: '0',
                bottom: '0',
                cursor: 'crosshair',
                userSelect: 'none',
            },
        });
        this.klCanvas = p.klCanvas;
        this.onViewChange = p.onViewChange;
        this.renderTargetCanvas = BB.canvas(p.width, p.height);
        this.renderTargetCtx = BB.ctx(this.renderTargetCanvas);
        this.renderWidth = p.width;
        this.renderHeight = p.height;
        this.compositeCanvas = BB.canvas(1, 1); // for drawing klcanvas layer composite
        this.compositeCtx = BB.ctx(this.compositeCanvas);
        this.doResizeCanvas = false;
        this.oldTransformObj = null;
        this.targetTransformObj = {
            x: 0,
            y: 0,
            scale: 1,
            angle: 0,
        };
        this.highResTransformObj = {
            x: 0,
            y: 0,
            scale: 1,
            angle: 0,
        };
        this.renderedTransformObj = {} as ITransform;
        this.cursorPos = {
            x: 0,
            y: 0,
        };
        this.usesCssCursor = false;
        this.bgVisible = true;
        this.transformIsDirty = true;
        this.doAnimateTranslate = true;

        this.svgOverlay = new WorkspaceSvgOverlay({
            width: p.width,
            height: p.height,
        });

        BB.css(this.renderTargetCanvas, {
            userSelect: 'none',
            pointerEvents: 'none',
        });
        BB.createCheckerDataUrl(8, (url) => {
            this.renderTargetCanvas.style.background = 'url(' + url + ')';
        }, theme.isDark());

        theme.addIsDarkListener(() => {
            this.renderTargetCanvas.style.background = 'url(' + BB.createCheckerDataUrl(8, undefined, theme.isDark()) + ')';
            this.lastRenderedState = -1;
            this.reqFrame();
        });

        this.rootEl.append(this.renderTargetCanvas, this.svgOverlay.getElement());
        this.rootEl.addEventListener( 'touchend', (e) => {
            e.preventDefault();
            return false;
        });
        this.rootEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        this.rootEl.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        this.emptyCanvas = BB.canvas(1, 1);
        this.emptyLightCanvas = BB.canvas(1, 1);
        {
            let ctx = BB.ctx(this.emptyCanvas);
            ctx.fillRect(0, 0, 1, 1);
            ctx = BB.ctx(this.emptyLightCanvas);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 1, 1);
        }

        this.keyListener = new BB.KeyListener({
            onDown: (keyStr, event, comboStr, isRepeat) => {

                if (KL.dialogCounter.get() > 0 || BB.isInputFocused(true)) {
                    return;
                }
                if (keyStr === 'alt') {
                    event.preventDefault();
                }
                if (isRepeat) {
                    return;
                }

                if (this.currentInputProcessor) {
                    this.currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);

                } else {

                    if ([TMode.Draw, TMode.Pick, TMode.Fill, TMode.Gradient, TMode.Text, TMode.Shape].includes(this.globalMode) && comboStr === 'space') {
                        this.currentInputProcessor = this.inputProcessorObj.spaceHand;
                        this.currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                        return;
                    }

                    if ([TMode.Draw, TMode.Hand, TMode.Fill, TMode.Gradient, TMode.Text, TMode.Shape].includes(this.globalMode) && comboStr === 'alt') {
                        this.currentInputProcessor = this.inputProcessorObj.altPicker;
                        this.currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                        return;
                    }

                    if (['r', 'shift+r'].includes(comboStr)) {
                        this.currentInputProcessor = this.inputProcessorObj.rotate;
                        this.currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                        return;
                    }

                    if ('z' === comboStr) {
                        this.currentInputProcessor = this.inputProcessorObj.zoom;
                        this.currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                        return;
                    }

                }

            },
            onUp: (keyStr, event, oldComboStr) => {
                // prevent menu bar in Firefox
                if (keyStr === 'alt') {
                    event.preventDefault();
                }

                if (this.currentInputProcessor) {
                    this.currentInputProcessor.onKeyUp(keyStr, event, oldComboStr);
                }
            },
        });

        this.updateChangeListener();

        this.currentMode = TMode.Draw;
        this.globalMode = TMode.Draw;

        this.renderTime = 0;

        this.lastDrawEvent = null;

        this.linetoolProcessor = new LinetoolProcessor({
            onDraw: (event) => {
                const getMatrix = () => {
                    const art = this.getRenderedTransform();
                    let matrix = BB.Matrix.getIdentity();
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(1/art.scale));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(-art.angle));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-art.x, -art.y));
                    return matrix;
                };

                if (event.type === 'line' && !this.lastDrawEvent) {
                    const matrix = getMatrix();
                    let coords: TVec4 = [event.x1, event.y1, 0, 1];
                    coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
                    this.lastDrawEvent = {
                        x: coords[0],
                        y: coords[1],
                        pressure: event.pressure1,
                    };
                    return;
                }

                if ('x' in event || 'x0' in event) {

                    const matrix = getMatrix();

                    if ('x' in event) { //down or move
                        let coords: TVec4 = [event.x, event.y, 0, 1];
                        coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
                        event.x = coords[0];
                        event.y = coords[1];
                    }
                    if ('x0' in event) { //line
                        event.x0 = this.lastDrawEvent!.x;
                        event.y0 = this.lastDrawEvent!.y;
                        event.pressure0 = this.lastDrawEvent!.pressure;
                        let coords: TVec4 = [event.x1, event.y1, 0, 1];
                        coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
                        event.x1 = coords[0];
                        event.y1 = coords[1];

                        this.lastDrawEvent = {
                            x: event.x1,
                            y: event.y1,
                            pressure: event.pressure1,
                        };
                    }
                }


                if (event.type === 'down' || event.type === 'move') {
                    this.lastDrawEvent = {
                        x: event.x,
                        y: event.y,
                        pressure: event.pressure,
                    };
                }
                p.onDraw(event);
            },
        });

        this.pointer = null;
        this.isDrawing = false;


        this.inputProcessorObj = {
            draw: {
                onPointer: (val) => {

                    this.reqFrame();
                    this.updateCursor(TMode.Draw);

                    const comboStr = this.keyListener.getComboStr();

                    const event: any = {
                        scale: this.highResTransformObj.scale,
                    };
                    event.shiftIsPressed = comboStr === 'shift';
                    event.pressure = val.pressure;
                    event.isCoalesced = !!val.isCoalesced;

                    if (val.type === 'pointerdown') {

                        this.isDrawing = true;
                        event.type = 'down';

                    } else if (val.button) {
                        event.type = 'move';

                    } else if (val.type === 'pointerup') {

                        this.isDrawing = false;
                        event.type = 'up';

                        this.linetoolProcessor.process(event);
                        this.resetInputProcessor();
                        return;
                    } else {
                        return;
                    }

                    event.x = val.relX;
                    event.y = val.relY;

                    this.linetoolProcessor.process(event);
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {

                },
            },
            fill: {
                onPointer: (event) => {

                    this.reqFrame();
                    this.updateCursor(TMode.Fill);

                    if (event.type === 'pointerdown') {
                        const coord = this.workspaceToCanvasCoord({x: event.relX, y: event.relY});
                        p.onFill(Math.floor(coord.x), Math.floor(coord.y));

                    } else if (event.type === 'pointerup') {
                        this.resetInputProcessor();
                        return;

                    }

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {

                },
            },
            gradient: {
                onPointer: (event) => {

                    this.reqFrame();
                    this.updateCursor(TMode.Gradient);
                    const coord = this.workspaceToCanvasCoord({x: event.relX, y: event.relY});

                    if (event.type === 'pointerdown') {
                        this.isDrawing = true;
                        p.onGradient('down', coord.x, coord.y, this.renderedTransformObj.angle);

                    } else if (event.type === 'pointermove') {
                        p.onGradient('move', coord.x, coord.y, this.renderedTransformObj.angle);

                    } else if (event.type === 'pointerup') {
                        this.isDrawing = false;
                        p.onGradient('up', coord.x, coord.y, this.renderedTransformObj.angle);
                        this.resetInputProcessor();

                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {

                },
            },
            text: {
                onPointer: (event) => {

                    this.reqFrame();
                    this.updateCursor(TMode.Text);

                    if (event.type === 'pointerdown') {
                        const coord = this.workspaceToCanvasCoord({x: event.relX, y: event.relY});
                        p.onText(Math.floor(coord.x), Math.floor(coord.y), this.renderedTransformObj.angle);

                    } else if (event.type === 'pointerup') {
                        this.resetInputProcessor();
                        return;

                    }

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {

                },
            },
            shape: {
                onPointer: (event) => {

                    this.reqFrame();
                    this.updateCursor(TMode.Shape);
                    const coord = this.workspaceToCanvasCoord({x: event.relX, y: event.relY});

                    if (event.type === 'pointerdown') {
                        this.isDrawing = true;
                        p.onShape('down', coord.x, coord.y, this.renderedTransformObj.angle);

                    } else if (event.type === 'pointermove') {
                        p.onShape('move', coord.x, coord.y, this.renderedTransformObj.angle);

                    } else if (event.type === 'pointerup') {
                        this.isDrawing = false;
                        p.onShape('up', coord.x, coord.y, this.renderedTransformObj.angle);
                        this.resetInputProcessor();

                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {

                },
            },
            hand: {
                onPointer: (event) => {
                    this.updateCursor(TMode.Hand);
                    if (['left', 'middle'].includes(event.button || '')) {
                        this.updateCursor(TMode.HandGrabbing);
                        this.targetTransformObj.x += event.dX;
                        this.targetTransformObj.y += event.dY;
                        this.highResTransformObj = BB.copyObj(this.targetTransformObj);
                        this.doAnimateTranslate = false;
                        this.transformIsDirty = true;
                        this.reqFrame(true);
                    } else if (event.type === 'pointerup') {
                        this.resetInputProcessor();
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {

                },
            },
            spaceHand: {
                onPointer: (event) => {
                    this.updateCursor(TMode.Hand);
                    if (['left', 'middle'].includes(event.button || '')) {
                        this.updateCursor(TMode.HandGrabbing);
                        this.targetTransformObj.x += event.dX;
                        this.targetTransformObj.y += event.dY;
                        this.highResTransformObj = BB.copyObj(this.targetTransformObj);
                        this.doAnimateTranslate = false;
                        this.transformIsDirty = true;
                        this.reqFrame(true);
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {
                    if (comboStr !== 'space') {
                        this.resetInputProcessor();
                    } else {
                        this.updateCursor(TMode.Hand);
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {
                    this.resetInputProcessor();
                },
            },
            zoom: {
                onPointer: (event) => {
                    this.updateCursor(TMode.Zoom);

                    if (event.button === 'left' && !event.isCoalesced && event.dX != 0) {

                        const offsetX = event.pageX - event.relX;
                        const offsetY = event.pageY - event.relY;

                        this.internalZoomByStep(event.dX / 175, event.downPageX! - offsetX, event.downPageY! - offsetY);
                        this.highResTransformObj = BB.copyObj(this.targetTransformObj);
                        this.lastRenderedState = -1;
                        this.reqFrame();

                        this.onViewChange({
                            changed: ['scale'],
                            angle: this.targetTransformObj.angle,
                            scale: this.targetTransformObj.scale,
                        });
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {
                    if (comboStr !== 'z') {
                        this.resetInputProcessor();
                    } else {
                        this.updateCursor(TMode.Zoom);
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {
                    this.resetInputProcessor();
                },
            },
            picker: {
                onPointer: (event) => {
                    this.updateCursor(TMode.Pick);
                    if (
                        (['left', 'right'].includes(event.button || '') && !event.isCoalesced) ||
                        event.type === 'pointerup'
                    ) {
                        const coord = this.workspaceToCanvasCoord({x: event.relX, y: event.relY});
                        const pickedColor = this.klCanvas.getColorAt(coord.x, coord.y);
                        p.onPick(pickedColor, event.type === 'pointerup');
                        this.svgOverlay.updateColorPreview({
                            x: event.relX,
                            y: event.relY,
                            color: pickedColor,
                            isVisible: event.type !== 'pointerup',
                        });

                        if (event.type === 'pointerup') {
                            this.resetInputProcessor();
                        }
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {

                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {

                },
            },
            altPicker: {
                onPointer: (event) => {
                    this.updateCursor(TMode.Pick);
                    if (
                        (['left', 'right'].includes(event.button || '') && !event.isCoalesced) ||
                        event.type === 'pointerup'
                    ) {
                        const coord = this.workspaceToCanvasCoord({x: event.relX, y: event.relY});
                        const pickedColor = this.klCanvas.getColorAt(coord.x, coord.y);
                        p.onPick(pickedColor, event.type === 'pointerup');
                        this.svgOverlay.updateColorPreview({
                            x: event.relX,
                            y: event.relY,
                            color: pickedColor,
                            isVisible: event.type !== 'pointerup',
                        });
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {
                    if (comboStr !== 'alt') {
                        this.resetInputProcessor();
                    } else {
                        this.updateCursor(TMode.Pick);
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {
                    this.resetInputProcessor();
                },
            },
            rotate: {
                onPointer: (event) => {
                    this.updateCursor(event.button === 'left' ? TMode.Rotating : TMode.Rotate);

                    if (event.type === 'pointerdown' && event.button === 'left') {
                        this.oldTransformObj = BB.copyObj(this.targetTransformObj);
                    } else if (event.button === 'left' && !event.isCoalesced && this.oldTransformObj) {


                        const offsetX = event.pageX - event.relX;
                        const offsetY = event.pageY - event.relY;
                        //rotation done around center
                        const centerObj = {
                            x: this.renderWidth / 2,
                            y: this.renderHeight / 2,
                        };

                        const startAngleRad = BB.Vec2.angle(centerObj, {x: event.downPageX! - offsetX, y: event.downPageY! - offsetY});
                        const angleRad = BB.Vec2.angle(centerObj, {x: event.pageX - offsetX, y: event.pageY - offsetY});
                        let dAngleRad = angleRad - startAngleRad;

                        //apply angle
                        this.targetTransformObj = BB.copyObj(this.oldTransformObj);
                        this.targetTransformObj.angle += dAngleRad;

                        if (this.keyListener.isPressed('shift')) {
                            this.targetTransformObj.angle = Math.round(this.targetTransformObj.angle / Math.PI * 8) * Math.PI / 8; //snap the angle to 45/2 degs
                            dAngleRad = this.targetTransformObj.angle - this.oldTransformObj.angle;
                        }

                        this.targetTransformObj.angle = this.minimizeAngleRad(this.targetTransformObj.angle);

                        //rotate transform.xy
                        let matrix = BB.Matrix.getIdentity();
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(centerObj.x, centerObj.y));
                        //matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(effectiveFactor));
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(dAngleRad));
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-centerObj.x, -centerObj.y));
                        //matrix = multiplyMatrices(matrix, createTranslationMatrix(val.x - val.startX, val.y - val.startY));

                        let origin: TVec4 = [this.targetTransformObj.x, this.targetTransformObj.y, 0, 1];
                        origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);
                        this.targetTransformObj.x = origin[0];
                        this.targetTransformObj.y = origin[1];

                        this.highResTransformObj = BB.copyObj(this.targetTransformObj);

                        this.transformIsDirty = true;
                        this.lastRenderedState = -1;
                        this.reqFrame();

                        this.onViewChange({
                            changed: ['angle'],
                            scale: this.targetTransformObj.scale,
                            angle: this.targetTransformObj.angle,
                        });

                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyDown: (keyStr, event, comboStr, isRepeat) => {
                    if (['r', 'r+shift', 'shift+r', 'r+left', 'r+right', 'r+left+right', 'r+right+left', 'r+up'].includes(comboStr)) {
                        this.updateCursor(TMode.Rotate);
                    } else {
                        this.resetInputProcessor();
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                onKeyUp: (keyStr, event, oldComboStr) => {
                    const comboStr = this.keyListener.getComboStr();
                    if (['r', 'r+shift', 'shift+r', 'r+left', 'r+right', 'r+left+right', 'r+right+left', 'r+up'].includes(comboStr)) {
                        this.updateCursor(TMode.Rotate);
                    } else {
                        this.resetInputProcessor();
                    }
                },
            },
        };
        this.currentInputProcessor = null;


        this.angleIsExtraSticky = false;
        this.pinchZoomer = new BB.PinchZoomer({
            onPinch: (event) => {

                if (event.type === 'move') {

                    if (!this.oldTransformObj) {
                        this.oldTransformObj = BB.copyObj(this.targetTransformObj);
                        this.angleIsExtraSticky = this.targetTransformObj.angle % (Math.PI / 2) === 0;
                    }

                    this.targetTransformObj = BB.copyObj(this.oldTransformObj);

                    event.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.targetTransformObj.scale * event.scale)) / this.targetTransformObj.scale;

                    this.targetTransformObj.scale *= event.scale;
                    this.targetTransformObj.angle += event.angleRad;
                    this.targetTransformObj.angle = this.minimizeAngleRad(
                        this.snapAngleRad(
                            this.targetTransformObj.angle,
                            90,
                            this.angleIsExtraSticky ? 12 : 4
                        )
                    );
                    if (this.targetTransformObj.angle % (Math.PI / 2) !== 0) {
                        this.angleIsExtraSticky = false;
                    }
                    //targetTransformObj.angle = minimizeAngleRad(snapAngleRad(targetTransformObj.angle, 90, 7));
                    event.angleRad = this.targetTransformObj.angle - this.oldTransformObj.angle;

                    //calc translation
                    {
                        let matrix = BB.Matrix.getIdentity();
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(event.relX, event.relY));
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(event.scale));
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(event.angleRad));
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-event.relX, -event.relY));
                        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(event.relX - event.downRelX, event.relY - event.downRelY));


                        let origin: TVec4 = [this.targetTransformObj.x, this.targetTransformObj.y, 0, 1];
                        origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);

                        this.targetTransformObj.x = origin[0];
                        this.targetTransformObj.y = origin[1];

                    }

                    this.highResTransformObj = BB.copyObj(this.targetTransformObj);

                    //if (event.scale !== 1) {
                    this.onViewChange({
                        changed: ['scale', 'angle'],
                        scale: this.targetTransformObj.scale,
                        angle: this.targetTransformObj.angle,
                    });
                    //}
                    this.reqFrame();
                    this.transformIsDirty = true;
                    this.lastRenderedState = -1;


                } else if (event.type === 'end') {
                    this.oldTransformObj = null;
                }


            },
        });

        const onDoubleTap = (event: IDoubleTapperEvent) => {
            if (this.fitView(true)) {
                this.lastRenderedState = -1;
                this.reqFrame();
            } else {
                // zoom 2 steps further

                const didZoom = this.internalZoomByStep(
                    2,
                    event.relX,
                    event.relY,
                );
                if (didZoom) {
                    this.onViewChange({
                        changed: ['scale'],
                        angle: this.targetTransformObj.angle,
                        scale: this.targetTransformObj.scale,
                    });
                }

                //updateCursor(TMode.Draw, true);
                this.lastRenderedState = -1;
            }
        };

        this.mainDoubleTapper = new BB.DoubleTapper({ onDoubleTap });
        this.middleDoubleTapper = new BB.DoubleTapper({ onDoubleTap });
        this.middleDoubleTapper.setAllowedButtonArr(['middle']);


        this.twoFingerTap = new BB.NFingerTapper({
            fingers: 2,
            onTap: () => {
                p.onUndo();
            },
        });
        this.threeFingerTap = new BB.NFingerTapper({
            fingers: 3,
            onTap: () => {
                p.onRedo();
            },
        });


        this.pointerEventChain = new BB.EventChain({
            chainArr: [
                this.twoFingerTap as IChainElement,
                this.threeFingerTap as IChainElement,
                this.mainDoubleTapper as IChainElement,
                this.middleDoubleTapper as IChainElement,
                this.pinchZoomer as IChainElement,
                new BB.OnePointerLimiter() as IChainElement,
                new BB.CoalescedExploder() as IChainElement,
            ],
        });
        this.pointerEventChain.setChainOut((event: ICoalescedPointerEvent) => {

            this.cursorPos.x = event.relX;
            this.cursorPos.y = event.relY;
            if (event.type === 'pointerup' && event.pointerType === 'touch') {
                this.pointer = null;
                this.lastRenderedState = -1;
                this.reqFrame();
            } else {
                if (!this.pointer) {
                    this.pointer = { x: 0, y: 0 };
                }
                this.pointer.x = event.relX;
                this.pointer.y = event.relY;
            }

            if (this.currentInputProcessor) {
                this.currentInputProcessor.onPointer(event);

            } else {

                const comboStr = this.keyListener.getComboStr();

                if (this.globalMode === TMode.Draw) {

                    if (['', 'shift', 'ctrl'].includes(comboStr) && event.type === 'pointerdown' && event.button === 'left') {
                        this.currentInputProcessor = this.inputProcessorObj.draw;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                        this.currentInputProcessor = this.inputProcessorObj.picker;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                        this.currentInputProcessor = this.inputProcessorObj.hand;
                        this.currentInputProcessor.onPointer(event);
                    } else {
                        this.updateCursor(TMode.Draw);
                        this.reqFrame();
                    }

                } else if (this.globalMode === TMode.Hand) {

                    if (event.type === 'pointerdown' && ['left', 'middle'].includes(event.button || '')) {
                        this.currentInputProcessor = this.inputProcessorObj.hand;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                        this.currentInputProcessor = this.inputProcessorObj.picker;
                        this.currentInputProcessor.onPointer(event);
                    } else {
                        this.updateCursor(TMode.Hand);
                    }

                } else if (this.globalMode === TMode.Pick) {

                    if (event.type === 'pointerdown' && ['left', 'right'].includes(event.button || '')) {
                        this.currentInputProcessor = this.inputProcessorObj.picker;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                        this.currentInputProcessor = this.inputProcessorObj.hand;
                        this.currentInputProcessor.onPointer(event);
                    } else {
                        this.updateCursor(TMode.Pick);
                    }

                } else if (this.globalMode === TMode.Fill) {

                    if (event.type === 'pointerdown' && event.button === 'left') {
                        this.currentInputProcessor = this.inputProcessorObj.fill;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                        this.currentInputProcessor = this.inputProcessorObj.picker;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                        this.currentInputProcessor = this.inputProcessorObj.hand;
                        this.currentInputProcessor.onPointer(event);
                    } else {
                        this.updateCursor(TMode.Fill);
                        this.reqFrame();
                    }

                } else if (this.globalMode === TMode.Gradient) {

                    if (['', 'shift', 'ctrl'].includes(comboStr) && event.type === 'pointerdown' && event.button === 'left') {
                        this.currentInputProcessor = this.inputProcessorObj.gradient;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                        this.currentInputProcessor = this.inputProcessorObj.picker;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                        this.currentInputProcessor = this.inputProcessorObj.hand;
                        this.currentInputProcessor.onPointer(event);
                    } else {
                        this.updateCursor(TMode.Gradient);
                        this.reqFrame();
                    }

                } else if (this.globalMode === TMode.Text) {

                    if (event.type === 'pointerdown' && event.button === 'left') {
                        this.currentInputProcessor = this.inputProcessorObj.text;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                        this.currentInputProcessor = this.inputProcessorObj.picker;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                        this.currentInputProcessor = this.inputProcessorObj.hand;
                        this.currentInputProcessor.onPointer(event);
                    } else {
                        this.updateCursor(TMode.Text);
                        this.reqFrame();
                    }

                } else if (this.globalMode === TMode.Shape) {

                    if (['', 'shift', 'ctrl'].includes(comboStr) && event.type === 'pointerdown' && event.button === 'left') {
                        this.currentInputProcessor = this.inputProcessorObj.shape;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                        this.currentInputProcessor = this.inputProcessorObj.picker;
                        this.currentInputProcessor.onPointer(event);
                    } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                        this.currentInputProcessor = this.inputProcessorObj.hand;
                        this.currentInputProcessor.onPointer(event);
                    } else {
                        this.updateCursor(TMode.Shape);
                        this.reqFrame();
                    }

                }


            }

        });

        //prevent ctrl scroll -> zooming page
        this.rootEl.addEventListener('wheel', (event) => {
            event.preventDefault();
        });


        setTimeout(() => {
            this.pointerListener = new BB.PointerListener({
                target: this.rootEl,
                fixScribble: true,
                onPointer: (e) => {
                    if (e.type === 'pointerdown' && e.button === 'middle') {
                        try {
                            e.eventPreventDefault();
                        } catch (e) {
                            /* empty */
                        }
                    }
                    // prevent manual slider input keeping focus on iPad
                    if (e.type === 'pointerdown') {
                        BB.unfocusAnyInput();
                    }
                    /*if (e.type === 'pointermove') {
                        BB.throwOut(JSON.stringify(e));
                    }*/

                    this.pointerEventChain.chainIn(e);
                },
                onWheel: (wheelEvent) => {

                    if (this.isDrawing) {
                        return;
                    }

                    this.reqFrame();
                    const didZoom = this.internalZoomByStep(
                        -wheelEvent.deltaY / (this.keyListener.isPressed('shift') ? 8 : 2),
                        wheelEvent.relX,
                        wheelEvent.relY
                    );
                    if (didZoom) {
                        this.onViewChange({
                            changed: ['scale'],
                            angle: this.targetTransformObj.angle,
                            scale: this.targetTransformObj.scale,
                        });
                    }

                    //updateCursor(TMode.Draw, true);
                    this.lastRenderedState = -1;


                },
                onEnterLeave: (isOver) => {
                    if (!isOver) {
                        if (!this.isDrawing) {
                            this.pointer = null;
                            this.lastRenderedState = -1;
                        }
                    }
                },
                maxPointers: 4,
            });
        }, 1);

        this.brushRadius = 1;

        this.animationFrameRequested = false;




        //setup rendering
        this.lastRenderedState = -2;
        this.lastRenderTime = performance.now();

        window.requestAnimationFrame(() => this.updateLoop());

        this.resetOrFitView();
    }


    getElement (): HTMLElement {
        return this.rootEl;
    }

    setCanvas (klC: KlCanvas): void {
        this.klCanvas = klC;
        this.lastDrawEvent = null;
        this.resetView();

        this.updateChangeListener();

        this.lastRenderedState = -1;
        this.reqFrame();
    }

    /**
     * set size of workspace area in pixels
     * @param width
     * @param height
     */
    setSize (width: number, height: number): void {
        const oldWidth = this.renderWidth;
        const oldHeight = this.renderHeight;

        if (width === oldWidth && height === oldHeight) {
            return;
        }

        this.doResizeCanvas = true;
        this.renderWidth = width;
        this.renderHeight = height;

        this.svgOverlay.setSize(width, height);

        this.targetTransformObj.x += (width - oldWidth) / 2;
        this.targetTransformObj.y += (height - oldHeight) / 2;

        this.highResTransformObj.x = this.targetTransformObj.x;
        this.highResTransformObj.y = this.targetTransformObj.y;

        this.bgVisible = this.testBgVisible();

        this.lastRenderedState = -1;
        this.reqFrame();
    }

    setMode (modeStr: TModeStr): void {
        //only sets the base mode
        if (modeStr === 'draw') {
            this.globalMode = TMode.Draw;
            this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if (modeStr === 'fill') {
            this.globalMode = TMode.Fill;
            this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if (modeStr === 'gradient') {
            this.globalMode = TMode.Gradient;
            this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if (modeStr === 'text') {
            this.globalMode = TMode.Text;
            this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if (modeStr === 'shape') {
            this.globalMode = TMode.Shape;
            this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if (modeStr === 'hand') {
            this.globalMode = TMode.Hand;
            this.mainDoubleTapper.setAllowedPointerTypeArr(['mouse', 'pen', 'touch']);
        }
        if (modeStr === 'pick') {
            this.globalMode = TMode.Pick;
            this.mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
    }

    getMode (): TModeStr {
        if (this.globalMode === TMode.Draw) {
            return 'draw';
        }
        if (this.globalMode === TMode.Fill) {
            return 'fill';
        }
        if (this.globalMode === TMode.Gradient) {
            return 'gradient';
        }
        if (this.globalMode === TMode.Text) {
            return 'text';
        }
        if (this.globalMode === TMode.Shape) {
            return 'shape';
        }
        if (this.globalMode === TMode.Hand) {
            return 'hand';
        }
        if (this.globalMode === TMode.Pick) {
            return 'pick';
        }
        throw new Error('unknown globalMode');
    }

    setCursorSize (diameter: number): void {
        this.brushRadius = diameter / 2;

        this.svgOverlay.updateCursor({radius: this.brushRadius * this.highResTransformObj.scale});

        if (this.pointer === null) {
            this.hideBrushCursorTimeout && clearTimeout(this.hideBrushCursorTimeout);

            this.svgOverlay.updateCursor({
                x: this.renderWidth / 2,
                y: this.renderHeight / 2,
                isVisible: true,
            });

            this.hideBrushCursorTimeout = setTimeout(() => {
                if (this.pointer !== null) {
                    return;
                }
                this.svgOverlay.updateCursor({isVisible: false});
            }, 500);
        }
    }

    zoomByStep (stepNum: number): void {
        if (!this.internalZoomByStep(stepNum, this.renderWidth / 2, this.renderHeight / 2)) {
            return;
        }

        this.lastRenderedState = -1;
        this.reqFrame();

        this.onViewChange({
            changed: ['scale'],
            angle: this.targetTransformObj.angle,
            scale: this.targetTransformObj.scale,
        });
    }

    resetView (doAnimate?: boolean): void {
        this.targetTransformObj.scale = 1;
        this.targetTransformObj.angle = 0;

        this.targetTransformObj.x = (this.renderWidth - this.klCanvas.getWidth()) / 2;
        this.targetTransformObj.y = (this.renderHeight - this.klCanvas.getHeight()) / 2;

        if (doAnimate) {
            this.doAnimateTranslate = true;
            this.transformIsDirty = true;
        } else {
            this.highResTransformObj = BB.copyObj(this.targetTransformObj);
        }

        this.bgVisible = this.testBgVisible();
        this.reqFrame();

        if (doAnimate) {
            this.onViewChange({
                changed: ['scale', 'angle'],
                scale: this.targetTransformObj.scale,
                angle: this.targetTransformObj.angle,
            });
        }
    }

    /**
     * fit into view. center. snap angle. padding
     * returns true if transform changes
     */
    fitView (doAnimate?: boolean): boolean {
        // determine new transform
        const newAngle = this.snapAngleRad(this.targetTransformObj.angle, 90, 90);

        //calc width and height of bounds
        const canvasPointsArr = [
            [0, 0], // top left
            [this.klCanvas.getWidth(), 0], // top right
            [this.klCanvas.getWidth(), this.klCanvas.getHeight()], // bottom right
            [0, this.klCanvas.getHeight()], // bottom left
            [this.klCanvas.getWidth() / 2, this.klCanvas.getHeight() / 2], // center
        ];

        //setup transformation matrix
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(newAngle));

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
            this.renderWidth - padding, 
            this.renderHeight - padding, 
            1
        );

        //determine scale
        const factor = Math.min(MAX_SCALE, fitWidth / boundsWidth);

        const newTargetTransformObj = {
            angle: newAngle,
            x: (this.renderWidth / 2) - (canvasPointsArr[4][0] - canvasPointsArr[0][0]) * factor,
            y: (this.renderHeight / 2) - (canvasPointsArr[4][1] - canvasPointsArr[0][1]) * factor,
            scale: factor,
        };

        if (
            newTargetTransformObj.angle === this.targetTransformObj.angle &&
            Math.abs(newTargetTransformObj.x - this.targetTransformObj.x) < 0.0000000001 &&
            Math.abs(newTargetTransformObj.y - this.targetTransformObj.y) < 0.0000000001 &&
            newTargetTransformObj.scale === this.targetTransformObj.scale
        ) {
            return false;
        }
        this.targetTransformObj = newTargetTransformObj;

        if (doAnimate) {
            this.doAnimateTranslate = true;
        } else {
            this.highResTransformObj = BB.copyObj(this.targetTransformObj);
        }
        this.transformIsDirty = true;
        this.reqFrame();

        if (doAnimate) {
            this.onViewChange({
                changed: ['scale', 'angle'],
                scale: this.targetTransformObj.scale,
                angle: this.targetTransformObj.angle,
            });
        }
        return true;
    }

    /**
     * let the workspace decide what is best. E.g. if it's pixel art, Fit might be better.
     */
    resetOrFitView (): void {
        const threshold = 4; // >= 400% zoom. pixelated, not blurry
        if (
            !klConfig.disableAutoFit &&
            this.klCanvas.getWidth() <= this.renderWidth / threshold &&
            this.klCanvas.getHeight() <= this.renderHeight / threshold
        ) {
            this.fitView();
        } else {
            this.resetView();
        }
    }

    setAngle (angleDeg: number, isRelative?: boolean): void {
        //rotation done around center
        const centerObj = {
            x: this.renderWidth / 2,
            y: this.renderHeight / 2,
        };

        const oldAngleRad = this.targetTransformObj.angle;
        const angleRad = angleDeg / 180 * Math.PI;

        if (isRelative) {
            this.targetTransformObj.angle += angleRad;
        } else {
            this.targetTransformObj.angle = angleRad;
        }

        this.targetTransformObj.angle = this.minimizeAngleRad(
            this.snapAngleRad(
                this.targetTransformObj.angle,
                90,
                4
            )
        );

        //rotate transform.xy
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(centerObj.x, centerObj.y));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(this.targetTransformObj.angle - oldAngleRad));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-centerObj.x, -centerObj.y));

        let origin: TVec4 = [this.targetTransformObj.x, this.targetTransformObj.y, 0, 1];
        origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);
        this.targetTransformObj.x = origin[0];
        this.targetTransformObj.y = origin[1];

        this.highResTransformObj = BB.copyObj(this.targetTransformObj);
        this.transformIsDirty = true;
        this.reqFrame(true);
    }

    /**
     * translate canvas by viewport pixels
     * @param tx
     * @param ty
     */
    translateView (tx: number, ty: number): void {
        const scale = 40;

        this.targetTransformObj.x += tx * scale;
        this.targetTransformObj.y += ty * scale;

        this.transformIsDirty = true;
        this.doAnimateTranslate = true;
        this.reqFrame(true);
    }

    getIsDrawing (): boolean {
        return this.isDrawing;
    }

    getScale (): number {
        return this.targetTransformObj.scale;
    }

    getAngleDeg (): number {
        return this.targetTransformObj.angle * 180 / Math.PI;
    }

    getMaxScale (): number {
        return MAX_SCALE;
    }

    getMinScale (): number {
        return MIN_SCALE;
    }

    requestFrame (): void {
        this.lastRenderedState = -1;
        this.reqFrame();
    }

    setLastDrawEvent (x?: number, y?: number, pressure?: number): void {
        if (x === undefined) {
            this.lastDrawEvent = null;
            return;
        }

        if (!this.lastDrawEvent) {
            this.lastDrawEvent = {x: 0, y: 0, pressure: 0};
        }
        this.lastDrawEvent.x = x;
        this.lastDrawEvent.y = y!;
        this.lastDrawEvent.pressure = pressure!;
    }

}
