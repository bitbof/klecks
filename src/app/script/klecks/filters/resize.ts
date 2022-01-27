import {BB} from '../../bb/bb';
import {checkBox} from '../ui/base-components/check-box';
import {Select} from '../ui/base-components/select';
// @ts-ignore
import constrainImg from 'url:~/src/app/img/ui/constrain.svg';

export const resize = {

    getDialog(params) {
        //BB.centerWithin
        let canvas = params.canvas;
        if (!canvas)
            return false;

        let fit = BB.fitInto(280, 200, canvas.width, canvas.height, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        let previewFactor = w / canvas.width;
        let tempCanvas = canvas.getCompleteCanvas(1);


        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        let newWidth = canvas.width, newHeight = canvas.height;

        div.innerHTML = "Resizes the image.<br/><br/>";


        let maxWidth = params.maxWidth, maxHeight = params.maxHeight;

        let widthWrapper = document.createElement("div");
        let heightWrapper = document.createElement("div");
        let widthInput = document.createElement("input");
        let heightInput = document.createElement("input");
        widthInput.style.cssFloat = "right";
        widthInput.style.width = "90px";
        widthWrapper.style.width = "150px";
        widthWrapper.style.height = "35px";
        widthWrapper.style.lineHeight = "30px";
        heightInput.style.cssFloat = "right";
        heightInput.style.width = "90px";
        heightWrapper.style.width = "150px";
        heightWrapper.style.height = "35px";
        heightWrapper.style.lineHeight = "30px";
        if (navigator.appName != 'Microsoft Internet Explorer')
            widthInput.type = "number";
        widthInput.min = '1';
        widthInput.max = maxWidth;
        if (navigator.appName != 'Microsoft Internet Explorer')
            heightInput.type = "number";
        heightInput.min = '1';
        heightInput.max = maxHeight;
        widthInput.value = canvas.width;
        heightInput.value = canvas.height;
        widthInput.onclick = function () {
            (this as any).focus();
            widthChanged = true;
            update();
        };
        heightInput.onclick = function () {
            (this as any).focus();
            heightChanged = true;
            update();
        };
        widthInput.onchange = function () {
            widthChanged = true;
            update();
        };
        heightInput.onchange = function () {
            heightChanged = true;
            update();
        };
        /*widthInput.onkeyup = function () {
            widthChanged = true;
            update();
        };
        heightInput.onkeyup = function () {
            heightChanged = true;
            update();
        };*/
        widthWrapper.append("Width: ");
        widthWrapper.appendChild(widthInput);
        heightWrapper.append("Height: ");
        heightWrapper.appendChild(heightInput);
        let inputWrapper = document.createElement("div");
        inputWrapper.style.background = "url(" + constrainImg + ") no-repeat 140px 5px";
        inputWrapper.style.backgroundSize = '50px 52px';
        inputWrapper.appendChild(widthWrapper);
        inputWrapper.appendChild(heightWrapper);
        div.appendChild(inputWrapper);

        //contrain checkbox
        let heightChanged = false, widthChanged = false;
        let ratio = canvas.width / canvas.height;

        function updateConstrain() {
            if (isConstrained) {
                widthInput.value = canvas.width;
                heightInput.value = canvas.height;
                inputWrapper.style.background = "url(" + constrainImg + ") no-repeat 140px 5px";
                inputWrapper.style.backgroundSize = '50px 52px';
                update();
            } else {
                inputWrapper.style.background = "";
            }
        }

        let isConstrained = true;
        let constrainCheckbox = checkBox({
            init: true,
            label: 'Constrain Proportions',
            allowTab: true,
            callback: function(b) {
                isConstrained = b;
                updateConstrain();
            }
        });
        div.appendChild(BB.el({
            css: {
                clear: 'both'
            }
        }));


        let algorithmSelect = new Select({
            isFocusable: true,
            optionArr: [
                ['smooth', 'Smooth'],
                ['pixelated', 'Pixelated']
            ],
            initValue: 'smooth',
            onChange: function() {
                update();
            },
        });

        let secondRowElement = BB.el({
            parent: div,
            title: 'Algorithm',
            css: {
                display: 'flex',
                justifyContent: 'space-between'
            }
        });
        secondRowElement.appendChild(constrainCheckbox);
        secondRowElement.appendChild(algorithmSelect.getElement());

        let previewCanvas = BB.canvas();
        previewCanvas.width = w;
        previewCanvas.height = h;
        previewCanvas.style.imageRendering = 'pixelated';


        let previewCtx = previewCanvas.getContext('2d');


        function draw() {
            if(algorithmSelect.getValue() === 'smooth') {
                previewCanvas.style.imageRendering = previewFactor > 1 ? 'pixelated' : '';

                previewCanvas.width = canvas.width;
                previewCanvas.height = canvas.height;

                previewCtx.save();
                previewCtx.imageSmoothingQuality = 'high';
                previewCtx.drawImage(tempCanvas, 0, 0);
                BB.resizeCanvas(previewCanvas, newWidth, newHeight);
                previewCtx.restore();

            } else {
                previewCanvas.style.imageRendering = 'pixelated';

                previewCanvas.width = newWidth;
                previewCanvas.height = newHeight;
                previewCtx.save();
                previewCtx.imageSmoothingEnabled = false;
                previewCtx.drawImage(tempCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
                previewCtx.restore();
            }

        }

        function update() {
            if ((widthInput.value.length === 0 && widthChanged) || (heightInput.value.length === 0 && heightChanged)) {
                heightChanged = false;
                widthChanged = false;
                return;
            }
            widthInput.value = '' + Math.max(1, parseInt(widthInput.value));
            heightInput.value = '' + Math.max(1, parseInt(heightInput.value));
            if (isConstrained) {
                if (heightChanged) {
                    widthInput.value = '' + parseInt('' + (parseInt(heightInput.value) * ratio));
                }
                if (widthChanged) {
                    heightInput.value = '' + parseInt('' + (parseInt(widthInput.value) / ratio));
                }

                if (widthInput.value > maxWidth || heightInput.value > maxHeight) {
                    let fit = BB.fitInto(maxWidth, maxHeight, parseInt(widthInput.value), parseInt(heightInput.value), 1);
                    widthInput.value = '' + parseInt('' + fit.width);
                    heightInput.value = '' + parseInt('' + fit.height);
                }
            }

            if (widthInput.value > maxWidth)
                widthInput.value = maxWidth;
            if (heightInput.value > maxHeight)
                heightInput.value = maxHeight;

            heightChanged = false;
            widthChanged = false;

            newWidth = widthInput.value;
            newHeight = heightInput.value;

            let preview = BB.fitInto(280, 200, newWidth, newHeight, 1);
            let previewW = parseInt('' + preview.width), previewH = parseInt('' + preview.height);
            previewFactor = previewW / newWidth;

            let offset = BB.centerWithin(340, 220, previewW, previewH);

            draw();

            previewCanvas.style.width = Math.max(1, previewW) + "px";
            previewCanvas.style.height = Math.max(1, previewH) + "px";
            canvasWrapper.style.left = offset.x + "px";
            canvasWrapper.style.top = offset.y + "px";
            canvasWrapper.style.width = Math.max(1, previewW) + "px";
            canvasWrapper.style.height = Math.max(1, previewH) + "px";
        }

        let previewWrapper = document.createElement("div");
        BB.css(previewWrapper, {
            width: "340px",
            marginLeft: "-20px",
            height: "220px",
            display: "table",
            backgroundColor: "#9e9e9e",
            marginTop: "10px",
            boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset",
            position: "relative",
            userSelect: 'none'
        });


        let canvasWrapper = BB.appendTextDiv(previewWrapper, "");
        canvasWrapper.appendChild(previewCanvas);
        canvasWrapper.style.width = w + "px";
        canvasWrapper.style.height = h + "px";
        canvasWrapper.style.position = "absolute";
        canvasWrapper.style.overflow = "hidden";
        canvasWrapper.style.boxShadow = "0 0 5px rgba(0,0,0,0.8)";
        canvasWrapper.style.overflow = "hidden";
        BB.createCheckerDataUrl(8, function (url) {
            previewWrapper.style.background = "url(" + url + ")";
        });

        div.appendChild(previewWrapper);
        update();

        result.getInput = function () {

            return {
                width: newWidth,
                height: newHeight,
                algorithm: algorithmSelect.getValue()
            };
        };
        return result;
    },

    apply(params) {
        let canvas = params.canvas;
        let history = params.history;
        let width = params.input.width;
        let height = params.input.height;
        let algorithm = params.input.algorithm;
        if (!canvas || !history) {
            return false;
        }
        history.pause();
        canvas.resize(width, height, algorithm);
        history.pause(false);
        history.add({
            tool: ["filter", "resize"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};