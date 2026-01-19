import { Options } from '../ui/components/options';
import { ColorOptions } from '../ui/components/color-options';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult, TRgba } from '../kl-types';
import { LANG } from '../../language/language';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { BB } from '../../bb/bb';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { applyFxFilter } from './apply-fx-filter';
import { css } from '../../bb/base/base';

export type TFilterToAlphaInput = {
    sourceId: string;
    selectedRgbaObj: TRgba | null;
};

export const filterToAlpha = {
    getDialog(params: TFilterGetDialogParam) {
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

        const fxPreviewRenderer = new FxPreviewRenderer({
            original: context.canvas,
            onUpdate: (fxCanvas) => {
                return fxCanvas.toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj);
            },
            selection: klCanvas.getSelection(),
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
        let selectedRgbaObj: TRgba | null = { r: 0, g: 0, b: 0, a: 1 };
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
            css: {
                margin: '10px 0',
            },
        });
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
            selection: klCanvas.getSelection(),
        });
        preview.render();
        css(preview.getElement(), {
            marginLeft: '-20px',
            marginRight: '-20px',
        });
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

        return result;
    },

    apply(params: TFilterApply<TFilterToAlphaInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        const sourceId = params.input.sourceId;
        const selectedRgbaObj = params.input.selectedRgbaObj;
        if (!context || !sourceId) {
            return false;
        }
        return applyFxFilter(
            context,
            params.klCanvas.getSelection(),
            (fxCanvas) => {
                fxCanvas.toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj);
            },
            klHistory,
        );
    },
};
