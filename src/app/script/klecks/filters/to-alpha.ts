import {BB} from '../../bb/bb';
import {Options} from '../ui/base-components/options';
import {ColorOptions} from '../ui/base-components/color-options';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from './shared-gl-fx';
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer} from '../kl.types';
import {LANG} from '../../language/language';

export const toAlpha = {

    getDialog(params: IFilterGetDialogParam) {
        let context = params.context;
        let canvas = params.canvas;
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

        let div = document.createElement("div");
        let result: any = {
            element: div
        };

        function finishInit() {
            let radius = 2, strength = 5.1 / 10;
            div.appendChild(BB.el({
                content: LANG('filter-to-alpha-description'),
                css: {
                    marginBottom: '5px'
                }
            }));

            let glCanvas = getSharedFx();
            if (!glCanvas) {
                return; // todo throw?
            }
            let texture = glCanvas.texture(tempCanvas);
            glCanvas.draw(texture).update(); // update glCanvas size

            function updatePreview() {
                glCanvas.draw(texture).toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj).update();
                klCanvasPreview.render();
            }

            // source
            let sourceId = 'inverted-luminance';
            let sourceOptions = new Options({
                optionArr: [
                    {
                        id: 'inverted-luminance',
                        label: LANG('filter-to-alpha-inverted-lum')
                    },
                    {
                        id: 'luminance',
                        label: LANG('filter-to-alpha-lum')
                    }
                ],
                initialId: sourceId,
                onChange: function(id) {
                    sourceId = id;
                    updatePreview();
                }
            });
            div.appendChild(sourceOptions.getElement());

            // color
            let selectedRgbaObj = {r: 0, g: 0, b: 0, a: 1};
            let colorOptionsArr = [
                null,
                {r: 0, g: 0, b: 0, a: 1},
                {r: 255, g: 255, b: 255, a: 1}
            ];
            colorOptionsArr.push({
                r: params.currentColorRgb.r,
                g: params.currentColorRgb.g,
                b: params.currentColorRgb.b,
                a: 1,
            });
            colorOptionsArr.push({
                r: params.secondaryColorRgb.r,
                g: params.secondaryColorRgb.g,
                b: params.secondaryColorRgb.b,
                a: 1,
            });

            let colorOptions = new ColorOptions({
                label: LANG('filter-to-alpha-replace'),
                colorArr: colorOptionsArr,
                initialIndex: 1,
                onChange: function(rgbaObj) {
                    selectedRgbaObj = rgbaObj;
                    updatePreview();
                }
            });
            colorOptions.getElement().style.marginTop = '10px';
            div.appendChild(colorOptions.getElement());


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

            setTimeout(function() { //ie has a problem otherwise...
                try {
                    updatePreview();
                } catch(e) {
                    (div as any).errorCallback(e);
                }
            }, 1);

            result.destroy = () => {
                texture.destroy();
                sourceOptions.destroy();
            };
            result.getInput = function () {
                result.destroy();
                return {
                    sourceId: sourceId,
                    selectedRgbaObj: selectedRgbaObj
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },


    apply(params: IFilterApply) {
        let context = params.context;
        let history = params.history;
        let sourceId = params.input.sourceId;
        let selectedRgbaObj = params.input.selectedRgbaObj;
        if (!context || !sourceId || !history)
            return false;
        history.pause(true);
        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false; // todo more specific error?
        }
        let texture = glCanvas.texture(context.canvas);
        glCanvas.draw(texture).toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(glCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ["filter", "toAlpha"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};