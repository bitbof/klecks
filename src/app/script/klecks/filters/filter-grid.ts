import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
// @ts-ignore
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer, IMixMode} from '../kl.types';
import {LANG} from '../../language/language';
import {input} from '../ui/base-components/input';
import {ColorOptions} from '../ui/base-components/color-options';
import {drawGrid} from '../image-operations/draw-grid';



export const filterGrid = {

    getDialog(params: IFilterGetDialogParam) {
        let context = params.context;
        let klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        let layers = klCanvas.getLayers();
        let selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);
        const renderW = Math.min(w, context.canvas.width);
        const renderH = Math.min(h, context.canvas.height);
        const renderFactor = renderW / context.canvas.width;

        let div = document.createElement("div");
        let result: any = {
            element: div
        };
        div.innerHTML = LANG('filter-grid-description') + "<br/><br/>";

        const settingsObj = {
            x: 2,
            y: 2,
            thickness: 2,
            color: '#000',
            opacity: 1,
        };

        let line1 = BB.el({
            parent: div,
            css: {
                display: 'flex',
                alignItems: 'center',
            }
        });
        let line2 = BB.el({
            parent: div,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px'
            }
        });
        const xInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: {width: '75px', marginRight: '20px'},
            callback: function(v) {
                settingsObj.x = parseFloat(v);
                updatePreview();
            }
        });
        const yInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: {width: '75px', marginRight: '20px'},
            callback: function(v) {
                settingsObj.y = parseFloat(v);
                updatePreview();
            }
        });
        const thicknessInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: {width: '75px', marginRight: '20px'},
            callback: function(v) {
                settingsObj.thickness = parseFloat(v);
                updatePreview();
            }
        });

        let selectedRgbaObj = {r: 0, g: 0, b: 0, a: 1};
        const colorOptionsArr = [
            {r: 0, g: 0, b: 0, a: 1},
            {r: 255, g: 255, b: 255, a: 1},
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
        settingsObj.color = BB.ColorConverter.toRgbStr(selectedRgbaObj);

        const colorOptions = new ColorOptions({
            label: LANG('shape-stroke'),
            colorArr: colorOptionsArr,
            onChange: function(rgbaObj) {
                selectedRgbaObj = rgbaObj;
                settingsObj.color = BB.ColorConverter.toRgbStr(selectedRgbaObj);
                updatePreview();
            }
        });

        const labelStyle = {
            display: 'inline-block',
            marginRight: '5px',
        };
        line1.append(
            BB.el({content: 'X:', css: labelStyle}),
            xInput,
            BB.el({content: 'Y:', css: labelStyle}),
            yInput,
        );
        line2.append(
            BB.el({content: LANG('brush-size') + ':', css: labelStyle}),
            thicknessInput,
            BB.el({css:{flexGrow: '1'}}),
            colorOptions.getElement(),
        );


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

        let previewLayer: IKlBasicLayer = {
            image: BB.canvas(renderW, renderH),
            opacity: layers[selectedLayerIndex].opacity,
            mixModeStr: layers[selectedLayerIndex].mixModeStr,
        };
        let klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: layers.map((item, i) => {
                if (i === selectedLayerIndex) {
                    return previewLayer;
                } else {
                    return {
                        image: item.context.canvas,
                        opacity: item.opacity,
                        mixModeStr: item.mixModeStr,
                    };
                }
            })
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
            let ctx = (previewLayer.image as HTMLCanvasElement).getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, renderW, renderH);
            ctx.drawImage(context.canvas, 0, 0, renderW, renderH);
            drawGrid(ctx, settingsObj.x, settingsObj.y, Math.max(settingsObj.thickness * renderFactor, 1), settingsObj.color, settingsObj.opacity);

            ctx.restore();
            klCanvasPreview.render();
        }
        setTimeout(updatePreview, 0);


        div.appendChild(previewWrapper);
        result.destroy = () => {
        };
        result.getInput = function () {
            result.destroy();
            return BB.copyObj(settingsObj);
        };
        return result;
    },

    apply(params: IFilterApply) {
        let context = params.context;
        let klCanvas = params.klCanvas;
        let history = params.history;
        if (!context || !klCanvas || !history) {
            return false;
        }

        history.pause(true);
        drawGrid(context, params.input.x, params.input.y, params.input.thickness, params.input.color, params.input.opacity);
        history.pause(false);

        history.push({
            tool: ["filter", "grid"],
            action: "apply",
            params: [{
                input: params.input
            }]
        });
        return true;
    },

};