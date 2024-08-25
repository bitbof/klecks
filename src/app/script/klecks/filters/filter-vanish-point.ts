import { BB } from '../../bb/bb';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult, IRGB } from '../kl-types';
import { LANG } from '../../language/language';
import { input } from '../ui/components/input';
import { ColorOptions } from '../ui/components/color-options';
import { drawVanishPoint } from '../image-operations/draw-vanish-point';
import { KlSlider } from '../ui/components/kl-slider';
import { eventResMs } from './filters-consts';
import { TFilterHistoryEntry } from './filters';
import { throwIfNull } from '../../bb/base/base';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { DraggableInput } from '../ui/components/draggable-input';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';

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
    TFilterVanishPointInput
>;

export const filterVanishPoint = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const previewCanvas = BB.canvas(context.canvas.width, context.canvas.height);
        const previewCtx = BB.ctx(previewCanvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterVanishPointInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        const settingsObj: TFilterVanishPointInput = {
            x: context.canvas.width / 2,
            y: context.canvas.height / 2,
            lines: 8,
            thickness: 2,
            color: { r: 0, g: 0, b: 0 },
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
                update();
            },
        });
        linesSlider.getElement().style.marginBottom = '10px';
        rootEl.append(linesSlider.getElement());

        const line1 = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
            },
        });
        const line2 = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px',
                marginBottom: '10px',
            },
        });
        const xInput = input({
            init: settingsObj.x,
            type: 'number',
            css: { width: '75px', marginRight: '20px' },
            callback: function (v) {
                settingsObj.x = parseFloat(v);
                dragInput.setValue({
                    x: settingsObj.x,
                    y: settingsObj.y,
                });
                update();
            },
        });
        const yInput = input({
            init: settingsObj.y,
            type: 'number',
            css: { width: '75px', marginRight: '20px' },
            callback: function (v) {
                settingsObj.y = parseFloat(v);
                dragInput.setValue({
                    x: settingsObj.x,
                    y: settingsObj.y,
                });
                update();
            },
        });
        const thicknessInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: { width: '75px', marginRight: '20px' },
            callback: function (v) {
                settingsObj.thickness = parseFloat(v);
                update();
            },
        });

        let selectedRgbaObj = { r: 0, g: 0, b: 0, a: 1 };
        const colorOptionsArr = [
            { r: 0, g: 0, b: 0, a: 1 },
            { r: 255, g: 255, b: 255, a: 1 },
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
                selectedRgbaObj = rgbaObj!;
                settingsObj.color = BB.copyObj(selectedRgbaObj);
                update();
            },
        });

        const labelStyle = {
            display: 'inline-block',
            marginRight: '5px',
        };
        line1.append(
            BB.el({ content: 'X:', css: labelStyle }),
            xInput,
            BB.el({ content: 'Y:', css: labelStyle }),
            yInput,
        );
        line2.append(
            BB.el({ content: LANG('shape-line-width') + ':', css: labelStyle }),
            thicknessInput,
            BB.el({ css: { flexGrow: '1' } }),
            colorOptions.getElement(),
        );

        // ---- preview input processing ----
        function syncInputs(): void {
            xInput.value = '' + settingsObj.x;
            yInput.value = '' + settingsObj.y;
        }

        function update(): void {
            const ctx = previewCtx;
            const w = previewCanvas.width;
            const h = previewCanvas.height;

            ctx.save();
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(context.canvas, 0, 0, w, h);
            drawVanishPoint(
                ctx,
                settingsObj.x,
                settingsObj.y,
                settingsObj.lines,
                Math.max(settingsObj.thickness, 1),
                settingsObj.color,
                settingsObj.opacity,
            );

            ctx.restore();
            preview.render();
        }

        const onRender = () => {
            dragInput.setTransform(preview.getTransform());
            return previewCanvas;
        };

        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image: i === selectedLayerIndex ? onRender : layers[i].context.canvas,
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                    hasClipping: false,
                });
            }
        }

        const preview = new Preview({
            width: getPreviewWidth(isSmall),
            height: getPreviewHeight(isSmall),
            project: {
                width: context.canvas.width,
                height: context.canvas.height,
                layers: previewLayerArr,
            },
        });
        BB.css(preview.getElement(), {
            marginLeft: '-20px',
            marginRight: '-20px',
            overflow: 'hidden',
        });

        const dragInput = new DraggableInput({
            value: {
                x: settingsObj.x,
                y: settingsObj.y,
            },
            onChange: (val) => {
                settingsObj.x = Math.round(val.x);
                settingsObj.y = Math.round(val.y);
                syncInputs();
                update();
            },
        });

        update();

        preview.getElement().append(dragInput.getElement());
        rootEl.append(preview.getElement());

        result.destroy = () => {
            linesSlider.destroy();
            colorOptions.destroy();
            preview.destroy();
        };
        result.getInput = function (): TFilterVanishPointInput {
            result.destroy!();
            return BB.copyObj(settingsObj);
        };
        return result;
    },

    apply(params: IFilterApply<TFilterVanishPointInput>): boolean {
        const context = params.context;
        const klCanvas = params.klCanvas;
        const history = params.history;
        if (!context || !klCanvas) {
            return false;
        }

        history?.pause(true);
        drawVanishPoint(
            context,
            params.input.x,
            params.input.y,
            params.input.lines,
            params.input.thickness,
            params.input.color,
            params.input.opacity,
        );
        history?.pause(false);

        history?.push({
            tool: ['filter', 'vanishPoint'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterVanishPointHistoryEntry);
        return true;
    },
};
