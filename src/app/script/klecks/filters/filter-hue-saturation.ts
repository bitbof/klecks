import {BB} from '../../bb/bb';
import {eventResMs} from './filters-consts';
import {KlSlider} from '../ui/components/kl-slider';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {TFilterHistoryEntry} from './filters';

export type TFilterHueSaturationInput = {
    hue: number;
    saturation: number;
};

export type TFilterHueSaturationHistoryEntry = TFilterHistoryEntry<
    'hueSaturation',
    TFilterHueSaturationInput>;

export const filterHueSaturation = {

    getDialog (params: IFilterGetDialogParam) {

        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height,280, 200,  1);
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

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterHueSaturationInput> = {
            element: div,
        };

        function finishInit (): void {
            let hue = 0, saturation = 0;
            div.innerHTML = LANG('filter-hue-sat-description') + '<br/><br/>';

            const fxCanvas = getSharedFx();
            if (!fxCanvas) {
                return; // todo throw?
            }
            const texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size

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
                    fxCanvas.draw(texture).hueSaturation(hue, saturation).update();
                    klCanvasPreview.render();
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
                    fxCanvas.draw(texture).hueSaturation(hue, saturation).update();
                    klCanvasPreview.render();
                },
            });
            hueSlider.getElement().style.marginBottom = '10px';
            div.append(hueSlider.getElement(), saturationSlider.getElement());


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

            try {
                fxCanvas.draw(texture).hueSaturation(hue, saturation).update();
                klCanvasPreview.render();
            } catch(e) {
                (div as any).errorCallback(e);
            }

            result.destroy = (): void => {
                hueSlider.destroy();
                saturationSlider.destroy();
                texture.destroy();
                klCanvasPreview.destroy();
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

    apply (params: IFilterApply<TFilterHueSaturationInput>): boolean {
        const context = params.context;
        const hue = params.input.hue;
        const history = params.history;
        const saturation = params.input.saturation;
        if (!context || hue === null || saturation === null || !history) {
            return false;
        }
        history.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).hueSaturation(hue, saturation).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'hueSaturation'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterHueSaturationHistoryEntry);
        return true;
    },

};