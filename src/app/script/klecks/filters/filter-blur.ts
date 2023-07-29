import {BB} from '../../bb/bb';
import {KlSlider} from '../ui/components/kl-slider';
import {eventResMs} from './filters-consts';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {TFilterHistoryEntry} from './filters';

export type TFilterBlurInput = {
    radius: number;
}

export type TFilterBlurHistoryEntry = TFilterHistoryEntry<
    'blur',
    TFilterBlurInput>;


export const filterBlur = {

    getDialog (params: IFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        const context = params.context;
        if (!klCanvas || !context) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        const displayW = parseInt('' + fit.width), displayH = parseInt('' + fit.height);
        const w = Math.min(displayW, context.canvas.width);
        const h = Math.min(displayH, context.canvas.height);

        const tempCanvas = BB.canvas(w, h);
        {
            const ctx = BB.ctx(tempCanvas);
            ctx.save();
            if (w > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }
        const previewFactor = w / context.canvas.width;

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterBlurInput> = {
            element: div,
        };


        function finishInit (): void {
            let radius = 10;
            div.innerHTML = LANG('filter-triangle-blur-description') + '<br/><br/>';

            const fxCanvas = getSharedFx();
            if (!fxCanvas) {
                return; // todo throw?
            }
            const texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size

            const radiusSlider = new KlSlider({
                label: LANG('radius'),
                width: 300,
                height: 30,
                min: 1,
                max: 200,
                value: radius,
                eventResMs: eventResMs,
                onChange: (val): void => {
                    radius = val;
                    fxCanvas.draw(texture).triangleBlur(radius * previewFactor).update();
                    klCanvasPreview.render();
                },
            });
            div.append(radiusSlider.getElement());


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
            const klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + displayW),
                height: parseInt('' + displayH),
                layers: previewLayerArr,
            });

            const previewInnerWrapper = BB.el({
                className: 'kl-preview-wrapper__canvas',
                css: {
                    width: parseInt('' + displayW) + 'px',
                    height: parseInt('' + displayH) + 'px',
                },
            });
            previewInnerWrapper.append(klCanvasPreview.getElement());
            previewWrapper.append(previewInnerWrapper);

            div.append(previewWrapper);

            try {
                fxCanvas.draw(texture).triangleBlur(radius * previewFactor).update();
                klCanvasPreview.render();
            } catch(e) {
                (div as any).errorCallback(e);
            }

            result.destroy = (): void => {
                texture.destroy();
                radiusSlider.destroy();
                klCanvasPreview.destroy();
            };
            result.getInput = function (): TFilterBlurInput {
                result.destroy!();
                return {
                    radius: radius,
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply (params: IFilterApply<TFilterBlurInput>): boolean {
        const context = params.context;
        const history = params.history;
        const radius = params.input.radius;
        if (!context || !radius || !history) {
            return false;
        }
        history.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).triangleBlur(radius).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'blur'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterBlurHistoryEntry);
        return true;
    },

};