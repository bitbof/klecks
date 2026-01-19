import { KlSlider } from '../ui/components/kl-slider';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { BB } from '../../bb/bb';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { applyFxFilter } from './apply-fx-filter';
import { css } from '../../bb/base/base';

export type TFilterUnsharpMaskInput = {
    radius: number;
    strength: number;
};

export const filterUnsharpMask = {
    getDialog(params: TFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterUnsharpMaskInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        let radius = 2,
            strength = 5.1 / 10;
        const fxPreviewRenderer = new FxPreviewRenderer({
            original: context.canvas,
            onUpdate: (fxCanvas, transform) => {
                return fxCanvas.unsharpMask(radius * transform.scaleX, strength);
            },
            selection: klCanvas.getSelection(),
        });

        function update() {
            preview.render();
        }

        const radiusSlider = new KlSlider({
            label: LANG('radius'),
            width: 300,
            height: 30,
            min: 0,
            max: 200,
            value: 2,
            //eventResMs: eventResMs,
            onChange: function (val) {
                radius = val;
                update();
            },
            curve: [
                [0, 0],
                [0.1, 2],
                [0.5, 50],
                [1, 200],
            ],
        });
        const strengthSlider = new KlSlider({
            label: LANG('filter-unsharp-mask-strength'),
            width: 300,
            height: 30,
            min: 0,
            max: 50,
            value: 5.1,
            //eventResMs: eventResMs,
            onChange: function (val) {
                strength = val / 10;
                update();
            },
            curve: [
                [0, 0],
                [0.1, 2],
                [0.5, 10],
                [1, 50],
            ],
        });
        radiusSlider.getElement().style.marginBottom = '10px';
        strengthSlider.getElement().style.marginBottom = '10px';
        rootEl.append(radiusSlider.getElement());
        rootEl.append(strengthSlider.getElement());

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
        update();
        css(preview.getElement(), {
            marginLeft: '-20px',
            marginRight: '-20px',
        });
        rootEl.append(preview.getElement());

        result.destroy = (): void => {
            radiusSlider.destroy();
            strengthSlider.destroy();
            fxPreviewRenderer.destroy();
            preview.destroy();
        };
        result.getInput = function (): TFilterUnsharpMaskInput {
            result.destroy!();
            return {
                radius: radius,
                strength: strength,
            };
        };

        return result;
    },

    apply(params: TFilterApply<TFilterUnsharpMaskInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        const radius = params.input.radius;
        const strength = params.input.strength;
        if (!context || radius === null || strength === null) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas.unsharpMask(radius, strength);
            },
            klHistory,
        );
    },
};
