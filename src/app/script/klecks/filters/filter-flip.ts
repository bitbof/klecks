import { BB } from '../../bb/bb';
import { Checkbox } from '../ui/components/checkbox';
import { KlCanvasPreview } from '../ui/project-viewport/kl-canvas-preview';
import {
    IFilterApply,
    IFilterGetDialogParam,
    TFilterGetDialogResult,
    IKlBasicLayer,
    TMixMode,
} from '../kl-types';
import { LANG } from '../../language/language';
import { throwIfNull } from '../../bb/base/base';
import { TFilterHistoryEntry } from './filters';
import { Options } from '../ui/components/options';
import { smallPreview } from '../ui/utils/preview-size';

export type TFilterFlipInput = {
    horizontal: boolean;
    vertical: boolean;
    flipCanvas: boolean;
};

export type TFilterFlipHistoryEntry = TFilterHistoryEntry<'flip', TFilterFlipInput>;

export const filterFlip = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
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
                marginBottom: '10px',
            },
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
                marginBottom: '10px',
            },
        });
        rootEl.append(horizontalCheckbox.getElement());
        rootEl.append(verticalCheckbox.getElement());

        const targetOptions = new Options<boolean>({
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
                width: smallPreview.width + 'px',
                height: smallPreview.height + 'px',
            },
        });

        const previewLayer: IKlBasicLayer = {
            image: BB.canvas(Math.round(w), Math.round(h)),
            isVisible: true,
            opacity: 1,
            mixModeStr: 'source-over' as TMixMode,
        };
        const klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: [previewLayer],
        });

        const previewInnerWrapper = BB.el({
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: parseInt('' + w) + 'px',
                height: parseInt('' + h) + 'px',
            },
        });
        previewInnerWrapper.append(klCanvasPreview.getElement());
        previewWrapper.append(previewInnerWrapper);

        function updatePreview(): void {
            const ctx = BB.ctx(previewLayer.image as HTMLCanvasElement);
            ctx.save();
            ctx.clearRect(0, 0, previewLayer.image.width, previewLayer.image.height);

            if (doFlipCanvas) {
                if (isHorizontal) {
                    ctx.translate(previewLayer.image.width, 0);
                    ctx.scale(-1, 1);
                }
                if (isVertical) {
                    ctx.translate(0, previewLayer.image.height);
                    ctx.scale(1, -1);
                }
            }

            for (let i = 0; i < layers.length; i++) {
                if (!layers[i].isVisible) {
                    continue;
                }

                ctx.save();
                if (!doFlipCanvas && selectedLayerIndex === i) {
                    if (isHorizontal) {
                        ctx.translate(previewLayer.image.width, 0);
                        ctx.scale(-1, 1);
                    }
                    if (isVertical) {
                        ctx.translate(0, previewLayer.image.height);
                        ctx.scale(1, -1);
                    }
                }
                if (ctx.canvas.width > layers[i].context.canvas.width) {
                    ctx.imageSmoothingEnabled = false;
                }
                ctx.globalAlpha = layers[i].opacity;
                ctx.globalCompositeOperation = layers[i].mixModeStr;
                ctx.drawImage(
                    layers[i].context.canvas,
                    0,
                    0,
                    previewLayer.image.width,
                    previewLayer.image.height,
                );
                ctx.restore();
            }
            klCanvasPreview.render();
            ctx.restore();
        }
        setTimeout(updatePreview, 0);

        rootEl.append(previewWrapper);
        result.destroy = (): void => {
            horizontalCheckbox.destroy();
            verticalCheckbox.destroy();
            targetOptions.destroy();
            klCanvasPreview.destroy();
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

    apply(params: IFilterApply<TFilterFlipInput>): boolean {
        const context = params.context;
        const klCanvas = params.klCanvas;
        const history = params.history;
        const horizontal = params.input.horizontal;
        const vertical = params.input.vertical;
        const flipCanvas = params.input.flipCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        history?.pause(true);
        klCanvas.flip(
            horizontal,
            vertical,
            flipCanvas ? undefined : throwIfNull(klCanvas.getLayerIndex(context.canvas)),
        );
        history?.pause(false);

        history?.push({
            tool: ['filter', 'flip'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterFlipHistoryEntry);
        return true;
    },
};
