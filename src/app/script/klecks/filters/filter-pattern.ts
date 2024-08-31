import { BB } from '../../bb/bb';
import {
    IFilterApply,
    IFilterGetDialogParam,
    TFilterGetDialogResult,
    IKlBasicLayer,
} from '../kl-types';
import { input } from '../ui/components/input';
import { KlSlider } from '../ui/components/kl-slider';
import { LANG } from '../../language/language';
import { eventResMs } from './filters-consts';
import { KlCanvasPreview } from '../ui/project-viewport/kl-canvas-preview';
import { TwoTabs } from '../ui/components/two-tabs';
import { IVector2D } from '../../bb/bb-types';
import { TFilterHistoryEntry } from './filters';
import { throwIfNull } from '../../bb/base/base';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth, mediumPreview } from '../ui/utils/preview-size';

export type TFilterPatternInput = {
    x: number;
    y: number;
    width: number;
    height: number;
    blend: number; // [0, 1] - 1 will blend linearly across whole length
    offsetX: number;
    offsetY: number;
};

export type TFilterPatternHistoryEntry = TFilterHistoryEntry<'pattern', TFilterPatternInput>;

/**
 * Draws pattern onto context. Pattern generated from context.
 * Can use blending for smoother transition. Will use area outside of bounds for blending.
 *
 * @param context
 * @param settings
 */
function drawPattern(context: CanvasRenderingContext2D, settings: TFilterPatternInput): void {
    // keep bounds in center via offset
    // because blending done towards bottom right
    const blendOffsetX = settings.blend ? Math.round((settings.blend * settings.width) / 2) : 0;
    const blendOffsetY = settings.blend ? Math.round((settings.blend * settings.height) / 2) : 0;

    const finalPatternCanvas = BB.canvas(settings.width, settings.height);

    if (settings.blend) {
        // construct pattern via linear blending

        const blendCanvas = BB.canvas(settings.width * 2, settings.height * 2);
        const blendCtx = BB.ctx(blendCanvas);
        const colTransparent = '#0000';
        const colOpaque = '#000';

        // transfer source to blendCanvas
        blendCtx.drawImage(context.canvas, -settings.x + blendOffsetX, -settings.y + blendOffsetY);

        // --- 1 cross-fade vertical ------------------------

        // erase vertical gradient bottom half
        blendCtx.save();
        let blendGradient = blendCtx.createLinearGradient(
            0,
            settings.height,
            0,
            settings.height * 2,
        );
        blendGradient.addColorStop(0, colOpaque);
        blendGradient.addColorStop(settings.blend, colTransparent);
        blendCtx.globalCompositeOperation = 'destination-in';
        blendCtx.fillStyle = blendGradient;
        blendCtx.fillRect(0, 0, blendCanvas.width, blendCanvas.height);
        blendCtx.restore();

        // erase vertical gradient top half
        blendCtx.save();
        blendGradient = blendCtx.createLinearGradient(0, 0, 0, settings.height);
        blendGradient.addColorStop(0, colTransparent);
        blendGradient.addColorStop(settings.blend, colOpaque);
        blendCtx.globalCompositeOperation = 'destination-in';
        blendCtx.fillStyle = blendGradient;
        blendCtx.fillRect(0, 0, settings.width * 2, settings.height * 2);
        blendCtx.restore();

        // draw bottom half over top half
        blendCtx.save();
        // lighter needed for accurate cross-fade
        blendCtx.globalCompositeOperation = 'lighter';
        blendCtx.drawImage(blendCanvas, 0, -settings.height);
        blendCtx.restore();

        // --- 2 cross-fade horizontal ------------------------

        // erase horizontal gradient right half
        blendCtx.save();
        blendGradient = blendCtx.createLinearGradient(settings.width, 0, settings.width * 2, 0);
        blendGradient.addColorStop(0, colOpaque);
        blendGradient.addColorStop(settings.blend, colTransparent);
        blendCtx.globalCompositeOperation = 'destination-in';
        blendCtx.fillStyle = blendGradient;
        blendCtx.fillRect(0, 0, blendCanvas.width, blendCanvas.height);
        blendCtx.restore();

        // erase horizontal gradient left half
        blendCtx.save();
        blendGradient = blendCtx.createLinearGradient(0, 0, settings.width, 0);
        blendGradient.addColorStop(0, colTransparent);
        blendGradient.addColorStop(settings.blend, colOpaque);
        blendCtx.globalCompositeOperation = 'destination-in';
        blendCtx.fillStyle = blendGradient;
        blendCtx.fillRect(0, 0, settings.width * 2, settings.height * 2);
        blendCtx.restore();

        // draw right half over left half
        blendCtx.save();
        // lighter needed for accurate cross-fade
        blendCtx.globalCompositeOperation = 'lighter';
        blendCtx.drawImage(blendCanvas, -settings.width, 0);
        blendCtx.restore();

        // transfer to pattern canvas
        BB.ctx(finalPatternCanvas).drawImage(blendCanvas, 0, 0);
    } else {
        BB.ctx(finalPatternCanvas).drawImage(context.canvas, -settings.x, -settings.y);
    }

    context.save();

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.translate(settings.offsetX - blendOffsetX, settings.offsetY - blendOffsetY);
    context.fillStyle = throwIfNull(context.createPattern(finalPatternCanvas, 'repeat'));
    context.fillRect(
        -settings.offsetX + blendOffsetX,
        -settings.offsetY + blendOffsetY,
        context.canvas.width,
        context.canvas.height,
    );

    context.restore();
}

export const filterPattern = {
    getDialog(params: IFilterGetDialogParam) {
        const isSmall = testIsSmall();
        const maxSize = 1024;
        const rootEl = BB.el();
        const context = params.context;
        const width = context.canvas.width;
        const height = context.canvas.height;

        let settings: TFilterPatternInput = {
            x: 0,
            y: 0,
            width: width <= 250 ? Math.round(width / 4) : 200,
            height: height <= 250 ? Math.round(height / 4) : 200,
            blend: 0,
            offsetX: 0,
            offsetY: 0,
        };
        let lastDrawnSettings: TFilterPatternInput | undefined;

        // determine bounds
        const bounds = BB.canvasBounds(context);
        // adjust settings according to bounds
        if (
            // use layer bounds if:
            bounds &&
            bounds.width <= maxSize &&
            bounds.height <= maxSize && // don't exceed max size
            (bounds.width < width * 0.75 || bounds.height < height * 0.75) // aren't too large (heuristic)
        ) {
            settings.x = bounds.x;
            settings.y = bounds.y;
            settings.width = bounds.width;
            settings.height = bounds.height;
        } else {
            // otherwise use default size in center
            settings.x = Math.round(width / 2 - settings.width / 2);
            settings.y = Math.round(height / 2 - settings.height / 2);
        }

        // ---- controls ----

        const xInput = input({
            init: settings.x,
            type: 'number',
            min: 0,
            max: width,
            css: { width: '100%' },
            callback: function (v) {
                settings.x = Number(v);
                updatePreview();
            },
        });
        const yInput = input({
            init: settings.y,
            type: 'number',
            min: 0,
            max: height,
            css: { width: '100%' },
            callback: function (v) {
                settings.y = Number(v);
                updatePreview();
            },
        });
        const widthInput = input({
            init: settings.width,
            type: 'number',
            min: 1,
            max: Math.min(maxSize, width),
            css: { width: '100%' },
            callback: function (v) {
                settings.width = Number(v);
                updatePreview();
            },
        });
        const heightInput = input({
            init: settings.height,
            type: 'number',
            min: 1,
            max: Math.min(maxSize, height),
            css: { width: '100%' },
            callback: function (v) {
                settings.height = Number(v);
                updatePreview();
            },
        });

        const inputStyle = {
            marginLeft: '5px',
            flex: '1',
        };
        rootEl.append(
            BB.el({
                content: [
                    BB.el({
                        tagName: 'label',
                        content: ['X:', xInput],
                        css: inputStyle,
                    }),

                    BB.el({
                        tagName: 'label',
                        content: ['Y:', yInput],
                        css: inputStyle,
                    }),

                    BB.el({
                        tagName: 'label',
                        content: [LANG('width') + ':', widthInput],
                        css: inputStyle,
                    }),

                    BB.el({
                        tagName: 'label',
                        content: [LANG('height') + ':', heightInput],
                        css: inputStyle,
                    }),
                ],
                css: {
                    display: 'flex',
                    marginLeft: '-5px',
                },
            }),
        );

        const blendSlider = new KlSlider({
            label: LANG('brush-blending'),
            width: 300,
            height: 30,
            min: 0,
            max: 1,
            value: settings.blend,
            eventResMs: eventResMs,
            onChange: function (val) {
                settings.blend = val;
                updatePreview();
            },
            formatFunc: (val) => {
                return BB.round(val, 2);
            },
            manualInputRoundDigits: 2,
        });
        BB.css(blendSlider.getElement(), {
            margin: '10px 0',
        });

        rootEl.append(blendSlider.getElement());

        // ---- preview tabs ----
        let previewMode = 1; // 0 before, 1 after
        const beforeAfterTabs = new TwoTabs({
            left: LANG('compare-before'),
            right: LANG('compare-after'),
            init: previewMode,
            onChange: (val) => {
                previewMode = val;
                overlayCanvas.style.display = val === 0 ? 'block' : 'none';
                updatePreview(true);
            },
        });
        rootEl.append(beforeAfterTabs.getElement());

        // ---- previews ----

        const klCanvas = params.klCanvas;
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const fit = BB.fitInto(
            context.canvas.width,
            context.canvas.height,
            isSmall ? 280 : 490,
            isSmall ? 200 : 240,
            1,
        );
        const w = parseInt('' + fit.width),
            h = parseInt('' + fit.height);
        const renderW = Math.min(w, context.canvas.width);
        const renderH = Math.min(h, context.canvas.height);
        // const renderFactor = renderW / context.canvas.width;
        const previewFactor = w / context.canvas.width;

        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: getPreviewWidth(isSmall) + 'px',
                height: getPreviewHeight(isSmall) + 'px',
                marginTop: '0',
            },
        });

        const previewLayer: IKlBasicLayer = {
            image: BB.canvas(renderW, renderH),
            isVisible: layers[selectedLayerIndex].isVisible,
            opacity: layers[selectedLayerIndex].opacity,
            mixModeStr: layers[selectedLayerIndex].mixModeStr,
        };
        const previewLayerArr = layers.map((item, i) => {
            if (i === selectedLayerIndex) {
                return previewLayer;
            } else {
                return {
                    image: item.context.canvas,
                    isVisible: item.isVisible,
                    opacity: item.opacity,
                    mixModeStr: item.mixModeStr,
                };
            }
        });
        const klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: previewLayerArr,
        });

        const overlayCanvas = BB.canvas(w, h);
        BB.css(overlayCanvas, {
            position: 'absolute',
            left: '0',
            top: '0',
            mixBlendMode: 'difference',
            imageRendering: 'pixelated',
        });

        const previewInnerWrapper = BB.el({
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: parseInt('' + w) + 'px',
                height: parseInt('' + h) + 'px',
            },
        });
        previewInnerWrapper.append(klCanvasPreview.getElement(), overlayCanvas);
        previewWrapper.append(previewInnerWrapper);
        rootEl.append(previewWrapper);

        // ---- preview input processing ----
        const inputs = {} as {
            start: IVector2D;
            end: IVector2D | null;
            oldSettings: TFilterPatternInput;
            state: null | 'move' | 'select';
        };

        function syncInputs(): void {
            xInput.value = '' + settings.x;
            yInput.value = '' + settings.y;
            widthInput.value = '' + settings.width;
            heightInput.value = '' + settings.height;
        }

        const keyListener = new BB.KeyListener({});

        previewWrapper.oncontextmenu = function () {
            return false;
        };
        previewInnerWrapper.style.touchAction = 'none';
        const pointerListener = new BB.PointerListener({
            target: previewInnerWrapper,
            onPointer: (event) => {
                if (previewMode === 0) {
                    if (event.type === 'pointerdown') {
                        if (!inputs.state) {
                            inputs.oldSettings = BB.copyObj(settings);

                            const x = event.relX / previewFactor;
                            const y = event.relY / previewFactor;

                            if (
                                BB.isInsideRect(
                                    { x, y },
                                    {
                                        x: settings.x,
                                        y: settings.y,
                                        width: settings.width,
                                        height: settings.height,
                                    },
                                )
                            ) {
                                inputs.state = 'move';
                            } else {
                                inputs.state = 'select';
                            }
                            inputs.start = { x, y };
                        }
                    } else if (event.type === 'pointermove') {
                        const x = event.relX / previewFactor;
                        const y = event.relY / previewFactor;

                        if (inputs.state === 'select') {
                            inputs.end = { x, y };

                            const x1 = Math.max(0, Math.min(inputs.start.x, inputs.end.x));
                            const y1 = Math.max(0, Math.min(inputs.start.y, inputs.end.y));
                            const x2 = Math.min(width, Math.max(inputs.start.x, inputs.end.x));
                            const y2 = Math.min(height, Math.max(inputs.start.y, inputs.end.y));

                            settings.x = Math.floor(x1);
                            settings.y = Math.floor(y1);
                            settings.width = Math.min(maxSize, Math.ceil(x2 - settings.x));
                            settings.height = Math.min(maxSize, Math.ceil(y2 - settings.y));

                            if (keyListener.isPressed('shift')) {
                                settings.width = Math.min(settings.width, settings.height);
                                settings.height = Math.min(settings.width, settings.height);
                            }

                            if (settings.width === 0 || settings.height === 0) {
                                settings = BB.copyObj(inputs.oldSettings);
                            }

                            syncInputs();
                            updatePreview();
                        } else if (inputs.state === 'move') {
                            const dX = Math.round(x - inputs.start.x);
                            const dY = Math.round(y - inputs.start.y);

                            settings.x = BB.clamp(
                                inputs.oldSettings.x + dX,
                                0,
                                width - settings.width,
                            );
                            settings.y = BB.clamp(
                                inputs.oldSettings.y + dY,
                                0,
                                height - settings.height,
                            );

                            syncInputs();
                            updatePreview();
                        }
                    } else if (event.type === 'pointerup') {
                        if (inputs.state) {
                            inputs.state = null;
                        }
                    }
                } else {
                    if (event.type === 'pointerdown') {
                        if (!inputs.state) {
                            inputs.state = 'move';
                            inputs.oldSettings = BB.copyObj(settings);
                            inputs.start = {
                                x: event.relX / previewFactor,
                                y: event.relY / previewFactor,
                            };
                            inputs.end = null;
                        }
                    } else if (event.type === 'pointermove') {
                        if (inputs.state) {
                            inputs.end = {
                                x: event.relX / previewFactor,
                                y: event.relY / previewFactor,
                            };

                            settings.offsetX =
                                Math.round(inputs.end.x - inputs.start.x) +
                                inputs.oldSettings.offsetX;
                            settings.offsetY =
                                Math.round(inputs.end.y - inputs.start.y) +
                                inputs.oldSettings.offsetY;

                            updatePreview();
                        }
                    } else if (event.type === 'pointerup') {
                        if (inputs.state) {
                            if (!inputs.end) {
                                settings.offsetX = 0;
                                settings.offsetY = 0;
                                updatePreview();
                            }
                            inputs.state = null;
                        }
                    }
                }
            },
        });

        // ---------- rendering ---------------------
        const fullSizeCanvas = BB.canvas(width, height);
        const fullSizeCtx = BB.ctx(fullSizeCanvas);

        function sharpStrokeRect(
            context: CanvasRenderingContext2D,
            x: number,
            y: number,
            width: number,
            height: number,
        ): void {
            const drawX = Math.round(x + 0.5) - 0.5;
            const drawY = Math.round(y + 0.5) - 0.5;
            const drawWidth = Math.round(x + width - drawX);
            const drawHeight = Math.round(y + height - drawY);
            context.strokeRect(drawX, drawY, drawWidth, drawHeight);
        }

        function updatePreview(doForce?: boolean) {
            if (
                !doForce &&
                lastDrawnSettings &&
                JSON.stringify(lastDrawnSettings) === JSON.stringify(settings)
            ) {
                return;
            }

            if (previewMode === 0) {
                // before
                fullSizeCtx.clearRect(0, 0, width, height);
                fullSizeCtx.drawImage(context.canvas, 0, 0);

                const previewCanvas = previewLayer.image as HTMLCanvasElement;
                const previewCtx = BB.ctx(previewCanvas);
                previewCtx.save();
                previewCtx.clearRect(0, 0, renderW, renderH);
                previewCtx.drawImage(fullSizeCanvas, 0, 0, renderW, renderH);
                previewCtx.restore();

                const pW = settings.width * previewFactor;
                const pH = settings.height * previewFactor;

                const overlayCtx = BB.ctx(overlayCanvas);
                overlayCtx.save();
                overlayCtx.clearRect(0, 0, w, h);
                overlayCtx.strokeStyle = '#fff';
                sharpStrokeRect(
                    overlayCtx,
                    settings.x * previewFactor,
                    settings.y * previewFactor,
                    pW,
                    pH,
                );
                if (settings.blend > 0.05) {
                    overlayCtx.strokeStyle = '#f0f';
                    sharpStrokeRect(
                        overlayCtx,
                        settings.x * previewFactor - (pW / 2) * settings.blend,
                        settings.y * previewFactor - (pH / 2) * settings.blend,
                        pW * (1 + settings.blend),
                        pH * (1 + settings.blend),
                    );
                }
                overlayCtx.restore();
            } else {
                // after
                fullSizeCtx.clearRect(0, 0, width, height);
                fullSizeCtx.drawImage(context.canvas, 0, 0);
                drawPattern(fullSizeCtx, settings);

                const previewCanvas = previewLayer.image as HTMLCanvasElement;
                const previewCtx = BB.ctx(previewCanvas);
                previewCtx.clearRect(0, 0, renderW, renderH);
                previewCtx.drawImage(fullSizeCanvas, 0, 0, renderW, renderH);
            }

            klCanvasPreview.render();
            lastDrawnSettings = BB.copyObj(settings);
        }

        updatePreview();

        // ----- result -------------------
        const destroy = () => {
            blendSlider.destroy();
            keyListener.destroy();
            pointerListener.destroy();
            klCanvasPreview.destroy();
        };
        const result: TFilterGetDialogResult<TFilterPatternInput> = {
            element: rootEl,
            destroy,
            getInput: () => {
                destroy();
                return BB.copyObj(settings);
            },
        };
        if (!isSmall) {
            result.width = mediumPreview.width;
        }
        return result;
    },

    apply(params: IFilterApply<TFilterPatternInput>): boolean {
        const klCanvas = params.klCanvas;
        const ctx = params.context;
        const history = params.history;
        if (!klCanvas) {
            return false;
        }
        history?.pause(true);

        drawPattern(ctx, params.input);

        history?.pause(false);
        history?.push({
            tool: ['filter', 'pattern'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterPatternHistoryEntry);
        return true;
    },
};
