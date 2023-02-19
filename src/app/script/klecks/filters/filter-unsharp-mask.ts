import {BB} from '../../bb/bb';
import {eventResMs} from './filters-consts';
import {KlSlider} from '../ui/components/kl-slider';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {TFilterHistoryEntry} from './filters';

export type TFilterUnsharpMaskInput = {
    radius: number;
    strength: number;
};

export type TFilterUnsharpMaskHistoryEntry = TFilterHistoryEntry<
    'unsharpMask',
    TFilterUnsharpMaskInput>;

export const filterUnsharpMask = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
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
        const result: IFilterGetDialogResult<TFilterUnsharpMaskInput> = {
            element: div,
        };

        function finishInit () {
            let radius = 2, strength = 5.1 / 10;
            div.innerHTML = LANG('filter-unsharp-mask-description') + '<br/><br/>';

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
                min: 0,
                max: 200,
                value: 2,
                eventResMs: eventResMs,
                onChange: function (val) {
                    radius = val;
                    fxCanvas.draw(texture).unsharpMask(radius * previewFactor, strength).update();
                    klCanvasPreview.render();
                },
                curve: [[0, 0], [0.1, 2], [0.5, 50], [1, 200]],
            });
            const strengthSlider = new KlSlider({
                label: LANG('filter-unsharp-mask-strength'),
                width: 300,
                height: 30,
                min: 0,
                max: 50,
                value: 5.1,
                eventResMs: eventResMs,
                onChange: function (val) {
                    strength = val / 10;
                    fxCanvas.draw(texture).unsharpMask(radius * previewFactor, strength).update();
                    klCanvasPreview.render();
                },
                curve: [[0, 0], [0.1, 2], [0.5, 10], [1, 50]],
            });
            radiusSlider.getElement().style.marginBottom = '10px';
            div.append(radiusSlider.getElement());
            div.append(strengthSlider.getElement());


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
                fxCanvas.draw(texture).unsharpMask(radius * previewFactor, strength).update();
                klCanvasPreview.render();
            } catch (e) {
                (div as any).errorCallback(e);
            }

            result.destroy = (): void => {
                radiusSlider.destroy();
                strengthSlider.destroy();
                texture.destroy();
                klCanvasPreview.destroy();
            };
            result.getInput = function (): TFilterUnsharpMaskInput {
                result.destroy();
                return {
                    radius: radius,
                    strength: strength,
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },


    apply (params: IFilterApply<TFilterUnsharpMaskInput>): boolean {
        const context = params.context;
        const history = params.history;
        const radius = params.input.radius;
        const strength = params.input.strength;
        if (!context || radius === null || strength === null || !history) {
            return false;
        }
        history.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).unsharpMask(radius, strength).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'unsharpMask'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterUnsharpMaskHistoryEntry);
        return true;
    },

};