import { BB } from '../../bb/bb';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { CurvesInput, getDefaultCurvesInput, TCurvesInput } from './filter-curves/curves-input';
import { Options } from '../ui/components/options';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { Preview } from '../ui/project-viewport/preview';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { applyFxFilter } from './apply-fx-filter';
import { css } from '../../bb/base/base';

export type TFilterCurvesInput = {
    curves: TCurvesInput;
};

export const filterCurves = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        const selectedLayerIndex = params.selectedLayerIndex;
        const layer = klCanvas.getLayer(selectedLayerIndex);
        const layers = klCanvas.getLayers();

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterCurvesInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        let curves: TCurvesInput = getDefaultCurvesInput();
        const fxPreviewRenderer = new FxPreviewRenderer({
            original: layer.canvas,
            onUpdate: (fxCanvas) => {
                return fxCanvas.curves(curves.r, curves.g, curves.b);
            },
            selection: klCanvas.getSelection(),
        });

        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image:
                        i === selectedLayerIndex
                            ? fxPreviewRenderer.render
                            : layers[i].canvas,
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                    hasClipping: layers[i].hasClipping,
                });
            }
        }

        const preview = new Preview({
            width: getPreviewWidth(isSmall),
            height: getPreviewHeight(isSmall),
            project: {
                width: layer.canvas.width,
                height: layer.canvas.height,
                layers: previewLayerArr,
            },
            selection: klCanvas.getSelection(),
        });
        css(preview.getElement(), {
            marginLeft: -20,
            marginRight: -20,
        });

        const input = new CurvesInput({
            curves,
            callback: function (val) {
                curves = val;
                preview.render();
            },
        });
        const modeButtons: Options<string> = input.getModeButtons();

        rootEl.append(input.getElement(), preview.getElement());

        result.destroy = (): void => {
            input.destroy();
            modeButtons.destroy();
            fxPreviewRenderer.destroy();
            preview.destroy();
        };
        result.getInput = function (): TFilterCurvesInput {
            result.destroy!();
            return {
                curves: curves,
            };
        };

        return result;
    },

    apply(params: TFilterApply<TFilterCurvesInput>): boolean {
        const context = params.layer.context;
        const curves = params.input.curves;
        const klHistory = params.klHistory;
        if (!context) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas.curves(curves.r, curves.g, curves.b);
            },
            klHistory,
        );
    },
};
