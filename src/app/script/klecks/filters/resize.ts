import {BB} from '../../bb/bb';
import {Checkbox} from '../ui/base-components/checkbox';
import {Select} from '../ui/base-components/select';
// @ts-ignore
import constrainImg from 'url:~/src/app/img/ui/constrain.svg';
import {IFilterApply, IFilterGetDialogParam} from '../kl.types';
import {LANG} from '../../language/language';

export const resize = {

    getDialog(params: IFilterGetDialogParam) {
        //BB.centerWithin
        let canvas = params.canvas;
        if (!canvas)
            return false;

        let fit = BB.fitInto( canvas.getWidth(), canvas.getHeight(), 280, 200,1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        let previewFactor = w / canvas.getWidth();
        let tempCanvas = canvas.getCompleteCanvas(1);


        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        let newWidth = canvas.getWidth(), newHeight = canvas.getHeight();

        div.innerHTML = LANG('filter-resize-description') + "<br/><br/>";


        let maxWidth = params.maxWidth, maxHeight = params.maxHeight;

        let widthWrapper = BB.el({
            css: {
                width: '150px',
                height: '35px',
                lineHeight: '30px',
            }
        });
        let heightWrapper = BB.el({
            css: {
                width: '150px',
                height: '35px',
                lineHeight: '30px',
            }
        });
        let widthInput = BB.el({
            tagName: 'input',
            css: {
                cssFloat: 'right',
                width: '90px',
            },
            custom: {
                type: 'number',
                min: '1',
                max: '' + maxWidth,
                value: '' + canvas.getWidth(),
            }
        }) as HTMLInputElement;
        let heightInput = BB.el({
            tagName: 'input',
            css: {
                cssFloat: 'right',
                width: '90px',
            },
            custom: {
                type: 'number',
                min: '1',
                max: '' + maxHeight,
                value: '' + canvas.getHeight(),
            }
        }) as HTMLInputElement;
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
        widthWrapper.append(LANG('width') + ": ", widthInput);
        heightWrapper.append(LANG('height') + ": ", heightInput);
        let inputWrapper = BB.el({
            css: {
                background: "url(" + constrainImg + ") no-repeat 140px 5px",
                backgroundSize: '50px 52px',
            }
        });
        inputWrapper.append(widthWrapper, heightWrapper);
        div.appendChild(inputWrapper);

        //contrain checkbox
        let heightChanged = false, widthChanged = false;
        let ratio = canvas.getWidth() / canvas.getHeight();

        function updateConstrain() {
            if (isConstrained) {
                widthInput.value = '' + canvas.getWidth();
                heightInput.value = '' + canvas.getHeight();
                inputWrapper.style.background = "url(" + constrainImg + ") no-repeat 140px 5px";
                inputWrapper.style.backgroundSize = '50px 52px';
                update();
            } else {
                inputWrapper.style.background = "";
            }
        }

        let isConstrained = true;
        let constrainCheckbox = new Checkbox({
            init: true,
            label: LANG('constrain-proportions'),
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
                ['smooth', LANG('algorithm-smooth')],
                ['pixelated', LANG('algorithm-pixelated')]
            ],
            title: LANG('scaling-algorithm'),
            initValue: 'smooth',
            onChange: function() {
                update();
            },
        });

        let secondRowElement = BB.el({
            parent: div,
            css: {
                display: 'flex',
                justifyContent: 'space-between'
            }
        });
        secondRowElement.appendChild(constrainCheckbox.getElement());
        secondRowElement.appendChild(algorithmSelect.getElement());

        let previewCanvas = BB.canvas(w, h);
        previewCanvas.style.imageRendering = 'pixelated';


        let previewCtx = previewCanvas.getContext('2d');


        function draw() {
            if (algorithmSelect.getValue() === 'smooth') {
                previewCanvas.style.imageRendering = previewFactor > 1 ? 'pixelated' : '';

                previewCanvas.width = canvas.getWidth();
                previewCanvas.height = canvas.getHeight();

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

                if (parseInt(widthInput.value) > maxWidth || parseInt(heightInput.value) > maxHeight) {
                    let fit = BB.fitInto(parseInt(widthInput.value), parseInt(heightInput.value), maxWidth, maxHeight, 1);
                    widthInput.value = '' + parseInt('' + fit.width);
                    heightInput.value = '' + parseInt('' + fit.height);
                }
            }

            if (parseInt(widthInput.value) > maxWidth) {
                widthInput.value = '' + maxWidth;
            }
            if (parseInt(heightInput.value) > maxHeight) {
                heightInput.value = '' + maxHeight;
            }

            heightChanged = false;
            widthChanged = false;

            newWidth = parseInt(widthInput.value);
            newHeight = parseInt(heightInput.value);

            let preview = BB.fitInto(newWidth, newHeight, 280, 200, 1);
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
            userSelect: 'none',
            colorScheme: 'only light',
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

        result.destroy = () => {
            constrainCheckbox.destroy();
        };
        result.getInput = function () {
            result.destroy();
            return {
                width: newWidth,
                height: newHeight,
                algorithm: algorithmSelect.getValue()
            };
        };
        return result;
    },

    apply(params: IFilterApply) {
        let canvas = params.canvas;
        let history = params.history;
        let width = params.input.width;
        let height = params.input.height;
        let algorithm = params.input.algorithm;
        if (!canvas || !history) {
            return false;
        }
        history.pause(true);
        canvas.resize(width, height, algorithm);
        history.pause(false);
        history.push({
            tool: ["filter", "resize"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    }

};