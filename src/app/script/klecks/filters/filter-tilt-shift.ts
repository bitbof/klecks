import { BB } from '../../bb/bb';
import { eventResMs } from './filters-consts';
import { KlSlider } from '../ui/components/kl-slider';
import { getSharedFx } from '../../fx-canvas/shared-fx';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { IVector2D } from '../../bb/bb-types';
import { TFilterHistoryEntry } from './filters';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { Preview } from '../ui/project-viewport/preview';
import { createMatrixFromTransform } from '../../bb/transform/create-matrix-from-transform';
import { applyToPoint } from 'transformation-matrix';
import { DraggableInput } from '../ui/components/draggable-input';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';

export type TFilterTiltShiftInput = {
    a: IVector2D;
    b: IVector2D;
    blur: number;
    gradient: number;
};

export type TFilterTiltShiftHistoryEntry = TFilterHistoryEntry<'tiltShift', TFilterTiltShiftInput>;

export const filterTiltShift = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterTiltShiftInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        let blur = 20,
            gradient = 200;
        let fxPreviewRenderer: FxPreviewRenderer = {
            destroy: () => {},
        } as FxPreviewRenderer;

        function finishInit() {
            fxPreviewRenderer = new FxPreviewRenderer({
                original: context.canvas,
                onUpdate: (fxCanvas, transform) => {
                    fa.setTransform(preview.getTransform());
                    fb.setTransform(preview.getTransform());

                    const m = createMatrixFromTransform(transform);
                    const a = applyToPoint(m, fa.getValue());
                    const b = applyToPoint(m, fb.getValue());
                    return fxCanvas
                        .multiplyAlpha()
                        .tiltShift(
                            a.x,
                            a.y,
                            b.x,
                            b.y,
                            blur * transform.scaleX,
                            gradient * transform.scaleX,
                        )
                        .unmultiplyAlpha();
                },
            });

            function update() {
                preview.render();
            }

            // focus line control points
            const fa = new DraggableInput({
                value: {
                    x: context.canvas.width / 4,
                    y: context.canvas.height / 2,
                },
                onChange: () => {
                    update();
                },
            });
            const fb = new DraggableInput({
                value: {
                    x: (3 * context.canvas.width) / 4,
                    y: context.canvas.height / 2,
                },
                onChange: () => {
                    update();
                },
            });

            const gradientSlider = new KlSlider({
                label: LANG('filter-tilt-shift-gradient'),
                width: 300,
                height: 30,
                min: 0,
                max: 1000,
                value: gradient,
                eventResMs: eventResMs,
                onChange: function (val) {
                    gradient = val;
                    update();
                },
            });
            gradientSlider.getElement().style.marginBottom = '10px';
            rootEl.append(gradientSlider.getElement());
            const blurSlider = new KlSlider({
                label: LANG('filter-tilt-shift-blur'),
                width: 300,
                height: 30,
                min: 0,
                max: 200,
                value: blur,
                eventResMs: eventResMs,
                onChange: function (val) {
                    blur = val;
                    update();
                },
            });
            blurSlider.getElement().style.marginBottom = '10px';
            rootEl.append(blurSlider.getElement());

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
            BB.css(preview.getElement(), {
                overflow: 'hidden',
                marginLeft: '-20px',
                marginRight: '-20px',
            });

            preview.getElement().append(fa.getElement(), fb.getElement());
            rootEl.append(preview.getElement());

            result.destroy = (): void => {
                blurSlider.destroy();
                gradientSlider.destroy();
                fa.destroy();
                fb.destroy();
                fxPreviewRenderer.destroy();
                preview.destroy();
            };
            result.getInput = function (): TFilterTiltShiftInput {
                result.destroy!();
                return {
                    a: fa.getValue(),
                    b: fb.getValue(),
                    blur: blur,
                    gradient: gradient,
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply(params: IFilterApply<TFilterTiltShiftInput>): boolean {
        const context = params.context;
        const history = params.history;
        const a = params.input.a;
        const b = params.input.b;
        const blur = params.input.blur;
        const gradient = params.input.gradient;
        if (!context) {
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
            .multiplyAlpha()
            .tiltShift(a.x, a.y, b.x, b.y, blur, gradient)
            .unmultiplyAlpha()
            .update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history?.pause(false);
        history?.push({
            tool: ['filter', 'tiltShift'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterTiltShiftHistoryEntry);
        return true;
    },
};
