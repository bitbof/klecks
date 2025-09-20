import { KlSlider } from '../ui/components/kl-slider';
import { EVENT_RES_MS } from './filters-consts';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { BB } from '../../bb/bb';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { applyFxFilter } from './apply-fx-filter';
import { css } from '../../bb/base/base';

export type TFilterBlurInput = {
    radius: number;
};

export const filterBlur = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        const context = params.context;
        if (!klCanvas || !context) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterBlurInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        let radius = 10;
        const fxPreviewRenderer = new FxPreviewRenderer({
            original: context.canvas,
            onUpdate: (fxCanvas, transform) => {
                return fxCanvas
                    .multiplyAlpha()
                    .triangleBlur(radius * transform.scaleX)
                    .unmultiplyAlpha();
            },
            selection: klCanvas.getSelection(),
        });

        const radiusSlider = new KlSlider({
            label: LANG('radius'),
            width: 300,
            height: 30,
            min: 1,
            max: 200,
            value: radius,
            eventResMs: EVENT_RES_MS,
            onChange: (val): void => {
                radius = val;
                preview.render();
            },
        });
        radiusSlider.getElement().style.marginBottom = '10px';
        rootEl.append(radiusSlider.getElement());

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
            radiusSlider.destroy();
            fxPreviewRenderer.destroy();
            preview.destroy();
        };
        result.getInput = function (): TFilterBlurInput {
            result.destroy!();
            return {
                radius: radius,
            };
        };

        return result;
    },

    apply(params: TFilterApply<TFilterBlurInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        const radius = params.input.radius;
        if (!context || !radius) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas.multiplyAlpha().triangleBlur(radius).unmultiplyAlpha();
            },
            klHistory,
        );
    },
};
