import {BB} from '../../bb/bb';
import {KlSlider} from '../ui/components/kl-slider';
import {eventResMs} from './filters-consts';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {TFilterHistoryEntry} from './filters';

export type TFilterBrightnessContrastInput = {
    brightness: number;
    contrast: number;
}

export type TFilterBrightnessContrastHistoryEntry = TFilterHistoryEntry<
    'brightnessContrast',
    TFilterBrightnessContrastInput>;

export const filterBrightnessContrast = {
    getDialog (params: IFilterGetDialogParam) {

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterBrightnessContrastInput> = {
            element: div,
        };


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


        function finishInit (): void {

            let brightness = 0, contrast = 0;
            div.innerHTML = LANG('filter-bright-contrast-description') + '<br/><br/>';

            const fxCanvas = getSharedFx();
            if (!fxCanvas) {
                return; // todo throw?
            }
            const texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size

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
                    fxCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
                    klCanvasPreview.render();
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
                    fxCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
                    klCanvasPreview.render();
                },
            });
            brightnessSlider.getElement().style.marginBottom = '10px';
            div.append(brightnessSlider.getElement(), contrastSlider.getElement());



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
                fxCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
                klCanvasPreview.render();
            } catch(e) {
                (div as any).errorCallback(e);
            }

            result.destroy = () => {
                brightnessSlider.destroy();
                contrastSlider.destroy();
                texture.destroy();
                klCanvasPreview.destroy();
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

    apply (params: IFilterApply<TFilterBrightnessContrastInput>): boolean {
        const context = params.context;
        const brightness = params.input.brightness;
        const contrast = params.input.contrast;
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
        fxCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'brightnessContrast'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterBrightnessContrastHistoryEntry);

        return true;
    },
};