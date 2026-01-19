import { EVENT_RES_MS } from './filters-consts';
import { KlSlider } from '../ui/components/kl-slider';
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

export type TFilterHueSaturationInput = {
    hue: number;
    saturation: number;
};

export const filterHueSaturation = {
    getDialog(params: TFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterHueSaturationInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        let hue = 0,
            saturation = 0;
        const fxPreviewRenderer = new FxPreviewRenderer({
            original: context.canvas,
            onUpdate: (fxCanvas) => {
                return fxCanvas.hueSaturation(hue, saturation);
            },
            selection: klCanvas.getSelection(),
        });

        const hueSlider = new KlSlider({
            label: LANG('filter-hue-sat-hue'),
            width: 300,
            height: 30,
            min: -100,
            max: 100,
            value: hue * 100,
            eventResMs: EVENT_RES_MS,
            onChange: function (val) {
                hue = val / 100;
                preview.render();
            },
        });
        const saturationSlider = new KlSlider({
            label: LANG('filter-hue-sat-saturation'),
            width: 300,
            height: 30,
            min: 0,
            max: 100,
            value: (saturation + 1) * 50,
            eventResMs: EVENT_RES_MS,
            onChange: function (val) {
                saturation = val / 50 - 1;
                preview.render();
            },
        });
        hueSlider.getElement().style.marginBottom = '10px';
        saturationSlider.getElement().style.marginBottom = '10px';
        rootEl.append(hueSlider.getElement(), saturationSlider.getElement());

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

        result.destroy = (): void => {
            hueSlider.destroy();
            saturationSlider.destroy();
            fxPreviewRenderer.destroy();
            preview.destroy();
        };
        result.getInput = function (): TFilterHueSaturationInput {
            result.destroy!();
            return {
                hue: hue,
                saturation: saturation,
            };
        };

        return result;
    },

    apply(params: TFilterApply<TFilterHueSaturationInput>): boolean {
        const context = params.layer.context;
        const hue = params.input.hue;
        const klHistory = params.klHistory;
        const saturation = params.input.saturation;
        if (!context || hue === null || saturation === null) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas.hueSaturation(hue, saturation);
            },
            klHistory,
        );
    },
};
