import { KlSlider } from '../ui/components/kl-slider';
import { eventResMs } from './filters-consts';
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

export type TFilterBrightnessContrastInput = {
    brightness: number;
    contrast: number;
};

export type TFilterBrightnessContrastHistoryEntry = TFilterHistoryEntry<
    'brightnessContrast',
    TFilterBrightnessContrastInput
>;

export const filterBrightnessContrast = {
    getDialog(params: IFilterGetDialogParam) {
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
        });

        function finishInit(): void {
            const brightnessSlider = new KlSlider({
                label: LANG('filter-bright-contrast-brightness'),
                width: 300,
                height: 30,
                min: 0,
                max: 100,
                value: (brightness + 1) * 50,
                eventResMs: eventResMs,
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
                eventResMs: eventResMs,
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
            });
            preview.render();
            preview.getElement().classList.add(
                css({
                    marginLeft: '-20px',
                    marginRight: '-20px',
                }),
            );
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
        }

        setTimeout(finishInit, 1); // the canvas isn't ready for some reason

        return result;
    },

    apply(params: IFilterApply<TFilterBrightnessContrastInput>): boolean {
        const context = params.context;
        const brightness = params.input.brightness;
        const contrast = params.input.contrast;
        const history = params.history;
        if (!context) {
            return false;
        }
        history?.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history?.pause(false);
        history?.push({
            tool: ['filter', 'brightnessContrast'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterBrightnessContrastHistoryEntry);

        return true;
    },
};
