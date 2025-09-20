import { KlSlider } from '../ui/components/kl-slider';
import { EVENT_RES_MS } from './filters-consts';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { Preview } from '../ui/project-viewport/preview';
import { BB } from '../../bb/bb';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { applyFxFilter } from './apply-fx-filter';
import { css } from '../../bb/base/base';

export type TFilterBrightnessContrastInput = {
    brightness: number;
    contrast: number;
};

export const filterBrightnessContrast = {
    getDialog(params: TFilterGetDialogParam) {
        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterBrightnessContrastInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        let brightness = 0,
            contrast = 0;
        const fxPreviewRenderer = new FxPreviewRenderer({
            original: context.canvas,
            onUpdate: (fxCanvas) => {
                return fxCanvas.brightnessContrast(brightness, contrast);
            },
            selection: klCanvas.getSelection(),
        });

        const brightnessSlider = new KlSlider({
            label: LANG('filter-bright-contrast-brightness'),
            width: 300,
            height: 30,
            min: 0,
            max: 100,
            value: (brightness + 1) * 50,
            eventResMs: EVENT_RES_MS,
            onChange: function (val) {
                brightness = val / 50 - 1;
                preview.render();
            },
        });
        const contrastSlider = new KlSlider({
            label: LANG('filter-bright-contrast-contrast'),
            width: 300,
            height: 30,
            min: 0,
            max: 100,
            value: (contrast + 1) * 50,
            eventResMs: EVENT_RES_MS,
            onChange: function (val) {
                contrast = val / 50 - 1;
                preview.render();
            },
        });
        brightnessSlider.getElement().style.marginBottom = '10px';
        contrastSlider.getElement().style.marginBottom = '10px';
        rootEl.append(brightnessSlider.getElement(), contrastSlider.getElement());

        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image:
                        i === selectedLayerIndex
                            ? fxPreviewRenderer.render
                            : layers[i].context.canvas,
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                    hasClipping: false,
                });
            }
        }

        const preview = new Preview({
            width: getPreviewWidth(isSmall),
            height: getPreviewHeight(isSmall),
            project: {
                width: context.canvas.width,
                height: context.canvas.height,
                layers: previewLayerArr,
            },
            selection: klCanvas.getSelection(),
        });
        preview.render();
        css(preview.getElement(), {
            marginLeft: '-20px',
            marginRight: '-20px',
        });
        rootEl.append(preview.getElement());

        result.destroy = () => {
            brightnessSlider.destroy();
            contrastSlider.destroy();
            fxPreviewRenderer.destroy();
            preview.destroy();
        };
        result.getInput = function (): TFilterBrightnessContrastInput {
            result.destroy!();
            return {
                brightness: brightness,
                contrast: contrast,
            };
        };

        return result;
    },

    apply(params: TFilterApply<TFilterBrightnessContrastInput>): boolean {
        const context = params.layer.context;
        const brightness = params.input.brightness;
        const contrast = params.input.contrast;
        const klHistory = params.klHistory;
        if (!context) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas.brightnessContrast(brightness, contrast);
            },
            klHistory,
        );
    },
};
