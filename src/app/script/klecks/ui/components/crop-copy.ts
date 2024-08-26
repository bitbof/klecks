import { BB } from '../../../bb/bb';
import { KeyListener } from '../../../bb/input/key-listener';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { IRect, IVector2D } from '../../../bb/bb-types';
import { Preview, TPreviewMode } from '../project-viewport/preview';
import { applyToPoint, inverse } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { clamp } from '../../../bb/math/math';
import { LANG } from '../../../language/language';
import editCropImg from '/src/app/img/ui/edit-crop.svg';
import { EventChain } from '../../../bb/input/event-chain/event-chain';
import { OnePointerLimiter } from '../../../bb/input/event-chain/one-pointer-limiter';
import { IChainElement } from '../../../bb/input/event-chain/event-chain.types';

/**
 * element that lets you crop an image and copy it via right click
 */
export class CropCopy {
    private readonly rootEl: HTMLElement;
    private readonly eventTarget: HTMLElement;
    private crop: IRect = { x: 0, y: 0, width: 0, height: 0 }; // canvas coordinates
    private readonly croppedCanvas: HTMLCanvasElement;
    private readonly croppedImage: undefined | HTMLImageElement; // isn't canvas enough?
    private readonly keyListener: KeyListener;
    private readonly pointerListener: PointerListener;
    private readonly canvas: HTMLImageElement | HTMLCanvasElement;
    private readonly onChange: undefined | ((width: number, height: number) => void);
    private readonly selectionRectEl: HTMLElement;
    private readonly preview: Preview;
    private mode: TPreviewMode = 'edit';

    private resetCrop(): void {
        this.crop = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height,
        };
    }

    private getViewportSelectionRect(): IRect {
        const transform = this.preview.getTransform();
        const mat = createMatrixFromTransform(transform);
        const p = applyToPoint(mat, this.crop);
        return {
            x: p.x,
            y: p.y,
            width: this.crop.width * transform.scale,
            height: this.crop.height * transform.scale,
        };
    }

    private updateCroppedCanvas(): void {
        this.croppedCanvas.width = Math.round(this.crop.width);
        this.croppedCanvas.height = Math.round(this.crop.height);
        const ctx = BB.ctx(this.croppedCanvas);
        ctx.drawImage(this.canvas, Math.round(-this.crop.x), Math.round(-this.crop.y));
        if (this.croppedImage) {
            this.croppedImage.src = this.croppedCanvas.toDataURL('image/png');
        }
        this.onChange && this.onChange(this.croppedCanvas.width, this.croppedCanvas.height);
    }
    private updateSelectionRect(): void {
        const rect = this.getViewportSelectionRect();

        BB.css(this.selectionRectEl, {
            left: rect.x + 'px',
            top: rect.y + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px',
            display: this.isReset() ? 'none' : '',
        });
        this.onChange && this.onChange(Math.round(this.crop.width), Math.round(this.crop.height));
    }

    // ----------------------------------- public -----------------------------------

    constructor(param: {
        width: number;
        height: number;
        canvas: HTMLImageElement | HTMLCanvasElement;
        isNotCopy: boolean;
        onChange?: (width: number, height: number) => void;
    }) {
        this.rootEl = BB.el({
            className: 'kl-edit-crop-preview',
            css: {
                position: 'relative',
                height: param.height + 'px',
                width: param.width + 'px',
                overflow: 'hidden',
            },
        });
        if (param.onChange) {
            this.onChange = param.onChange;
        }
        this.canvas = param.canvas;

        this.resetCrop();

        const isInsideSelectionRect = (p: IVector2D): boolean => {
            return BB.isInsideRect(p, this.getViewportSelectionRect());
        };

        this.croppedCanvas = BB.canvas();
        this.eventTarget = this.croppedCanvas;
        if (!param.isNotCopy) {
            this.croppedImage = new Image();
            this.eventTarget = this.croppedImage;
        }
        BB.css(this.eventTarget, {
            height: param.height + 'px',
            width: param.width + 'px',
        });
        this.rootEl.append(this.eventTarget);
        this.updateCroppedCanvas();

        this.preview = new Preview({
            width: param.width,
            height: param.height - 2, // subtract border
            project: {
                width: param.canvas.width,
                height: param.canvas.height,
                layers: [
                    {
                        image: param.canvas,
                        opacity: 1,
                        isVisible: true,
                        mixModeStr: 'source-over',
                        hasClipping: false,
                    },
                ],
            },
            hasEditMode: true,
            onModeChange: (mode) => {
                this.mode = mode;
                this.preview.getElement().style.pointerEvents = mode === 'edit' ? 'none' : '';
                this.rootEl.title = mode === 'edit' ? LANG('crop-drag-to-crop') : '';
            },
            onTransformChange: () => this.updateSelectionRect(),
            padding: 20,
            hasBorder: false,
            editIcon: editCropImg,
        });
        BB.css(this.preview.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
            overflow: 'hidden',
            pointerEvents: 'none',
        });
        this.preview.render();
        this.rootEl.append(this.preview.getElement());

        this.selectionRectEl = BB.el({
            parent: this.preview.getElement(),
            className: 'kl-edit-crop-preview__sel',
        });
        this.updateSelectionRect();

        //gen crop from viewport points
        const genCrop = (p1: IVector2D, p2: IVector2D): IRect => {
            const mat = createMatrixFromTransform(this.preview.getTransform());
            const inverseMat = inverse(mat);
            const topLeftP = {
                x: Math.min(p1.x, p2.x),
                y: Math.min(p1.y, p2.y),
            };
            const bottomRightP = {
                x: Math.max(p1.x, p2.x),
                y: Math.max(p1.y, p2.y),
            };
            const origTopLeftP = applyToPoint(inverseMat, topLeftP);
            const origBottomRightP = applyToPoint(inverseMat, bottomRightP);
            origTopLeftP.x = clamp(Math.floor(origTopLeftP.x), 0, this.canvas.width);
            origTopLeftP.y = clamp(Math.floor(origTopLeftP.y), 0, this.canvas.height);
            origBottomRightP.x = clamp(Math.ceil(origBottomRightP.x), 0, this.canvas.width);
            origBottomRightP.y = clamp(Math.ceil(origBottomRightP.y), 0, this.canvas.height);
            return {
                x: origTopLeftP.x,
                y: origTopLeftP.y,
                width: origBottomRightP.x - origTopLeftP.x,
                height: origBottomRightP.y - origTopLeftP.y,
            };
        };

        let startP: IVector2D | null;
        let startCrop: IRect | null = null;
        let isDragging = false;
        let didMove = false;
        let updateCropTimeout: ReturnType<typeof setTimeout>;
        const pointerChain = new EventChain({
            chainArr: [new OnePointerLimiter() as IChainElement],
        });
        pointerChain.setChainOut((event) => {
            if (event.type === 'pointerdown' && event.button === 'left') {
                event.eventPreventDefault();
                isDragging = true;
                startP = {
                    x: event.relX,
                    y: event.relY,
                };
                if (!this.isReset() && isInsideSelectionRect(startP)) {
                    startCrop = {
                        x: this.crop.x,
                        y: this.crop.y,
                        width: this.crop.width,
                        height: this.crop.height,
                    };
                } else {
                    this.crop = genCrop(startP, startP);
                }
            } else if (event.type === 'pointermove' && event.button === 'left') {
                event.eventPreventDefault();
                didMove = true;
                if (startCrop) {
                    const transform = this.preview.getTransform();
                    this.crop.x =
                        startCrop.x + Math.round((event.relX - startP!.x) / transform.scale);
                    this.crop.y =
                        startCrop.y + Math.round((event.relY - startP!.y) / transform.scale);
                    this.crop.x = BB.clamp(this.crop.x, 0, this.canvas.width - this.crop.width);
                    this.crop.y = BB.clamp(this.crop.y, 0, this.canvas.height - this.crop.height);
                } else {
                    this.crop = genCrop(startP!, {
                        x: event.relX,
                        y: event.relY,
                    });
                }
                this.updateSelectionRect();
            } else if (event.type === 'pointerup' && startP) {
                event.eventPreventDefault();
                isDragging = false;
                startCrop = null;
                startP = null;
                if (this.crop.width === 0 || this.crop.height === 0 || !didMove) {
                    this.resetCrop();
                    this.updateSelectionRect();
                }
                didMove = false;
                updateCropTimeout = setTimeout(() => this.updateCroppedCanvas(), 1);
            }
        });
        this.pointerListener = new BB.PointerListener({
            target: this.eventTarget,
            fixScribble: true,
            onWheel: (event) => {
                this.preview.onWheel(event);
            },
            onPointer: (event) => {
                if (this.mode === 'hand') {
                    event.eventPreventDefault();
                    this.preview.onPointer(event);
                    return;
                }
                pointerChain.chainIn(event);
            },
            maxPointers: 2,
        });

        this.keyListener = new BB.KeyListener({
            onDown: (keyStr, e) => {
                if (isDragging) {
                    return;
                }
                let doUpdate = false;
                const transform = this.preview.getTransform();

                const stepSize = Math.max(1, 1 / transform.scale);
                const shiftIsPressed = this.keyListener.isPressed('shift');

                if (keyStr === 'left') {
                    if (shiftIsPressed) {
                        this.crop.width = BB.clamp(
                            this.crop.width - stepSize,
                            1,
                            this.canvas.width - this.crop.x,
                        );
                    } else {
                        this.crop.x = BB.clamp(
                            this.crop.x - stepSize,
                            0,
                            this.canvas.width - this.crop.width,
                        );
                    }
                    doUpdate = true;
                }
                if (keyStr === 'right') {
                    if (shiftIsPressed) {
                        this.crop.width = BB.clamp(
                            this.crop.width + stepSize,
                            1,
                            this.canvas.width - this.crop.x,
                        );
                    } else {
                        this.crop.x = BB.clamp(
                            this.crop.x + stepSize,
                            0,
                            this.canvas.width - this.crop.width,
                        );
                    }
                    doUpdate = true;
                }
                if (keyStr === 'up') {
                    if (shiftIsPressed) {
                        this.crop.height = BB.clamp(
                            this.crop.height - stepSize,
                            1,
                            this.canvas.height - this.crop.y,
                        );
                    } else {
                        this.crop.y = BB.clamp(
                            this.crop.y - stepSize,
                            0,
                            this.canvas.height - this.crop.height,
                        );
                    }
                    doUpdate = true;
                }
                if (keyStr === 'down') {
                    if (shiftIsPressed) {
                        this.crop.height = BB.clamp(
                            this.crop.height + stepSize,
                            1,
                            this.canvas.height - this.crop.y,
                        );
                    } else {
                        this.crop.y = BB.clamp(
                            this.crop.y + stepSize,
                            0,
                            this.canvas.height - this.crop.height,
                        );
                    }
                    doUpdate = true;
                }

                if (doUpdate) {
                    e.preventDefault();
                    this.updateSelectionRect();
                    clearTimeout(updateCropTimeout);
                    updateCropTimeout = setTimeout(() => this.updateCroppedCanvas(), 100);
                }
            },
        });
    }

    // ---- interface ----

    getEl(): HTMLElement {
        return this.rootEl;
    }
    reset(): void {
        this.resetCrop();
        this.updateCroppedCanvas();
        this.updateSelectionRect();
    }
    isReset(): boolean {
        return (
            this.crop.x === 0 &&
            this.crop.y === 0 &&
            this.crop.width === this.canvas.width &&
            this.crop.height === this.canvas.height
        );
    }
    getRect(): IRect {
        return BB.copyObj(this.crop);
    }
    getCroppedCanvas(): HTMLCanvasElement {
        return this.croppedCanvas;
    }
    destroy(): void {
        this.rootEl.remove();
        this.eventTarget.style.removeProperty('width');
        this.eventTarget.style.removeProperty('height');
        this.keyListener.destroy();
        this.pointerListener.destroy();
        this.preview.destroy();
    }
}
