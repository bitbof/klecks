import { eventResMs } from './filters-consts';
import { KlSlider } from '../ui/components/kl-slider';
import { getSharedFx } from '../../fx-canvas/shared-fx';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { TFilterHistoryEntry } from './filters';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { Preview } from '../ui/project-viewport/preview';
import { css } from '@emotion/css/dist/emotion-css.cjs';
import { BB } from '../../bb/bb';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';

export type TFilterHueSaturationInput = {
    hue: number;
    saturation: number;
};

export type TFilterHueSaturationHistoryEntry = TFilterHistoryEntry<
    'hueSaturation',
    TFilterHueSaturationInput
>;

export const filterHueSaturation = {
    getDialog(params: IFilterGetDialogParam) {
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
        });

        function finishInit(): void {
            const hueSlider = new KlSlider({
                label: LANG('filter-hue-sat-hue'),
                width: 300,
                height: 30,
                min: -100,
                max: 100,
                value: hue * 100,
                eventResMs: eventResMs,
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
                eventResMs: eventResMs,
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
            });
            preview.render();
            preview.getElement().classList.add(
                css({
                    marginLeft: '-20px',
                    marginRight: '-20px',
                }),
            );
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
        }

        setTimeout(finishInit, 1);
        return result;
    },

    apply(params: IFilterApply<TFilterHueSaturationInput>): boolean {
        const context = params.context;
        const hue = params.input.hue;
        const history = params.history;
        const saturation = params.input.saturation;
        if (!context || hue === null || saturation === null) {
            return false;
        }
        history?.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).hueSaturation(hue, saturation).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history?.pause(false);
        history?.push({
            tool: ['filter', 'hueSaturation'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterHueSaturationHistoryEntry);
        return true;
    },
};
