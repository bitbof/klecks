import {BB} from '../../bb/bb';
import {input} from '../ui/base-components/input';
import {Checkbox} from '../ui/base-components/checkbox';
import {ColorOptions} from '../ui/base-components/color-options';
import {Cropper} from '../ui/components/cropper';
import {IFilterApply, IFilterGetDialogParam} from '../kl.types';
import {LANG} from '../../language/language';

export const cropExtend = {

    getDialog(params: IFilterGetDialogParam) {
        const canvas = params.canvas;
        if (!canvas)
            return false;
        const tempCanvas = BB.canvas();
        {
            let fit = BB.fitInto(canvas.getWidth(), canvas.getHeight(), 560, 400, 1);
            let w = parseInt('' + fit.width), h = parseInt('' + fit.height);
            let previewFactor = w / canvas.getWidth();
            tempCanvas.width = w;
            tempCanvas.height = h;
            tempCanvas.style.display = 'block';
            tempCanvas.getContext("2d").drawImage(canvas.getCompleteCanvas(previewFactor), 0, 0, w, h);
        }

        const div = document.createElement("div");
        const result: any = {
            element: div
        };
        div.innerHTML = LANG('filter-crop-description') + "<br/><br/>";
        let left = 0, right = 0, top = 0, bottom = 0;
        let leftChanged = false, rightChanged = false, topChanged = false, bottomChanged = false;
        const maxWidth = params.maxWidth, maxHeight = params.maxHeight;
        let scale;



        // --- input elements ---

        const lrWrapper = BB.el({
            css: {lineHeight: '30px', height: '35px'}
        });
        const tbWrapper = BB.el({
            css: {lineHeight: '30px', height: '35px'}
        });
        div.appendChild(lrWrapper);
        div.appendChild(tbWrapper);

        const leftInput = input({
            init: 0,
            type: 'number',
            min: -canvas.getWidth(),
            max: maxWidth,
            css: {width: '75px', marginRight: '20px'},
            callback: function(v) {
                leftChanged = true;
                updateInput();
            }
        });
        const rightInput = input({
            init: 0,
            type: 'number',
            min: -canvas.getWidth(),
            max: maxWidth,
            css: {width: '75px'},
            callback: function(v) {
                rightChanged = true;
                updateInput();
            }
        });
        const topInput = input({
            init: 0,
            type: 'number',
            min: -canvas.getHeight(),
            max: maxHeight,
            css: {width: '75px', marginRight: '20px'},
            callback: function(v) {
                topChanged = true;
                updateInput();
            }
        });
        const bottomInput = input({
            init: 0,
            type: 'number',
            min: -canvas.getHeight(),
            max: maxHeight,
            css: {width: '75px'},
            callback: function(v) {
                bottomChanged = true;
                updateInput();
            }
        });

        const labelStyle = {
            display: 'inline-block',
            width: '60px'
        };
        lrWrapper.append(
            BB.el({content: LANG('filter-crop-left') + ':', css: labelStyle}),
            leftInput,
            BB.el({content: LANG('filter-crop-right') + ':', css: labelStyle}),
            rightInput
        );
        tbWrapper.append(
            BB.el({content: LANG('filter-crop-top') + ':', css: labelStyle}),
            topInput,
            BB.el({content: LANG('filter-crop-bottom') + ':', css: labelStyle}),
            bottomInput
        );

        function updateInput() {
            left = parseInt(leftInput.value);
            right = parseInt(rightInput.value);
            top = parseInt(topInput.value);
            bottom = parseInt(bottomInput.value);
            let newWidth = canvas.getWidth() + left + right;
            let newHeight = canvas.getHeight() + top + bottom;

            if (newWidth <= 0) {
                if (leftChanged) {
                    left = -canvas.getWidth() - right + 1;
                    leftInput.value = '' + left;
                }
                if (rightChanged) {
                    right = -canvas.getWidth() - left + 1;
                    rightInput.value = '' + right;
                }
                newWidth = 1;
            }
            if (newWidth > maxWidth) {
                if (leftChanged) {
                    left = -canvas.getWidth() - right + maxWidth;
                    leftInput.value = '' + left;
                }
                if (rightChanged) {
                    right = -canvas.getWidth() - left + maxWidth;
                    rightInput.value = '' + right;
                }
                newWidth = maxWidth;
            }
            if (newHeight <= 0) {
                if (topChanged) {
                    top = -canvas.getHeight() - bottom + 1;
                    topInput.value = '' + top;
                }
                if (bottomChanged) {
                    bottom = -canvas.getHeight() - top + 1;
                    bottomInput.value = '' + bottom;
                }
                newHeight = 1;
            }
            if (newHeight > maxHeight) {
                if (topChanged) {
                    top = -canvas.getHeight() - bottom + maxHeight;
                    topInput.value = '' + top;
                }
                if (bottomChanged) {
                    bottom = -canvas.getHeight() - top + maxHeight;
                    bottomInput.value = '' + bottom;
                }
                newHeight = maxHeight;
            }
            cropper.setTransform({
                x: -left,
                y: -top,
                width: newWidth,
                height: newHeight
            });


            leftChanged = false;
            rightChanged = false;
            topChanged = false;
            bottomChanged = false;
        }

        let useRuleOfThirds = true;
        let ruleOThirdsCheckbox = new Checkbox({
            init: true,
            label: LANG('filter-crop-rule-thirds'),
            allowTab: true,
            callback: function(b) {
                useRuleOfThirds = b;
                cropper.showThirds(useRuleOfThirds);
            }
        });
        div.appendChild(BB.el({
            css: {
                clear: 'both'
            }
        }));

        let selectedRgbaObj = {r: 0, g: 0, b: 0, a: 0};
        const colorOptionsArr = [
            {r: 0, g: 0, b: 0, a: 0},
            {r: 255, g: 255, b: 255, a: 1},
            {r: 0, g: 0, b: 0, a: 1}
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

        const colorOptions = new ColorOptions({
            label: LANG('filter-crop-fill'),
            colorArr: colorOptionsArr,
            onChange: function(rgbaObj) {
                selectedRgbaObj = rgbaObj;
                updateBg(rgbaObj);
            }
        });


        const flexRow = BB.el({
            css: {
                display: 'flex',
                justifyContent: 'space-between'
            }
        });
        div.appendChild(flexRow);
        flexRow.appendChild(ruleOThirdsCheckbox.getElement());
        flexRow.appendChild(colorOptions.getElement());


        // when input field changed, or dragging in preview finished
        // adjusts the zoom
        function update(transform) {
            const fit = BB.fitInto(transform.width, transform.height, 260, 180, 1);
            scale = fit.width / transform.width;

            const offset = BB.centerWithin(340, 220, fit.width, fit.height);

            tempCanvas.style.width = canvas.getWidth() * scale + "px";
            tempCanvas.style.height = canvas.getHeight() * scale + "px";

            offsetWrapper.style.left = (offset.x - transform.x * scale) + "px";
            offsetWrapper.style.top = (offset.y - transform.y * scale) + "px";

            left = parseInt('' + -transform.x);
            top = parseInt('' + -transform.y);
            right = parseInt('' + (transform.x + transform.width - canvas.getWidth()));
            bottom = parseInt('' + (transform.y + transform.height - canvas.getHeight()));
            leftInput.value = '' + left;
            topInput.value = '' + top;
            rightInput.value = '' + right;
            bottomInput.value = '' + bottom;

            BB.createCheckerDataUrl(parseInt('' + (50 * scale)), function (url) {
                previewWrapper.style.background = "url(" + url + ")";
                if (selectedRgbaObj.a !== 0) {
                    tempCanvas.style.background = "url(" + url + ")";
                }
            });
            previewWrapper.style.backgroundPosition = (offset.x) + "px " + (offset.y) + "px";

            cropper.setScale(scale);
        }

        const previewWrapper = BB.el({
            css: {
                width: "340px",
                marginTop: '10px',
                marginLeft: "-20px",
                height: "220px",
                backgroundColor: "#9e9e9e",
                position: "relative",
                boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset",
                overflow: "hidden",
                userSelect: 'none',
                colorScheme: 'only light',
                touchAction: 'none',
            }
        });
        previewWrapper.oncontextmenu = function () {
            return false;
        };
        const bgColorOverlay = BB.el({
            css: {
                position: 'absolute',
                left: '0',
                top: '0',
                bottom: '0',
                right: '0'
            }
        });
        previewWrapper.appendChild(bgColorOverlay);

        const offsetWrapper = document.createElement("div");
        offsetWrapper.style.position = "absolute";
        offsetWrapper.style.left = "0px";
        offsetWrapper.style.top = "0px";
        previewWrapper.appendChild(offsetWrapper);


        const canvasWrapper = BB.appendTextDiv(offsetWrapper, "");
        canvasWrapper.appendChild(tempCanvas);
        //tempCanvas.style.width = w + "px";
        //tempCanvas.style.height = h + "px";
        tempCanvas.style.boxShadow = "0 0 3px 1px rgba(0,0,0,0.5)";
        tempCanvas.style.position = "absolute";
        tempCanvas.style.left = "0px";
        tempCanvas.style.top = "0px";

        div.appendChild(previewWrapper);
        const cropper = new Cropper({
            x: 0,
            y: 0,
            width: canvas.getWidth(),
            height: canvas.getHeight(),
            scale: scale,
            callback: update,
            maxW: maxWidth,
            maxH: maxHeight
        });
        update(cropper.getTransform());
        offsetWrapper.appendChild(cropper.getElement());

        function updateBg(rgbaObj) {

            let borderColor;
            if (rgbaObj.a === 0) {
                borderColor = 'rgba(0,0,0,0.5)';
                bgColorOverlay.style.background = '';
                tempCanvas.style.background = '';
            } else {
                borderColor = (rgbaObj.r + rgbaObj.g + rgbaObj.b < 255 * 3 / 2) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
                bgColorOverlay.style.background = BB.ColorConverter.toRgbStr(rgbaObj);

                BB.createCheckerDataUrl(parseInt('' + (50 * scale)), function (url) {
                    tempCanvas.style.background = "url(" + url + ")";
                });
            }
            tempCanvas.style.boxShadow = "0 0 3px 1px " + borderColor;
        }

        result.destroy = () => {
            cropper.destroy();
            ruleOThirdsCheckbox.destroy();
        };
        result.getInput = function () {
            result.destroy();
            return {
                left: left,
                right: right,
                top: top,
                bottom: bottom,
                fillColor: selectedRgbaObj.a === 0 ? null : selectedRgbaObj
            };
        };
        return result;
    },

    apply(params: IFilterApply) {
        const canvas = params.canvas;
        const history = params.history;
        if (!canvas || !history || isNaN(params.input.left) || isNaN(params.input.right) || isNaN(params.input.top) || isNaN(params.input.bottom)) {
            return false;
        }
        history.pause(true);
        canvas.resizeCanvas(params.input);
        history.pause(false);
        history.push({
            tool: ["filter", "cropExtend"],
            action: "apply",
            params: [{
                input: JSON.parse(JSON.stringify(params.input))
            }]
        });
        return true;
    }

};