import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {CurvesInput, getDefaultCurvesInput, TCurvesInput} from './filter-curves/curves-input';
import {Options} from '../ui/components/options';
import {TFilterHistoryEntry} from './filters';

export type TFilterCurvesInput = {
    curves: TCurvesInput;
};

export type TFilterCurvesHistoryEntry = TFilterHistoryEntry<
    'curves',
    TFilterCurvesInput>;

export const filterCurves = {

    getDialog (params: IFilterGetDialogParam) {

        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        const w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        const tempCanvas = BB.canvas(w, h);
        {
            const ctx = BB.ctx(tempCanvas);
            ctx.save();
            if (tempCanvas.width > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }

        const div = BB.el();
        const result: IFilterGetDialogResult<TFilterCurvesInput> = {
            element: div,
        };
        let klCanvasPreview: KlCanvasPreview;

        function finishInit (): void {

            div.innerHTML = LANG('filter-curves-description') + '<br/><br/>';

            let curves: TCurvesInput = getDefaultCurvesInput();

            const fxCanvas = getSharedFx();
            if (fxCanvas === null) {
                return; // todo throw?
            }
            const texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size

            function update (): void {
                try {
                    fxCanvas!.draw(texture).curves(curves.r, curves.g, curves.b).update();
                    if (klCanvasPreview) {
                        klCanvasPreview.render();
                    }
                } catch(e) {
                    (div as any).errorCallback(e);
                }
            }

            const input = new CurvesInput({
                curves,
                callback: function (val) {
                    curves = val;
                    update();
                },
            });
            const modeButtons: Options<string> = input.getModeButtons();


            div.append(input.getElement());



            const previewWrapper = BB.el({
                className: 'kl-preview-wrapper',
                css: {
                    width: '340px',
                    height: '220px',
                },
            });

            const previewLayerArr: IKlBasicLayer[] = [];
            {
                for (let i = 0; i < layers.length; i++) {
                    previewLayerArr.push({
                        image: i === selectedLayerIndex ? fxCanvas : layers[i].context.canvas,
                        isVisible: layers[i].isVisible,
                        opacity: layers[i].opacity,
                        mixModeStr: layers[i].mixModeStr,
                    });
                }
            }
            klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + w),
                height: parseInt('' + h),
                layers: previewLayerArr,
            });

            const previewInnerWrapper = BB.el({
                className: 'kl-preview-wrapper__canvas',
                css: {
                    width: parseInt('' + w) + 'px',
                    height: parseInt('' + h) + 'px',
                },
            });
            previewInnerWrapper.append(klCanvasPreview.getElement());
            previewWrapper.append(previewInnerWrapper);


            div.append(previewWrapper);

            result.destroy = (): void => {
                input.destroy();
                texture.destroy();
                modeButtons.destroy();
                klCanvasPreview.destroy();
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

    apply (params: IFilterApply<TFilterCurvesInput>): boolean {
        const context = params.context;
        const curves = params.input.curves;
        const history = params.history;
        if (!context || !history) {
            return false;
        }
        history.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).curves(curves.r, curves.g, curves.b).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'curves'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterCurvesHistoryEntry);

        return true;
    },


};