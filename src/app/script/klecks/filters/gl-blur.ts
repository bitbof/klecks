import {BB} from '../../bb/bb';
import {KlSlider} from '../ui/base-components/kl-slider';
import {eventResMs} from './filters-consts';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from './shared-gl-fx';
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer} from '../kl.types';
import {LANG} from '../../language/language';

export const glBlur = {

    getDialog(params: IFilterGetDialogParam) {
        let canvas = params.canvas;
        let context = params.context;
        if (!canvas || !context) {
            return false;
        }

        let layers = canvas.getLayers();
        let selectedLayerIndex = canvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        let displayW = parseInt('' + fit.width), displayH = parseInt('' + fit.height);
        let w = Math.min(displayW, context.canvas.width);
        let h = Math.min(displayH, context.canvas.height);

        let tempCanvas = BB.canvas(w, h);
        {
            const ctx = tempCanvas.getContext("2d");
            ctx.save();
            if (w > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }
        let previewFactor = w / context.canvas.width;

        let div = document.createElement("div");
        let result: any = {
            element: div
        };


        function finishInit() {
            let radius = 10;
            div.innerHTML = LANG('filter-triangle-blur-description') + "<br/><br/>";

            let glCanvas = getSharedFx();
            if (!glCanvas) {
                return; // todo throw?
            }
            let texture = glCanvas.texture(tempCanvas);
            glCanvas.draw(texture).update(); // update glCanvas size

            let radiusSlider = new KlSlider({
                label: LANG('radius'),
                width: 300,
                height: 30,
                min: 1,
                max: 200,
                initValue: radius,
                eventResMs: eventResMs,
                onChange: function (val) {
                    radius = val;
                    glCanvas.draw(texture).triangleBlur(radius * previewFactor).update();
                    klCanvasPreview.render();
                }
            });
            div.appendChild(radiusSlider.getElement());


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
                width: parseInt('' + displayW),
                height: parseInt('' + displayH),
                layers: previewLayerArr
            });

            let previewInnerWrapper = BB.el({
                css: {
                    position: 'relative',
                    boxShadow: '0 0 5px rgba(0,0,0,0.5)',
                    width: parseInt('' + displayW) + 'px',
                    height: parseInt('' + displayH) + 'px'
                }
            });
            previewInnerWrapper.appendChild(klCanvasPreview.getElement());
            previewWrapper.appendChild(previewInnerWrapper);

            div.appendChild(previewWrapper);

            try {
                glCanvas.draw(texture).triangleBlur(radius * previewFactor).update();
                klCanvasPreview.render();
            } catch(e) {
                (div as any).errorCallback(e);
            }

            result.destroy = () => {
                texture.destroy();
                radiusSlider.destroy();
            };
            result.getInput = function () {
                result.destroy();
                return {
                    radius: radius
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply(params: IFilterApply) {
        let context = params.context;
        let history = params.history;
        let radius = params.input.radius;
        if (!context || !radius || !history)
            return false;
        history.pause(true);
        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false; // todo more specific error?
        }
        let texture = glCanvas.texture(context.canvas);
        glCanvas.draw(texture).triangleBlur(radius).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(glCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ["filter", "glBlur"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};