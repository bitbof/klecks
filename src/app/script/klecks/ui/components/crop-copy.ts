import { BB } from '../../../bb/bb';
import { KeyListener } from '../../../bb/input/key-listener';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { TRect, TVector2D } from '../../../bb/bb-types';
import { Preview, TPreviewMode } from '../project-viewport/preview';
import { applyToPoint, inverse } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { clamp } from '../../../bb/math/math';
import { LANG } from '../../../language/language';
import editCropImg from 'url:/src/app/img/ui/edit-crop.svg';
import { EventChain } from '../../../bb/input/event-chain/event-chain';
import { OnePointerLimiter } from '../../../bb/input/event-chain/one-pointer-limiter';
import { TChainElement } from '../../../bb/input/event-chain/event-chain.types';
import { canvasToBlob } from '../../../bb/base/canvas';
import { TProjectViewportProject } from '../project-viewport/project-viewport';
import { css } from '../../../bb/base/base';

export type TCropCopyParams = {
    // size of dom element
    width: number;

    // size of dom element
    height: number;

    // image to be cropped
    canvas: HTMLImageElement | HTMLCanvasElement;

    // when cropping area changes
    onChange?: (width: number, height: number) => void;

    // If true, renders cropped area as invisible image on top.
    // You can't right-click on a canvas and copy it in Firefox.
    enableRightClickCopy: boolean;

    // initial crop rect
    init?: TRect;
};

/**
 * element that lets you crop an image and copy it via right click
 */
export class CropCopy {
    private readonly rootEl: HTMLElement;
    private readonly eventTarget: HTMLElement;
    private cropRect: TRect = { x: 0, y: 0, width: 0, height: 0 }; // canvas coordinates
    private readonly croppedCanvas: HTMLCanvasElement;
    // Element that can be right-clicked to copy. Not possible with canvas in firefox.
    // undefined if enableRightClickCopy = false
    private readonly croppedImageElement: undefined | HTMLImageElement;
    private croppedBlob: Blob;
    private croppedObjectUrl: string;
    private readonly keyListener: KeyListener;
    private readonly pointerListener: PointerListener;
    private canvas: HTMLImageElement | HTMLCanvasElement;
    private readonly onChange: undefined | ((width: number, height: number) => void);
    private readonly selectionRectEl: HTMLElement;
    private readonly preview: Preview;
    private mode: TPreviewMode = 'edit';
    private previewLayer: TProjectViewportProject['layers'][number];

    private resetCrop(): void {
        this.cropRect = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height,
        };
    }

    private getViewportSelectionRect(): TRect {
        const transform = this.preview.getTransform();
        const mat = createMatrixFromTransform(transform);
        const p = applyToPoint(mat, this.cropRect);
        return {
            x: p.x,
            y: p.y,
            width: this.cropRect.width * transform.scale,
            height: this.cropRect.height * transform.scale,
        };
    }

    private async updateCroppedCanvas(): Promise<void> {
        this.croppedCanvas.width = Math.round(this.cropRect.width);
        this.croppedCanvas.height = Math.round(this.cropRect.height);
        const ctx = BB.ctx(this.croppedCanvas);
        ctx.drawImage(this.canvas, Math.round(-this.cropRect.x), Math.round(-this.cropRect.y));

        const blob = await canvasToBlob(this.croppedCanvas, 'image/png');
        this.croppedBlob = blob;
        if (this.croppedObjectUrl !== '') {
            URL.revokeObjectURL(this.croppedObjectUrl);
        }
        this.croppedObjectUrl = URL.createObjectURL(blob);
        if (this.croppedImageElement) {
            this.croppedImageElement.src = this.croppedObjectUrl;
        }
        this.onChange?.(this.croppedCanvas.width, this.croppedCanvas.height);
    }
    private updateSelectionRect(): void {
        const rect = this.getViewportSelectionRect();

        css(this.selectionRectEl, {
            left: rect.x + 'px',
            top: rect.y + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px',
            display: this.isReset() ? 'none' : '',
        });
        this.onChange?.(Math.round(this.cropRect.width), Math.round(this.cropRect.height));
    }

    private isReset(): boolean {
        return (
            this.cropRect.x === 0 &&
            this.cropRect.y === 0 &&
            this.cropRect.width === this.canvas.width &&
            this.cropRect.height === this.canvas.height
        );
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TCropCopyParams) {
        this.rootEl = BB.el({
            className: 'kl-edit-crop-preview',
            css: {
                position: 'relative',
                height: p.height + 'px',
                width: p.width + 'px',
                overflow: 'hidden',
            },
        });
        if (p.onChange) {
            this.onChange = p.onChange;
        }
        this.canvas = p.canvas;

        if (p.init) {
            this.cropRect = p.init;
        } else {
            this.resetCrop();
        }

        const isInsideSelectionRect = (p: TVector2D): boolean => {
            return BB.isInsideRect(p, this.getViewportSelectionRect());
        };

        this.croppedCanvas = BB.canvas();
        this.croppedBlob = {} as Blob;
        this.croppedObjectUrl = '';

        this.eventTarget = this.croppedCanvas;
        if (p.enableRightClickCopy) {
            this.croppedImageElement = new Image();
            this.eventTarget = this.croppedImageElement;
        }
        css(this.eventTarget, {
            height: p.height + 'px',
            width: p.width + 'px',
        });
        this.rootEl.append(this.eventTarget);
        this.updateCroppedCanvas();

        this.previewLayer = {
            image: p.canvas,
            opacity: 1,
            isVisible: true,
            mixModeStr: 'source-over',
            hasClipping: false,
        };
        this.preview = new Preview({
            width: p.width,
            height: p.height - 2, // subtract border
            project: {
                width: p.canvas.width,
                height: p.canvas.height,
                layers: [this.previewLayer],
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
        css(this.preview.getElement(), {
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
        const genCrop = (p1: TVector2D, p2: TVector2D): TRect => {
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

        let startP: TVector2D | null;
        let startCrop: TRect | null = null;
        let isDragging = false;
        let didMove = false;
        let updateCropTimeout: ReturnType<typeof setTimeout>;
        const pointerChain = new EventChain({
            chainArr: [new OnePointerLimiter() as TChainElement],
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
                        x: this.cropRect.x,
                        y: this.cropRect.y,
                        width: this.cropRect.width,
                        height: this.cropRect.height,
                    };
                } else {
                    this.cropRect = genCrop(startP, startP);
                }
            } else if (event.type === 'pointermove' && event.button === 'left') {
                event.eventPreventDefault();
                didMove = true;
                if (startCrop) {
                    const transform = this.preview.getTransform();
                    this.cropRect.x =
                        startCrop.x + Math.round((event.relX - startP!.x) / transform.scale);
                    this.cropRect.y =
                        startCrop.y + Math.round((event.relY - startP!.y) / transform.scale);
                    this.cropRect.x = BB.clamp(
                        this.cropRect.x,
                        0,
                        this.canvas.width - this.cropRect.width,
                    );
                    this.cropRect.y = BB.clamp(
                        this.cropRect.y,
                        0,
                        this.canvas.height - this.cropRect.height,
                    );
                } else {
                    this.cropRect = genCrop(startP!, {
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
                if (this.cropRect.width === 0 || this.cropRect.height === 0 || !didMove) {
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
                        this.cropRect.width = BB.clamp(
                            this.cropRect.width - stepSize,
                            1,
                            this.canvas.width - this.cropRect.x,
                        );
                    } else {
                        this.cropRect.x = BB.clamp(
                            this.cropRect.x - stepSize,
                            0,
                            this.canvas.width - this.cropRect.width,
                        );
                    }
                    doUpdate = true;
                }
                if (keyStr === 'right') {
                    if (shiftIsPressed) {
                        this.cropRect.width = BB.clamp(
                            this.cropRect.width + stepSize,
                            1,
                            this.canvas.width - this.cropRect.x,
                        );
                    } else {
                        this.cropRect.x = BB.clamp(
                            this.cropRect.x + stepSize,
                            0,
                            this.canvas.width - this.cropRect.width,
                        );
                    }
                    doUpdate = true;
                }
                if (keyStr === 'up') {
                    if (shiftIsPressed) {
                        this.cropRect.height = BB.clamp(
                            this.cropRect.height - stepSize,
                            1,
                            this.canvas.height - this.cropRect.y,
                        );
                    } else {
                        this.cropRect.y = BB.clamp(
                            this.cropRect.y - stepSize,
                            0,
                            this.canvas.height - this.cropRect.height,
                        );
                    }
                    doUpdate = true;
                }
                if (keyStr === 'down') {
                    if (shiftIsPressed) {
                        this.cropRect.height = BB.clamp(
                            this.cropRect.height + stepSize,
                            1,
                            this.canvas.height - this.cropRect.y,
                        );
                    } else {
                        this.cropRect.y = BB.clamp(
                            this.cropRect.y + stepSize,
                            0,
                            this.canvas.height - this.cropRect.height,
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

    getElement(): HTMLElement {
        return this.rootEl;
    }

    // in input canvas coordinates
    getCropRect(): TRect {
        return BB.copyObj(this.cropRect);
    }
    getCroppedCanvas(): HTMLCanvasElement {
        return this.croppedCanvas;
    }

    // image/png blob
    getCroppedBlob(): Blob {
        return this.croppedBlob;
    }

    setCanvas(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.previewLayer.image = canvas;
        this.updateCroppedCanvas();
        this.preview.render();
    }

    destroy(): void {
        if (this.croppedImageElement) {
            this.croppedImageElement.src = '';
        }
        URL.revokeObjectURL(this.croppedObjectUrl);
        this.rootEl.remove();
        this.eventTarget.style.removeProperty('width');
        this.eventTarget.style.removeProperty('height');
        this.keyListener.destroy();
        this.pointerListener.destroy();
        this.preview.destroy();
    }
}
