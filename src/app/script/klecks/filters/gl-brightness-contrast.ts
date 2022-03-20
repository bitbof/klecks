import {BB} from '../../bb/bb';
import {KlSlider} from '../ui/base-components/kl-slider';
import {eventResMs} from './filters-consts';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from './shared-gl-fx';
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer} from '../kl.types';
import {LANG} from '../../language/language';

export const glBrightnessContrast = {
    getDialog(params: IFilterGetDialogParam) {

        let div = document.createElement("div");
        let result: any = {
            element: div
        };


        let context = params.context; //2d context of canvas
        let canvas = params.canvas; //the klCanvas and dom element
        if (!context || !canvas) {
            return false;
        }

        let layers = canvas.getLayers();
        let selectedLayerIndex = canvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        let tempCanvas = BB.canvas(w, h);
        {
            const ctx = tempCanvas.getContext("2d");
            ctx.save();
            if (tempCanvas.width > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }


        function finishInit() {

            let brightness = 0, contrast = 0;
            div.innerHTML = LANG('filter-bright-contrast-description') + "<br/><br/>";

            let glCanvas = getSharedFx();
            if (!glCanvas) {
                return; // todo throw?
            }
            let texture = glCanvas.texture(tempCanvas);
            glCanvas.draw(texture).update(); // update glCanvas size

            let brightnessSlider = new KlSlider({
                label: LANG('filter-bright-contrast-brightness'),
                width: 300,
                height: 30,
                min: 0,
                max: 100,
                initValue: (brightness + 1) * 50,
                eventResMs: eventResMs,
                onChange: function (val) {
                    brightness = val / 50 - 1;
                    glCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
                    klCanvasPreview.render();
                }
            });
            let contrastSlider = new KlSlider({
                label: LANG('filter-bright-contrast-contrast'),
                width: 300,
                height: 30,
                min: 0,
                max: 100,
                initValue: (contrast + 1) * 50,
                eventResMs: eventResMs,
                onChange: function (val) {
                    contrast = val / 50 - 1;
                    glCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
                    klCanvasPreview.render();
                }
            });
            brightnessSlider.getElement().style.marginBottom = "10px";
            div.appendChild(brightnessSlider.getElement());
            div.appendChild(contrastSlider.getElement());



            let previewWrapper = document.createElement("div");
            BB.css(previewWrapper, {
                width: "340px",
                marginLeft: "-20px",
                height: "220px",
                backgroundColor: "#9e9e9e",
                marginTop: "10px",
                boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset",
                overflow: "hidden",
                position: "relative",
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                colorScheme: 'only light',
            });

            let previewLayerArr: IKlBasicLayer[] = [];
            {
                for (let i = 0; i < layers.length; i++) {
                    previewLayerArr.push({
                        image: i === selectedLayerIndex ? glCanvas : layers[i].context.canvas,
                        opacity: layers[i].opacity,
                        mixModeStr: layers[i].mixModeStr
                    });
                }
            }
            let klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + w),
                height: parseInt('' + h),
                layers: previewLayerArr
            });

            let previewInnerWrapper = BB.el({
                css: {
                    position: 'relative',
                    boxShadow: '0 0 5px rgba(0,0,0,0.5)',
                    width: parseInt('' + w) + 'px',
                    height: parseInt('' + h) + 'px'
                }
            });
            previewInnerWrapper.appendChild(klCanvasPreview.getElement());
            previewWrapper.appendChild(previewInnerWrapper);

            div.appendChild(previewWrapper);

            try {
                glCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
                klCanvasPreview.render();
            } catch(e) {
                (div as any).errorCallback(e);
            }

            result.destroy = () => {
                brightnessSlider.destroy();
                contrastSlider.destroy();
                texture.destroy();
            };
            result.getInput = function () {
                result.destroy();
                return {
                    brightness: brightness,
                    contrast: contrast
                };
            };
        }

        setTimeout(finishInit, 1); // the canvas isn't ready for some reason

        return result;
    },

    apply(params: IFilterApply) {
        let context = params.context;
        let brightness = params.input.brightness;
        let contrast = params.input.contrast;
        let history = params.history;
        if (!context || brightness === null || contrast === null || !history)
            return false;
        history.pause(true);
        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false; // todo more specific error?
        }
        let texture = glCanvas.texture(context.canvas);
        glCanvas.draw(texture).brightnessContrast(brightness, contrast).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(glCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ["filter", "glBrightnessContrast"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });

        return true;
    }
}