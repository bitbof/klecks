import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer, IRGB} from '../kl-types';
import {LANG} from '../../language/language';
import {input} from '../ui/components/input';
import {ColorOptions} from '../ui/components/color-options';
import {drawVanishPoint} from '../image-operations/draw-vanish-point';
import {KlSlider} from '../ui/components/kl-slider';
import {eventResMs} from './filters-consts';
import {IVector2D} from '../../bb/bb-types';
import {TFilterHistoryEntry} from './filters';

export type TFilterVanishPointInput = {
    x: number;
    y: number;
    lines: number;
    thickness: number;
    color: IRGB;
    opacity: number;
};

export type TFilterVanishPointHistoryEntry = TFilterHistoryEntry<
    'vanishPoint',
    TFilterVanishPointInput>;

export const filterVanishPoint = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        const w = parseInt('' + fit.width), h = parseInt('' + fit.height);
        const renderW = Math.min(w, context.canvas.width);
        const renderH = Math.min(h, context.canvas.height);
        const renderFactor = renderW / context.canvas.width;
        const previewFactor = w / context.canvas.width;

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterVanishPointInput> = {
            element: div,
        };
        div.innerHTML = LANG('filter-vanish-point-description') + '<br/><br/>';

        const settingsObj: TFilterVanishPointInput = {
            x: context.canvas.width / 2,
            y: context.canvas.height / 2,
            lines: 8,
            thickness: 2,
            color: {r: 0, g: 0, b: 0},
            opacity: 1,
        };

        const linesSlider = new KlSlider({
            label: LANG('filter-vanish-point-lines'),
            width: 300,
            height: 30,
            min: 2,
            max: 20,
            value: settingsObj.lines,
            curve: 'quadratic',
            eventResMs: eventResMs,
            onChange: function (val) {
                settingsObj.lines = Math.round(val);
                updatePreview();
            },
        });
        linesSlider.getElement().style.marginBottom = '10px';
        div.append(linesSlider.getElement());

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
            init: settingsObj.x,
            type: 'number',
            css: {width: '75px', marginRight: '20px'},
            callback: function (v) {
                settingsObj.x = parseFloat(v);
                updatePreview();
            },
        });
        const yInput = input({
            init: settingsObj.y,
            type: 'number',
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
        settingsObj.color = BB.copyObj(selectedRgbaObj);

        const colorOptions = new ColorOptions({
            label: LANG('shape-stroke'),
            colorArr: colorOptionsArr,
            onChange: function (rgbaObj) {
                selectedRgbaObj = rgbaObj;
                settingsObj.color = BB.copyObj(selectedRgbaObj);
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
                cursor: 'move',
            },
        });
        previewInnerWrapper.append(klCanvasPreview.getElement());
        previewWrapper.append(previewInnerWrapper);



        // ---- preview input processing ----
        const inputs: {
            start: IVector2D;
            end: IVector2D;
            state: null | 'move';
            oldSettings: any;
        } = {
            start: null,
            end: null,
            state: null,
            oldSettings: null,
        };
        function syncInputs (): void {
            xInput.value = '' + settingsObj.x;
            yInput.value = '' + settingsObj.y;
        }
        previewWrapper.oncontextmenu = function () {
            return false;
        };
        previewInnerWrapper.style.touchAction = 'none';
        const pointerListener = new BB.PointerListener({
            target: previewInnerWrapper,
            onPointer: (event) => {
                if (event.type === 'pointerdown') {
                    if (!inputs.state) {
                        inputs.state = 'move';
                        inputs.oldSettings = BB.copyObj(settingsObj);
                        inputs.start = {x: event.relX / previewFactor, y: event.relY / previewFactor};
                        inputs.end = null;
                    }
                } else if (event.type === 'pointermove') {
                    if (inputs.state) {
                        inputs.end = {x: event.relX / previewFactor, y: event.relY / previewFactor};

                        settingsObj.x = Math.round(inputs.end.x - inputs.start.x + inputs.oldSettings.x);
                        settingsObj.y = Math.round(inputs.end.y - inputs.start.y + inputs.oldSettings.y);

                        syncInputs();
                        updatePreview();
                    }
                } else if (event.type === 'pointerup') {
                    if (inputs.state) {
                        inputs.state = null;
                    }
                }
            },
        });



        function updatePreview (): void {
            const ctx = BB.ctx((previewLayer.image as HTMLCanvasElement));
            ctx.save();
            ctx.clearRect(0, 0, renderW, renderH);
            ctx.drawImage(context.canvas, 0, 0, renderW, renderH);
            drawVanishPoint(
                ctx,
                settingsObj.x * renderFactor,
                settingsObj.y * renderFactor,
                settingsObj.lines,
                Math.max(settingsObj.thickness * renderFactor, 1),
                settingsObj.color,
                settingsObj.opacity,
            );

            ctx.restore();
            klCanvasPreview.render();
        }
        setTimeout(updatePreview, 0);


        div.append(previewWrapper);
        result.destroy = () => {
            linesSlider.destroy();
            pointerListener.destroy();
            klCanvasPreview.destroy();
            colorOptions.destroy();
        };
        result.getInput = function (): TFilterVanishPointInput {
            result.destroy();
            return BB.copyObj(settingsObj);
        };
        return result;
    },

    apply (params: IFilterApply<TFilterVanishPointInput>): boolean {
        const context = params.context;
        const klCanvas = params.klCanvas;
        const history = params.history;
        if (!context || !klCanvas || !history) {
            return false;
        }

        history.pause(true);
        drawVanishPoint(
            context,
            params.input.x,
            params.input.y,
            params.input.lines,
            params.input.thickness,
            params.input.color,
            params.input.opacity,
        );
        history.pause(false);

        history.push({
            tool: ['filter', 'vanishPoint'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterVanishPointHistoryEntry);
        return true;
    },

};