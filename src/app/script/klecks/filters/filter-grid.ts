import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {input} from '../ui/components/input';
import {ColorOptions} from '../ui/components/color-options';
import {drawGrid} from '../image-operations/draw-grid';
import {TFilterHistoryEntry} from './filters';
import {throwIfNull} from '../../bb/base/base';

export type TFilterGridInput = {
    x: number;
    y: number;
    thickness: number;
    color: string;
    opacity: number;
};

export type TFilterGridHistoryEntry = TFilterHistoryEntry<
    'grid',
    TFilterGridInput>;

export const filterGrid = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        const w = parseInt('' + fit.width), h = parseInt('' + fit.height);
        const renderW = Math.min(w, context.canvas.width);
        const renderH = Math.min(h, context.canvas.height);
        const renderFactor = renderW / context.canvas.width;

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterGridInput> = {
            element: div,
        };

        const settingsObj: TFilterGridInput = {
            x: 2,
            y: 2,
            thickness: 2,
            color: '#000',
            opacity: 1,
        };

        const line1 = BB.el({
            parent: div,
            css: {
                display: 'flex',
                alignItems: 'center',
            },
        });
        const line2 = BB.el({
            parent: div,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px',
            },
        });
        const xInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: {width: '75px', marginRight: '20px'},
            callback: function (v) {
                settingsObj.x = parseFloat(v);
                updatePreview();
            },
        });
        const yInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: {width: '75px', marginRight: '20px'},
            callback: function (v) {
                settingsObj.y = parseFloat(v);
                updatePreview();
            },
        });
        const thicknessInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: {width: '75px', marginRight: '20px'},
            callback: function (v) {
                settingsObj.thickness = parseFloat(v);
                updatePreview();
            },
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
            onChange: function (rgbaObj) {
                selectedRgbaObj = rgbaObj!;
                settingsObj.color = BB.ColorConverter.toRgbStr(selectedRgbaObj);
                updatePreview();
            },
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
            BB.el({content: LANG('shape-line-width') + ':', css: labelStyle}),
            thicknessInput,
            BB.el({css:{flexGrow: '1'}}),
            colorOptions.getElement(),
        );


        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: '340px',
                height: '220px',
            },
        });

        const previewLayer: IKlBasicLayer = {
            image: BB.canvas(renderW, renderH),
            isVisible: layers[selectedLayerIndex].isVisible,
            opacity: layers[selectedLayerIndex].opacity,
            mixModeStr: layers[selectedLayerIndex].mixModeStr,
        };
        const klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: layers.map((item, i) => {
                if (i === selectedLayerIndex) {
                    return previewLayer;
                } else {
                    return {
                        image: item.context.canvas,
                        isVisible: item.isVisible,
                        opacity: item.opacity,
                        mixModeStr: item.mixModeStr,
                    };
                }
            }),
        });

        const previewInnerWrapper = BB.el({
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: parseInt('' + w) + 'px',
                height: parseInt('' + h) + 'px',
            },
        });
        previewInnerWrapper.append(klCanvasPreview.getElement());
        previewWrapper.append(previewInnerWrapper);

        function updatePreview (): void {
            const ctx = BB.ctx((previewLayer.image as HTMLCanvasElement));
            ctx.save();
            ctx.clearRect(0, 0, renderW, renderH);
            ctx.drawImage(context.canvas, 0, 0, renderW, renderH);
            drawGrid(ctx, settingsObj.x, settingsObj.y, Math.max(settingsObj.thickness * renderFactor, 1), settingsObj.color, settingsObj.opacity);

            ctx.restore();
            klCanvasPreview.render();
        }
        setTimeout(updatePreview, 0);


        div.append(previewWrapper);
        result.destroy = (): void => {
            klCanvasPreview.destroy();
            colorOptions.destroy();
        };
        result.getInput = function (): TFilterGridInput {
            result.destroy!();
            return BB.copyObj(settingsObj);
        };
        return result;
    },

    apply (params: IFilterApply<TFilterGridInput>): boolean {
        const context = params.context;
        const klCanvas = params.klCanvas;
        const history = params.history;
        if (!context || !klCanvas || !history) {
            return false;
        }

        history.pause(true);
        drawGrid(
            context,
            params.input.x,
            params.input.y,
            params.input.thickness,
            params.input.color,
            params.input.opacity,
        );
        history.pause(false);

        history.push({
            tool: ['filter', 'grid'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterGridHistoryEntry);
        return true;
    },

};