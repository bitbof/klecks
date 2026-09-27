import { BB } from '../../bb/bb';
import { Checkbox } from '../ui/components/checkbox';
import { KlCanvasPreview } from '../ui/project-viewport/kl-canvas-preview';
import {
    TFilterApply,
    TFilterGetDialogParam,
    TFilterGetDialogResult,
    TKlBasicLayer,
    TMixMode,
} from '../kl-types';
import { LANG } from '../../language/language';
import { Options } from '../ui/components/options';
import { SMALL_PREVIEW } from '../ui/utils/preview-size';

export type TFilterFlipInput = {
    horizontal: boolean;
    vertical: boolean;
    flipCanvas: boolean;
};

export const filterFlip = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        const selectedLayerIndex = params.selectedLayerIndex;
        const layer = klCanvas.getLayer(selectedLayerIndex);
        const layers = klCanvas.getLayers();

        const fit = BB.fitInto(layer.canvas.width, layer.canvas.height, 280, 200, 1);
        const w = parseInt('' + fit.width),
            h = parseInt('' + fit.height);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterFlipInput> = {
            element: rootEl,
        };
        let isHorizontal = true;
        let isVertical = false;
        let doFlipCanvas = true;

        const horizontalCheckbox = new Checkbox({
            init: isHorizontal,
            label: LANG('filter-flip-horizontal') + ' ⟷',
            allowTab: true,
            callback: function (v) {
                isHorizontal = v;
                updatePreview();
            },
            css: {
                marginBottom: 10,
            },
            name: 'flip-horizontal',
        });
        const verticalCheckbox = new Checkbox({
            init: isVertical,
            label: LANG('filter-flip-vertical') + ' ↕',
            allowTab: true,
            callback: function (v) {
                isVertical = v;
                updatePreview();
            },
            css: {
                marginBottom: 10,
            },
            name: 'flip-vertical',
        });
        rootEl.append(horizontalCheckbox.getElement());
        rootEl.append(verticalCheckbox.getElement());

        const targetOptions = new Options<boolean>({
            isFocusable: true,
            optionArr: [
                {
                    id: true,
                    label: LANG('filter-flip-image'),
                },
                {
                    id: false,
                    label: LANG('filter-flip-layer'),
                },
            ],
            onChange: (val) => {
                doFlipCanvas = val;
                updatePreview();
            },
        });

        rootEl.append(targetOptions.getElement());

        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: SMALL_PREVIEW.width,
                height: SMALL_PREVIEW.height,
            },
        });

        const previewLayers: TKlBasicLayer[] = layers.map((item) => ({
            image: item.canvas,
            isVisible: item.isVisible,
            opacity: item.opacity,
            mixModeStr: item.mixModeStr,
            hasClipping: item.hasClipping,
        }));
        const composedCanvas = klCanvas.getCanvas();
        const flippedCanvas = BB.canvas(composedCanvas.width, composedCanvas.height);

        function drawFlipped(
            source: TKlBasicLayer['image'],
            horizontal: boolean,
            vertical: boolean,
        ): HTMLCanvasElement {
            const ctx = BB.ctx(flippedCanvas);
            ctx.save();
            ctx.globalCompositeOperation = 'copy';
            if (horizontal) {
                ctx.translate(flippedCanvas.width, 0);
                ctx.scale(-1, 1);
            }
            if (vertical) {
                ctx.translate(0, flippedCanvas.height);
                ctx.scale(1, -1);
            }
            ctx.drawImage(source, 0, 0);
            ctx.restore();
            return flippedCanvas;
        }

        function buildLayers(): TKlBasicLayer[] {
            if (doFlipCanvas) {
                return [
                    {
                        image: drawFlipped(composedCanvas, isHorizontal, isVertical),
                        isVisible: true,
                        opacity: 1,
                        mixModeStr: 'source-over' as TMixMode,
                        hasClipping: false,
                    },
                ];
            }
            return previewLayers.map((item, i) =>
                i === selectedLayerIndex
                    ? {
                          ...item,
                          image: drawFlipped(item.image, isHorizontal, isVertical),
                      }
                    : item,
            );
        }

        const klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: buildLayers(),
        });

        function updatePreview(): void {
            klCanvasPreview.setLayers(buildLayers());
        }

        const previewInnerWrapper = BB.el({
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: parseInt('' + w),
                height: parseInt('' + h),
            },
        });
        previewInnerWrapper.append(klCanvasPreview.getElement());
        previewWrapper.append(previewInnerWrapper);

        rootEl.append(previewWrapper);
        result.destroy = (): void => {
            horizontalCheckbox.destroy();
            verticalCheckbox.destroy();
            targetOptions.destroy();
            klCanvasPreview.destroy();
            BB.freeCanvas(composedCanvas);
            BB.freeCanvas(flippedCanvas);
        };
        result.getInput = function (): TFilterFlipInput {
            result.destroy!();
            return {
                horizontal: isHorizontal,
                vertical: isVertical,
                flipCanvas: doFlipCanvas,
            };
        };
        return result;
    },

    apply(params: TFilterApply<TFilterFlipInput>): boolean {
        const context = params.layer.context;
        const klCanvas = params.klCanvas;
        const horizontal = params.input.horizontal;
        const vertical = params.input.vertical;
        const flipCanvas = params.input.flipCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        klCanvas.flip(horizontal, vertical, flipCanvas ? undefined : params.layer.index);
        return true;
    },
};
