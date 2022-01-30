import {BB} from '../../bb/bb';
import {Checkbox} from '../ui/base-components/checkbox';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {FreeTransform} from '../ui/components/free-transform';

export const transform = {

    getDialog(params) {
        let i;
        let context = params.context;
        let canvas = params.canvas;
        if (!context || !canvas) {
            return false;
        }

        let isSmall = window.innerWidth < 550;
        let layers = canvas.getLayers();
        let selectedLayerIndex = canvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, isSmall ? 280 : 490, isSmall ? 200 : 240, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);
        let ratio = fit.width / context.canvas.width;
        let freeTransformObj;

        let boundsObj: any = {
            x1: null,
            y1: null,
            x2: null,
            y2: null
        };
        let imdat = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        for (i = 0; i < context.canvas.width; i++) {
            for (let e = 0; e < context.canvas.height; e++) {
                if (imdat.data[i * 4 + e * context.canvas.width * 4 + 3] > 0) {
                    if (i < boundsObj.x1 || boundsObj.x1 === null) {
                        boundsObj.x1 = i;
                    }
                    if (e < boundsObj.y1 || boundsObj.y1 === null) {
                        boundsObj.y1 = e;
                    }
                    if (i > boundsObj.x2 || boundsObj.x2 === null) {
                        boundsObj.x2 = i;
                    }
                    if (e > boundsObj.y2 || boundsObj.y2 === null) {
                        boundsObj.y2 = e;
                    }
                }
            }
        }
        if (boundsObj.x1 === null || boundsObj.y1 === null) {
            alert('Layer is empty.');
            return false;
        }
        boundsObj = {
            x: boundsObj.x1,
            y: boundsObj.y1,
            width: boundsObj.x2 - boundsObj.x1 + 1,
            height: boundsObj.y2 - boundsObj.y1 + 1
        };

        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        if (!isSmall) {
            result.width = 500;
        }
        let brightness = 0, contrast = 0;
        div.innerHTML = "Transforms selected layer. Hold Shift for additional behavior.<br/><br/>";

        let keyListener = new BB.KeyListener({
            onDown: function(keyStr) {
                if(document.activeElement && document.activeElement.tagName === 'INPUT') {
                    return;
                }

                if (keyStr === 'left') {
                    inputX.value = '' + (parseFloat(inputX.value) - 1);
                    onInputsChanged();
                }
                if (keyStr === 'right') {
                    inputX.value = '' + (parseFloat(inputX.value) + 1);
                    onInputsChanged();
                }
                if (keyStr === 'up') {
                    inputY.value = '' + (parseFloat(inputY.value) - 1);
                    onInputsChanged();
                }
                if (keyStr === 'down') {
                    inputY.value = '' + (parseFloat(inputY.value) + 1);
                    onInputsChanged();
                }
            }

        });

        let leftWrapper = document.createElement("div");
        let rightWrapper = document.createElement("div");
        let rotWrapper = document.createElement("div");
        let inputY = document.createElement("input");
        let inputX = document.createElement("input");
        let inputR = document.createElement("input");
        leftWrapper.style.width = "100px";
        leftWrapper.style.height = "30px";
        rightWrapper.style.width = "100px";
        rightWrapper.style.height = "30px";
        rightWrapper.style.display = "inline-block";
        leftWrapper.style.display = "inline-block";
        rotWrapper.style.display = "inline-block";
        rotWrapper.style.width = "150px";
        rotWrapper.style.height = "30px";
        if (navigator.appName !== 'Microsoft Internet Explorer') {
            inputY.type = "number";
            inputX.type = "number";
            inputR.type = "number";
        }
        inputX.style.width = 70 + "px";
        inputY.style.width = 70 + "px";
        inputR.style.width = 70 + "px";
        inputY.value = '0';
        inputX.value = '0';
        inputR.value = '0';
        inputY.onclick = function () {
            (this as any).focus();
            onInputsChanged();
        };
        inputX.onclick = function () {
            (this as any).focus();
            onInputsChanged();
        };
        inputR.onclick = function () {
            (this as any).focus();
            onInputsChanged();
        };
        inputY.onchange = function () {
            onInputsChanged();
        };
        inputX.onchange = function () {
            onInputsChanged();
        };
        inputR.onchange = function () {
            onInputsChanged();
        };
        inputY.onkeyup = function () {
            onInputsChanged();
        };
        inputX.onkeyup = function () {
            onInputsChanged();
        };
        inputR.onkeyup = function () {
            onInputsChanged();
        };
        leftWrapper.append("X: ");
        leftWrapper.appendChild(inputX);
        rightWrapper.append("Y: ");
        rightWrapper.appendChild(inputY);
        rotWrapper.append('Rotation: ');
        rotWrapper.appendChild(inputR);
        div.appendChild(leftWrapper);
        div.appendChild(rightWrapper);
        div.appendChild(rotWrapper);



        let isConstrained = true;
        let constrainCheckbox = new Checkbox({
            init: true,
            label: 'Constrain Proportions',
            allowTab: true,
            callback: function(b) {
                isConstrained = b;
                freeTransformObj.setConstrained(isConstrained);
            },
            css: {
                display: 'inline-block'
            }
        });
        let isSnapping = false;
        let snappingCheckbox = new Checkbox({
            init: true,
            label: 'Snapping',
            allowTab: true,
            callback: function(b) {
                isSnapping = b;
                freeTransformObj.setSnapping(isSnapping);
            },
            css: {
                display: 'inline-block',
                marginLeft: '5px'
            }
        });

        div.appendChild(BB.el({
            css: {
                clear: 'both',
                height: '10px'
            }
        }));
        div.appendChild(constrainCheckbox.getElement());
        div.appendChild(snappingCheckbox.getElement());



        let previewWrapper = document.createElement("div");
        previewWrapper.oncontextmenu = function () {
            return false;
        };
        BB.css(previewWrapper, {
            width: isSmall ? '340px' : '540px',
            marginLeft: "-20px",
            height: isSmall ? '260px' : '300px',
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

        let previewLayerArr = [];
        {
            for(let i = 0; i < layers.length; i++) {
                let canvas;
                if (i === selectedLayerIndex) {
                    canvas = BB.canvas(parseInt('' + w), parseInt('' + h));
                    let ctx = canvas.getContext('2d');
                    ctx.drawImage(layers[i].context.canvas, 0, 0, canvas.width, canvas.height);
                } else {
                    canvas = layers[i].context.canvas;
                }
                previewLayerArr.push({
                    canvas: canvas,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr
                });
            }
        }
        let klCanvasPreview = new KlCanvasPreview({
            width: parseInt('' + w),
            height: parseInt('' + h),
            layerArr: previewLayerArr
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


        function updateTransformLayer() {
            if(!freeTransformObj) {
                return;
            }

            let transformationObj = freeTransformObj.getTransform();
            let transformLayerCanvas = previewLayerArr[selectedLayerIndex].canvas;
            let ctx = transformLayerCanvas.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, transformLayerCanvas.width, transformLayerCanvas.height);
            BB.drawTransformedImageOnCanvasDeprectated(transformLayerCanvas, layers[selectedLayerIndex].context.canvas, transformationObj, boundsObj);
            ctx.restore();
            klCanvasPreview.render();

        }

        let transformParams = {
            x: boundsObj.x * ratio + boundsObj.width * ratio / 2,
            y: boundsObj.y * ratio + boundsObj.height * ratio / 2,
            width: boundsObj.width * ratio,
            height: boundsObj.height * ratio,
            angle: 0,
            //elem: tempCanvas,
            //appendElem: false,
            constrained: true,
            snapX: [0, fit.width],
            snapY: [0, fit.height],
            callback: function (t) {
                inputX.value = "" + Math.round(t.x / ratio);
                inputY.value = "" + Math.round(t.y / ratio);
                inputR.value = "" + Math.round(t.angle);
                updateTransformLayer();
            },
            scale: ratio
        };
        freeTransformObj = new FreeTransform(transformParams);
        BB.css(freeTransformObj.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0'
        });
        previewInnerWrapper.appendChild(freeTransformObj.getElement());

        function onInputsChanged() {
            freeTransformObj.setPos({x: parseInt(inputX.value) * ratio, y: parseInt(inputY.value) * ratio});
            freeTransformObj.setAngle(inputR.value);
            updateTransformLayer();
        }

        updateTransformLayer();

        div.appendChild(previewWrapper);
        result.destroy = () => {
            keyListener.destroy();
            freeTransformObj.destroy();
            constrainCheckbox.destroy();
            snappingCheckbox.destroy();
        };
        result.getInput = function () {
            let trans = freeTransformObj.getTransform();
            trans.width /= ratio;
            trans.height /= ratio;
            trans.x /= ratio;
            trans.y /= ratio;
            trans.bounds = boundsObj;
            result.destroy();

            return trans;
        };
        return result;
    },

    apply(params) {
        let context = params.context;
        let history = params.history;
        if (!context || !history)
            return false;
        history.pause();

        let transformObj = {
            translate: {
                x: Math.round(params.input.x - (params.input.bounds.x + params.input.bounds.width / 2)),
                y: Math.round(params.input.y - (params.input.bounds.y + params.input.bounds.height / 2))
            },
            scale: {
                x: params.input.width / params.input.bounds.width,
                y: params.input.height / params.input.bounds.height
            },
            center: {
                x: params.input.bounds.x + params.input.bounds.width / 2,
                y: params.input.bounds.y + params.input.bounds.height / 2
            },
            angleDegree: params.input.angle
        };
        let copyCanvas = BB.copyCanvas(context.canvas);
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        BB.drawTransformedImageOnCanvas(context.canvas, copyCanvas, transformObj);

        history.pause(false);
        history.add({
            tool: ["filter", "transform"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};