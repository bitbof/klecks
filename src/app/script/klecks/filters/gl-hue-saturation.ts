import {BB} from '../../bb/bb';
import {eventResMs} from './filters-consts';
import {KlSlider} from '../ui/base-components/kl-slider';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from './shared-gl-fx';
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer} from '../kl.types';
import {LANG} from '../../language/language';

export const glHueSaturation = {

    getDialog(params: IFilterGetDialogParam) {

        let context = params.context;
        let canvas = params.canvas;
        if (!context || !canvas) {
            return false;
        }

        let layers = canvas.getLayers();
        let selectedLayerIndex = canvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height,280, 200,  1);
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

        let div = document.createElement("div");
        let result: any = {
            element: div
        };

        function finishInit() {
            let hue = 0, Saturation = 0;
            div.innerHTML = LANG('filter-hue-sat-description') + "<br/><br/>";

            let glCanvas = getSharedFx();
            if (!glCanvas) {
                return; // todo throw?
            }
            let texture = glCanvas.texture(tempCanvas);
            glCanvas.draw(texture).update(); // update glCanvas size

            let hueSlider = new KlSlider({
                label: LANG('filter-hue-sat-hue'),
                width: 300,
                height: 30,
                min: -100,
                max: 100,
                initValue: hue * 100,
                eventResMs: eventResMs,
                onChange: function (val) {
                    hue = val / 100;
                    glCanvas.draw(texture).hueSaturation(hue, Saturation).update();
                    klCanvasPreview.render();
                }
            });
            let saturationSlider = new KlSlider({
                label: LANG('filter-hue-sat-saturation'),
                width: 300,
                height: 30,
                min: 0,
                max: 100,
                initValue: (Saturation + 1) * 50,
                eventResMs: eventResMs,
                onChange: function (val) {
                    Saturation = val / 50 - 1;
                    glCanvas.draw(texture).hueSaturation(hue, Saturation).update();
                    klCanvasPreview.render();
                }
            });
            hueSlider.getElement().style.marginBottom = "10px";
            div.appendChild(hueSlider.getElement());
            div.appendChild(saturationSlider.getElement());


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
                glCanvas.draw(texture).hueSaturation(hue, Saturation).update();
                klCanvasPreview.render();
            } catch(e) {
                (div as any).errorCallback(e);
            }

            result.destroy = () => {
                hueSlider.destroy();
                saturationSlider.destroy();
                texture.destroy();
            };
            result.getInput = function () {
                result.destroy();
                return {
                    hue: hue,
                    Saturation: Saturation
                };
            };
        }

        setTimeout(finishInit, 1);
        return result;
    },

    apply(params: IFilterApply) {
        let context = params.context;
        let hue = params.input.hue;
        let history = params.history;
        let Saturation = params.input.Saturation;
        if (!context || hue === null || Saturation === null || !history)
            return false;
        history.pause(true);
        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false; // todo more specific error?
        }
        let texture = glCanvas.texture(context.canvas);
        glCanvas.draw(texture).hueSaturation(hue, Saturation).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(glCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ["filter", "glHueSaturation"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};