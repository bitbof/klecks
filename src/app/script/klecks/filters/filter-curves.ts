import { BB } from '../../bb/bb';
import { getSharedFx } from '../../fx-canvas/shared-fx';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { CurvesInput, getDefaultCurvesInput, TCurvesInput } from './filter-curves/curves-input';
import { Options } from '../ui/components/options';
import { TFilterHistoryEntry } from './filters';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { Preview } from '../ui/project-viewport/preview';
import { css } from '@emotion/css/dist/emotion-css.cjs';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';

export type TFilterCurvesInput = {
    curves: TCurvesInput;
};

export type TFilterCurvesHistoryEntry = TFilterHistoryEntry<'curves', TFilterCurvesInput>;

export const filterCurves = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

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
            original: context.canvas,
            onUpdate: (fxCanvas) => {
                return fxCanvas.curves(curves.r, curves.g, curves.b);
            },
        });

        function finishInit(): void {
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
            preview.getElement().classList.add(
                css({
                    marginLeft: '-20px',
                    marginRight: '-20px',
                }),
            );

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
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply(params: IFilterApply<TFilterCurvesInput>): boolean {
        const context = params.context;
        const curves = params.input.curves;
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
        fxCanvas.draw(texture).curves(curves.r, curves.g, curves.b).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history?.pause(false);
        history?.push({
            tool: ['filter', 'curves'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterCurvesHistoryEntry);

        return true;
    },
};
