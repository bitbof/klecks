import { Options } from '../ui/components/options';
import { ColorOptions } from '../ui/components/color-options';
import { getSharedFx } from '../../fx-canvas/shared-fx';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult, IRGBA } from '../kl-types';
import { LANG } from '../../language/language';
import { TFilterHistoryEntry } from './filters';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { Preview } from '../ui/project-viewport/preview';
import { css } from '@emotion/css/dist/emotion-css.cjs';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { BB } from '../../bb/bb';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';

export type TFilterToAlphaInput = {
    sourceId: string;
    selectedRgbaObj: IRGBA | null;
};

export type TFilterToAlphaHistoryEntry = TFilterHistoryEntry<'toAlpha', TFilterToAlphaInput>;

export const filterToAlpha = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterToAlphaInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        function finishInit() {
            const fxPreviewRenderer = new FxPreviewRenderer({
                original: context.canvas,
                onUpdate: (fxCanvas) => {
                    return fxCanvas.toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj);
                },
            });

            // source
            let sourceId = 'inverted-luminance';
            const sourceOptions = new Options({
                optionArr: [
                    {
                        id: 'inverted-luminance',
                        label: LANG('filter-to-alpha-inverted-lum'),
                    },
                    {
                        id: 'luminance',
                        label: LANG('filter-to-alpha-lum'),
                    },
                ],
                initId: sourceId,
                onChange: function (id) {
                    sourceId = id;
                    preview.render();
                },
            });
            rootEl.append(sourceOptions.getElement());

            // color
            let selectedRgbaObj: IRGBA | null = { r: 0, g: 0, b: 0, a: 1 };
            const colorOptionsArr = [
                null,
                { r: 0, g: 0, b: 0, a: 1 },
                { r: 255, g: 255, b: 255, a: 1 },
                {
                    r: params.currentColorRgb.r,
                    g: params.currentColorRgb.g,
                    b: params.currentColorRgb.b,
                    a: 1,
                },
                {
                    r: params.secondaryColorRgb.r,
                    g: params.secondaryColorRgb.g,
                    b: params.secondaryColorRgb.b,
                    a: 1,
                },
            ];

            const colorOptions = new ColorOptions({
                label: LANG('filter-to-alpha-replace'),
                colorArr: colorOptionsArr,
                initialIndex: 1,
                onChange: function (rgbaObj) {
                    selectedRgbaObj = rgbaObj;
                    preview.render();
                },
            });
            colorOptions.getElement().style.marginTop = '10px';
            colorOptions.getElement().style.marginBottom = '10px';
            rootEl.append(colorOptions.getElement());

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
                sourceOptions.destroy();
                colorOptions.destroy();
                fxPreviewRenderer.destroy();
                preview.destroy();
            };
            result.getInput = function (): TFilterToAlphaInput {
                result.destroy!();
                return {
                    sourceId: sourceId,
                    selectedRgbaObj: selectedRgbaObj,
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply(params: IFilterApply<TFilterToAlphaInput>): boolean {
        const context = params.context;
        const history = params.history;
        const sourceId = params.input.sourceId;
        const selectedRgbaObj = params.input.selectedRgbaObj;
        if (!context || !sourceId) {
            return false;
        }
        history?.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas
            .draw(texture)
            .toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj)
            .update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history?.pause(false);
        history?.push({
            tool: ['filter', 'toAlpha'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterToAlphaHistoryEntry);
        return true;
    },
};
