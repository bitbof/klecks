import {BB} from '../../bb/bb';
import {Checkbox} from '../ui/base-components/checkbox';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {FreeTransform, ITransform} from '../ui/components/free-transform';
import {Select} from '../ui/base-components/select';
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer} from '../kl.types';
import {LANG} from '../../language/language';

interface IFilterTransformInput {
    bounds: {x: number, y: number, width: number, height: number};
    transform: ITransform;
    isPixelated: boolean;
}

export const transform = {

    getDialog(params: IFilterGetDialogParam) {
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
        let displayW = parseInt('' + fit.width), displayH = parseInt('' + fit.height);
        let w = Math.min(displayW, context.canvas.width);
        let h = Math.min(displayH, context.canvas.height);
        let freeTransform: FreeTransform;
        let displayPreviewFactor = displayW / context.canvas.width;

        // determine bounds and initial transformation
        let boundsObj: {
            x: number;
            y: number;
            width: number;
            height: number;
        } = { x: 0, y: 0, width: 0, height: 0 };
        {
            let tempBounds: any = {
                x1: null,
                y1: null,
                x2: null,
                y2: null
            };
            let imdat = context.getImageData(0, 0, context.canvas.width, context.canvas.height);

            if (imdat.data[3] > 0 && imdat.data[imdat.data.length - 1] > 0) {
                tempBounds.x1 = 0;
                tempBounds.y1 = 0;
                tempBounds.x2 = context.canvas.width - 1;
                tempBounds.y2 = context.canvas.height - 1;
            } else {
                for (i = 3; i < imdat.data.length; i += 4) {
                    if (imdat.data[i] > 0 ) {
                        let x = ((i - 3) / 4) %  context.canvas.width;
                        let y = Math.floor((i - 3) / 4 / context.canvas.width);
                        if (tempBounds.x1 > x || tempBounds.x1 === null) {
                            tempBounds.x1 = x;
                        }
                        if (tempBounds.y1 === null) {
                            tempBounds.y1 = y;
                        }
                        if (tempBounds.x2 < x || tempBounds.x2 === null) {
                            tempBounds.x2 = x;
                        }
                        if (tempBounds.y2 < y || tempBounds.y2 === null) {
                            tempBounds.y2 = y;
                        }
                    }
                }
            }
            if (tempBounds.x1 === null || tempBounds.y1 === null) {
                alert(LANG('filter-transform-empty'));
                return false;
            }
            boundsObj.x = tempBounds.x1;
            boundsObj.y = tempBounds.y1;
            boundsObj.width = tempBounds.x2 - tempBounds.x1 + 1;
            boundsObj.height = tempBounds.y2 - tempBounds.y1 + 1;
        }

        const initTransform = {
            x: boundsObj.x + boundsObj.width / 2,
            y: boundsObj.y + boundsObj.height / 2,
            width: boundsObj.width,
            height: boundsObj.height,
            angleDeg: 0,
        };



        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        if (!isSmall) {
            result.width = 500;
        }
        div.innerHTML = LANG('filter-transform-description');

        let keyListener = new BB.KeyListener({
            onDown: function(keyStr) {
                if (BB.isInputFocused(true)) {
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
        inputY.type = "number";
        inputX.type = "number";
        inputR.type = "number";
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
        leftWrapper.append("X: ", inputX);
        rightWrapper.append("Y: ", inputY);
        rotWrapper.append(LANG('filter-transform-rotation') + ': ', inputR);
        if (!isSmall) {
            const inputRow = BB.el({
                parent: div,
                css: {
                    marginTop: '10px',
                }
            });
            inputRow.append(leftWrapper, rightWrapper, rotWrapper);
        }

        // buttons
        const actionBtnCss = {
            marginLeft: '10px',
            marginTop: '10px',
        };
        const buttonRow = BB.el ({
            parent: div,
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                marginLeft: '-10px',
            }
        });
        const flipXBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' X',
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setSize(-t.width, t.height);
            },
            css: actionBtnCss,
        });
        const flipYBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' Y',
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setSize(t.width, -t.height);
            },
            css: actionBtnCss,
        });
        const scaleRotLeftBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '-90°',
            onClick: () => {
                const t = freeTransform.getTransform();
                t.angleDeg -= 90;
                t.angleDeg %= 360;
                freeTransform.setAngleDeg(t.angleDeg);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });
        const scaleRotRightBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '+90°',
            onClick: () => {
                const t = freeTransform.getTransform();
                t.angleDeg += 90;
                t.angleDeg %= 360;
                freeTransform.setAngleDeg(t.angleDeg);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });
        const scaleDoubleBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '2x',
            onClick: () => {
                const t = freeTransform.getTransform();
                if (constrainCheckbox.getValue()) {
                    freeTransform.setSize(freeTransform.getRatio() * t.height * 2, t.height * 2);
                } else {
                    freeTransform.setSize(t.width * 2, t.height * 2);
                }
            },
            css: actionBtnCss,
        });
        const scaleHalfBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '1/2x',
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setSize(Math.round(t.width / 2), Math.round(t.height / 2));
            },
            css: actionBtnCss,
        });
        const centerBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('center'),
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setPos({ x: context.canvas.width / 2, y: context.canvas.height / 2 });
                freeTransform.setAngleDeg(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });





        let isConstrained = true;
        let constrainCheckbox = new Checkbox({
            init: true,
            label: LANG('filter-transform-constrain'),
            title: LANG('constrain-proportions'),
            allowTab: true,
            callback: function(b) {
                isConstrained = b;
                freeTransform.setConstrained(isConstrained);
            },
            css: {
                display: 'inline-block'
            }
        });
        let isSnapping = false;
        let snappingCheckbox = new Checkbox({
            init: true,
            label: LANG('filter-transform-snap'),
            title: LANG('filter-transform-snap-title'),
            allowTab: true,
            callback: function(b) {
                isSnapping = b;
                freeTransform.setSnapping(isSnapping);
            },
            css: {
                display: 'inline-block',
                marginLeft: '10px',
            }
        });
        const checkboxWrapper = BB.el({});
        checkboxWrapper.append(constrainCheckbox.getElement(), snappingCheckbox.getElement());

        div.appendChild(BB.el({
            css: {
                clear: 'both',
                height: '10px'
            }
        }));

        const bottomRow = BB.el({
            parent: div,
            css: {
                display: 'flex',
                justifyContent: 'space-between',
            }
        });

        let algorithmSelect = new Select({
            isFocusable: true,
            optionArr: [
                ['smooth', LANG('algorithm-smooth')],
                ['pixelated', LANG('algorithm-pixelated')]
            ],
            initValue: 'smooth',
            title: LANG('scaling-algorithm'),
            onChange: function() {
                updatePreview(true);
            },
        });
        bottomRow.append(checkboxWrapper, algorithmSelect.getElement());


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
            justifyContent: 'center',
            colorScheme: 'only light',
        });

        let previewLayerArr: IKlBasicLayer[] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                let canvas;
                if (i === selectedLayerIndex) {
                    canvas = BB.canvas(parseInt('' + w), parseInt('' + h));
                    let ctx = canvas.getContext('2d');
                    ctx.drawImage(layers[i].context.canvas, 0, 0, canvas.width, canvas.height);
                } else {
                    canvas = layers[i].context.canvas;
                }
                previewLayerArr.push({
                    image: canvas,
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

        let lastDrawnTransformStr;
        function updatePreview(doForce: boolean = false) {
            if (!freeTransform) {
                return;
            }
            let transform = freeTransform.getTransform();
            if (JSON.stringify(transform) === lastDrawnTransformStr && !doForce) {
                return;
            }
            lastDrawnTransformStr = JSON.stringify(transform);
            if (displayPreviewFactor < 1) {
                transform.x *= displayPreviewFactor;
                transform.y *= displayPreviewFactor;
                transform.width *= displayPreviewFactor;
                transform.height *= displayPreviewFactor;
            }
            let transformLayerCanvas = previewLayerArr[selectedLayerIndex].image as HTMLCanvasElement;
            let ctx = transformLayerCanvas.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, transformLayerCanvas.width, transformLayerCanvas.height);
            BB.drawTransformedImageWithBounds(
                ctx,
                layers[selectedLayerIndex].context.canvas,
                transform,
                boundsObj,
                algorithmSelect.getValue() === 'pixelated' ||
                BB.testShouldPixelate(transform, transform.width / initTransform.width, transform.height / initTransform.height),
            );
            ctx.restore();
            klCanvasPreview.render();
        }

        freeTransform = new FreeTransform({
            x: initTransform.x,
            y: initTransform.y,
            width: initTransform.width,
            height: initTransform.height,
            angleDeg: initTransform.angleDeg,
            isConstrained: true,
            snapX: [0, context.canvas.width],
            snapY: [0, context.canvas.height],
            callback: function (t) {
                inputX.value = '' + Math.round(t.x - initTransform.x);
                inputY.value = '' + Math.round(t.y - initTransform.y);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            scale: displayPreviewFactor
        });
        BB.css(freeTransform.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0'
        });
        previewInnerWrapper.appendChild(freeTransform.getElement());

        function onInputsChanged() {
            freeTransform.setPos({
                x: parseInt(inputX.value) + initTransform.x,
                y: parseInt(inputY.value) + initTransform.y}
            );
            freeTransform.setAngleDeg(parseInt(inputR.value));
            updatePreview();
        }

        updatePreview();

        div.appendChild(previewWrapper);
        result.destroy = () => {
            keyListener.destroy();
            freeTransform.destroy();
            constrainCheckbox.destroy();
            snappingCheckbox.destroy();
            BB.destroyEl(flipXBtn);
            BB.destroyEl(flipYBtn);
            BB.destroyEl(scaleRotLeftBtn);
            BB.destroyEl(scaleRotRightBtn);
            BB.destroyEl(scaleDoubleBtn);
            BB.destroyEl(scaleHalfBtn);
            BB.destroyEl(centerBtn);
        };
        result.getInput = function () {
            const transform = freeTransform.getTransform();
            let input = {
                transform,
                bounds: boundsObj,
                isPixelated: algorithmSelect.getValue() === 'pixelated' ||
                    BB.testShouldPixelate(transform, transform.width / initTransform.width, transform.height / initTransform.height),
            } as IFilterTransformInput;
            result.destroy();
            return JSON.parse(JSON.stringify(input));
        };
        return result;
    },

    apply(params: IFilterApply) {
        const context = params.context;
        const history = params.history;
        if (!context || !history) {
            return false;
        }
        history.pause(true);

        const input: IFilterTransformInput = params.input;

        let copyCanvas = BB.copyCanvas(context.canvas);
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        BB.drawTransformedImageWithBounds(
            context,
            copyCanvas,
            input.transform,
            input.bounds,
            input.isPixelated,
        );

        history.pause(false);
        history.push({
            tool: ["filter", "transform"],
            action: "apply",
            params: [{input}],
        });
        return true;
    }

};