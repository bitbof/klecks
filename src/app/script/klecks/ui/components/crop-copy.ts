import {BB} from '../../../bb/bb';
import {KeyListener} from '../../../bb/input/key-listener';
import {PointerListener} from '../../../bb/input/pointer-listener';
import {IRect, IVector2D} from '../../../bb/bb-types';
import {theme} from '../../../theme/theme';

/**
 * element that lets you crop an image and copy it via right click
 */
export class CropCopy {

    private readonly rootEl: HTMLElement;
    private readonly eventTarget: HTMLElement;
    private crop: IRect = {x: 0, y: 0, width: 0, height: 0};
    private readonly croppedCanvas: HTMLCanvasElement;
    private readonly keyListener: KeyListener;
    private readonly pointerListener: PointerListener;
    private readonly canvas: HTMLImageElement | HTMLCanvasElement;
    private readonly onChange: undefined | ((width: number, height: number) => void);
    private readonly selectionRect: HTMLElement;
    private readonly thumbX: number;
    private readonly thumbY: number;
    private readonly scaleW: number;
    private readonly scaleH: number;
    private readonly croppedImage: undefined | HTMLImageElement;


    private resetCrop (): void {
        this.crop = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height,
        };
    }
    private updateCroppedCanvas (): void {
        this.croppedCanvas.width = Math.round(this.crop.width);
        this.croppedCanvas.height = Math.round(this.crop.height);
        const ctx = BB.ctx(this.croppedCanvas);
        ctx.drawImage(this.canvas, Math.round(-this.crop.x), Math.round(-this.crop.y));
        if (this.croppedImage) {
            this.croppedImage.src = this.croppedCanvas.toDataURL('image/png');
        }

        this.onChange && this.onChange(this.croppedCanvas.width, this.croppedCanvas.height);
    }
    private updateSelectionRect (): void {
        BB.css(this.selectionRect, {
            left: (this.thumbX + this.crop.x * this.scaleW) + 'px',
            top: (this.thumbY + this.crop.y * this.scaleH) + 'px',
            width: (this.crop.width * this.scaleW) + 'px',
            height: (this.crop.height * this.scaleH) + 'px',
        });
        this.onChange && this.onChange(Math.round(this.crop.width), Math.round(this.crop.height));
    }

    // ---- public ----

    constructor (
        param: {
            width: number;
            height: number;
            canvas: HTMLImageElement | HTMLCanvasElement;
            isNotCopy: boolean;
            onChange?: (width: number, height: number) => void;
        }
    ) {
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
            const rect = {
                x: Math.round(this.thumbX + this.crop.x * this.scaleW),
                y: Math.round(this.thumbY + this.crop.y * this.scaleH),
                width: Math.round(this.crop.width * this.scaleW),
                height: Math.round(this.crop.height * this.scaleH),
            };
            return BB.isInsideRect(p, rect);
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

        const padding = 20;
        const previewWrapper = BB.el({
            css: {
                width: param.width + 'px',
                height: param.height + 'px',
                position: 'absolute',
                left: '0',
                top: '0',
                pointerEvents: 'none',
            },
        });
        this.rootEl.append(previewWrapper);
        BB.createCheckerDataUrl(4, (v) => {
            previewWrapper.style.backgroundImage = 'url('+v+')';
        }, theme.isDark());

        const thumbSize = BB.fitInto(this.canvas.width, this.canvas.height, param.width - padding * 2, param.height - padding * 2, 1);
        const thumbCanvas = BB.canvas(Math.round(thumbSize.width), Math.round(thumbSize.height));
        thumbCanvas.style.imageRendering = 'pixelated';
        this.scaleW = thumbCanvas.width / this.canvas.width;
        this.scaleH = thumbCanvas.height / this.canvas.height;
        const thumbCtx = BB.ctx(thumbCanvas);
        thumbCtx.imageSmoothingEnabled = false;
        thumbCtx.drawImage(this.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        previewWrapper.append(thumbCanvas);
        this.thumbX = parseInt('' + ((param.width - thumbCanvas.width) / 2));
        this.thumbY = parseInt('' + ((param.height - thumbCanvas.height) / 2));
        BB.css(thumbCanvas, {
            position: 'absolute',
            left: this.thumbX + 'px',
            top: this.thumbY + 'px',
        });

        this.selectionRect = BB.el({
            parent: previewWrapper,
            className: 'kl-edit-crop-preview__sel',
        });
        this.updateSelectionRect();


        const toOriginalSpace = (p: IVector2D): IVector2D => {
            return {
                x: BB.clamp((p.x - this.thumbX) / this.scaleW, 0, this.canvas.width),
                y: BB.clamp((p.y - this.thumbY) / this.scaleH, 0, this.canvas.height),
            };
        };
        //gen crop from thumb-space points
        const genCrop = (p1: IVector2D, p2: IVector2D): IRect => {
            const topLeftP = {
                x: Math.min(p1.x, p2.x),
                y: Math.min(p1.y, p2.y),
            };
            const bottomRightP = {
                x: Math.max(p1.x, p2.x),
                y: Math.max(p1.y, p2.y),
            };
            const origTopLeftP = toOriginalSpace(topLeftP);
            const origBottomRightP = toOriginalSpace(bottomRightP);
            origTopLeftP.x = Math.floor(origTopLeftP.x);
            origTopLeftP.y = Math.floor(origTopLeftP.y);
            origBottomRightP.x = Math.ceil(origBottomRightP.x);
            origBottomRightP.y = Math.ceil(origBottomRightP.y);
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
        this.pointerListener = new BB.PointerListener({
            target: this.eventTarget,
            fixScribble: true,
            onPointer: (event) => {
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
                        this.crop.x = startCrop.x + Math.round((event.relX - startP!.x) / this.scaleW);
                        this.crop.y = startCrop.y + Math.round((event.relY - startP!.y) / this.scaleH);
                        this.crop.x = BB.clamp(this.crop.x, 0, this.canvas.width - this.crop.width);
                        this.crop.y = BB.clamp(this.crop.y, 0, this.canvas.height - this.crop.height);
                    } else {
                        this.crop = genCrop(startP!, {x: event.relX, y: event.relY});
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
            },
        });

        this.keyListener = new BB.KeyListener({
            onDown: (keyStr, e, comboStr) => {
                if (isDragging) {
                    return;
                }
                let doUpdate = false;

                const stepSize = Math.max(1, 1 / this.scaleW);
                const shiftIsPressed = this.keyListener.isPressed('shift');

                if (keyStr === 'left') {
                    if (shiftIsPressed) {
                        this.crop.width = BB.clamp(this.crop.width - stepSize, 1, this.canvas.width - this.crop.x);
                    } else {
                        this.crop.x = BB.clamp(this.crop.x - stepSize, 0, this.canvas.width - this.crop.width);
                    }
                    doUpdate = true;
                }
                if (keyStr === 'right') {
                    if (shiftIsPressed) {
                        this.crop.width = BB.clamp(this.crop.width + stepSize, 1, this.canvas.width - this.crop.x);
                    } else {
                        this.crop.x = BB.clamp(this.crop.x + stepSize, 0, this.canvas.width - this.crop.width);
                    }
                    doUpdate = true;
                }
                if (keyStr === 'up') {
                    if (shiftIsPressed) {
                        this.crop.height = BB.clamp(this.crop.height - stepSize, 1, this.canvas.height - this.crop.y);
                    } else {
                        this.crop.y = BB.clamp(this.crop.y - stepSize, 0, this.canvas.height - this.crop.height);
                    }
                    doUpdate = true;
                }
                if (keyStr === 'down') {
                    if (shiftIsPressed) {
                        this.crop.height = BB.clamp(this.crop.height + stepSize, 1, this.canvas.height - this.crop.y);
                    } else {
                        this.crop.y = BB.clamp(this.crop.y + stepSize, 0, this.canvas.height - this.crop.height);
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

    getEl (): HTMLElement {
        return this.rootEl;
    }
    reset (): void {
        this.resetCrop();
        this.updateCroppedCanvas();
        this.updateSelectionRect();
    }
    destroy (): void {
        this.eventTarget.style.removeProperty('width');
        this.eventTarget.style.removeProperty('height');
        this.keyListener.destroy();
        this.pointerListener.destroy();
    }
    isReset (): boolean {
        return this.crop.x === 0 && this.crop.y === 0 && this.crop.width === this.canvas.width && this.crop.height === this.canvas.height;
    }
    getRect (): IRect {
        return BB.copyObj(this.crop);
    }
    getCroppedImage (): HTMLCanvasElement {
        return this.croppedCanvas;
    }
}

