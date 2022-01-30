import {BB} from '../../bb/bb';
import {checkBox} from '../ui/base-components/check-box';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
// @ts-ignore
import checkmarkImg from 'url:~/src/app/img/ui/checkmark.svg';

export const flip = {

    getDialog(params) {
        let context = params.context;
        let canvas = params.canvas;
        if (!context || !canvas) {
            return false;
        }

        let layers = canvas.getLayers();
        let selectedLayerIndex = canvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        let isHorizontal = true;
        let isVertical = false;
        let doFlipCanvas = true;
        div.innerHTML = "Flips layer or whole image.<br/><br/>";


        let horizontalCheckbox = checkBox({
            init: isHorizontal,
            label: 'Horizontal ⟷',
            allowTab: true,
            callback: function(v) {
                isHorizontal = v;
                updatePreview();
            },
            css: {
                marginBottom: '10px'
            }
        });
        let verticalCheckbox = checkBox({
            init: isVertical,
            label: 'Vertical ↕',
            allowTab: true,
            callback: function(v) {
                isVertical = v;
                updatePreview();
            },
            css: {
                marginBottom: '10px'
            }
        });
        div.appendChild(horizontalCheckbox);
        div.appendChild(verticalCheckbox);





        let fcOption = document.createElement("div");
        BB.setEventListener(fcOption, 'onpointerdown', function () {
            return false;
        });
        fcOption.textContent = "Flip Image";
        fcOption.style.width = "150px";
        fcOption.style.height = "30px";
        fcOption.style.paddingTop = "10px";
        fcOption.style.textAlign = "center";
        fcOption.style.cssFloat = "left";
        fcOption.style.paddingBottom = "0px";
        fcOption.style.borderTopLeftRadius = "10px";
        fcOption.style.boxShadow = "inset 0px 5px 10px rgba(0,0,0,0.5)";
        fcOption.style.background = "url(" + checkmarkImg + ") no-repeat 12px 16px";
        fcOption.style.backgroundSize = '8%';
        fcOption.style.backgroundColor = "#9e9e9e";

        let flOption = document.createElement("div");
        BB.setEventListener(flOption, 'onpointerdown', function () {
            return false;
        });
        flOption.textContent = "Flip Layer";
        flOption.style.width = "150px";
        flOption.style.height = "30px";
        flOption.style.paddingTop = "10px";
        flOption.style.textAlign = "center";
        flOption.style.cssFloat = "left";
        flOption.style.paddingBottom = "0px";
        flOption.style.borderTopRightRadius = "10px";
        flOption.style.cursor = "pointer";
        flOption.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        flOption.style.backgroundSize = '8%';

        BB.setEventListener(fcOption, 'onpointerover', function () {
            if (doFlipCanvas === false)
                fcOption.style.backgroundColor = "#ccc";
        });
        BB.setEventListener(fcOption, 'onpointerout', function () {
            if (doFlipCanvas === false)
                fcOption.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        });
        BB.setEventListener(flOption, 'onpointerover', function () {
            if (doFlipCanvas === true)
                flOption.style.backgroundColor = "#ccc";
        });
        BB.setEventListener(flOption, 'onpointerout', function () {
            if (doFlipCanvas === true)
                flOption.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        });

        fcOption.onclick = function () {
            doFlipCanvas = true;

            flOption.style.background = "";
            flOption.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
            flOption.style.boxShadow = "";
            flOption.style.cursor = "pointer";

            fcOption.style.background = "url(" + checkmarkImg + ") no-repeat 12px 16px";
            fcOption.style.backgroundSize = '8%';
            fcOption.style.backgroundColor = "#9e9e9e";
            fcOption.style.cursor = "default";
            fcOption.style.boxShadow = "inset 0px 5px 10px rgba(0,0,0,0.5)";

            updatePreview();
        };
        flOption.onclick = function () {
            doFlipCanvas = false;

            fcOption.style.background = "";
            fcOption.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
            fcOption.style.boxShadow = "";
            fcOption.style.cursor = "pointer";

            flOption.style.background = "url(" + checkmarkImg + ") no-repeat 12px 16px";
            flOption.style.backgroundSize = '8%';
            flOption.style.backgroundColor = "#9e9e9e";
            flOption.style.cursor = "default";
            flOption.style.boxShadow = "inset 0px 5px 10px rgba(0,0,0,0.5)";

            updatePreview();
        };

        let optionWrapper = document.createElement("div");
        optionWrapper.appendChild(fcOption);
        optionWrapper.appendChild(flOption);
        div.appendChild(optionWrapper);


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
            justifyContent: 'center'
        });

        let previewLayer = {
            canvas: BB.canvas(parseInt('' + w), parseInt('' + h)),
            opacity: 1,
            mixModeStr: 'source-over'
        };
        let klCanvasPreview = new KlCanvasPreview({
            width: parseInt('' + w),
            height: parseInt('' + h),
            layerArr: [previewLayer]
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

        function updatePreview() {
            let ctx = previewLayer.canvas.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, previewLayer.canvas.width, previewLayer.canvas.height);

            if (doFlipCanvas) {
                if (isHorizontal) {
                    ctx.translate(previewLayer.canvas.width, 0);
                    ctx.scale(-1, 1);
                }
                if (isVertical) {
                    ctx.translate(0, previewLayer.canvas.height);
                    ctx.scale(1, -1);
                }
            }

            for(let i = 0; i < layers.length; i++) {
                ctx.save();
                if (!doFlipCanvas && selectedLayerIndex === i) {
                    if (isHorizontal) {
                        ctx.translate(previewLayer.canvas.width, 0);
                        ctx.scale(-1, 1);
                    }
                    if (isVertical) {
                        ctx.translate(0, previewLayer.canvas.height);
                        ctx.scale(1, -1);
                    }
                }
                if (ctx.canvas.width > layers[i].context.canvas.width) {
                    ctx.imageSmoothingEnabled = false;
                }
                ctx.globalAlpha = parseFloat(layers[i].opacity);
                ctx.globalCompositeOperation = layers[i].mixModeStr;
                ctx.drawImage(layers[i].context.canvas, 0, 0, previewLayer.canvas.width, previewLayer.canvas.height);
                ctx.restore();
            }
            klCanvasPreview.render();
            ctx.restore();
        }
        setTimeout(updatePreview, 0);


        div.appendChild(previewWrapper);
        result.getInput = function () {
            return {
                horizontal: isHorizontal,
                vertical: isVertical,
                flipCanvas: doFlipCanvas
            };
        };
        return result;
    },

    apply(params) {
        let context = params.context;
        let canvas = params.canvas;
        let history = params.history;
        let horizontal = params.input.horizontal;
        let vertical = params.input.vertical;
        let flipCanvas = params.input.flipCanvas;
        if (!context || !canvas || !history) {
            return false;
        }

        history.pause();
        canvas.flip(horizontal, vertical, flipCanvas ? null : canvas.getLayerIndex(context.canvas));
        history.pause(false);

        history.add({
            tool: ["filter", "flip"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    },

};