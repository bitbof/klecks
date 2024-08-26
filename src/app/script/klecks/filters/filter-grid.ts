import { BB } from '../../bb/bb';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { input } from '../ui/components/input';
import { ColorOptions } from '../ui/components/color-options';
import { drawGrid } from '../image-operations/draw-grid';
import { TFilterHistoryEntry } from './filters';
import { throwIfNull } from '../../bb/base/base';
import { Preview } from '../ui/project-viewport/preview';
import { css } from '@emotion/css/dist/emotion-css.cjs';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';

export type TFilterGridInput = {
    x: number;
    y: number;
    thickness: number;
    color: string;
    opacity: number;
};

export type TFilterGridHistoryEntry = TFilterHistoryEntry<'grid', TFilterGridInput>;

export const filterGrid = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterGridInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        const settingsObj: TFilterGridInput = {
            x: 2,
            y: 2,
            thickness: 8,
            color: '#000',
            opacity: 1,
        };

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
            init: 2,
            type: 'number',
            min: 1,
            css: { width: '75px', marginRight: '20px' },
            callback: function (v) {
                settingsObj.x = parseFloat(v);
                updatePreview();
            },
        });
        const yInput = input({
            init: 2,
            type: 'number',
            min: 1,
            css: { width: '75px', marginRight: '20px' },
            callback: function (v) {
                settingsObj.y = parseFloat(v);
                updatePreview();
            },
        });
        const thicknessInput = input({
            init: settingsObj.thickness,
            type: 'number',
            min: 1,
            css: { width: '75px', marginRight: '20px' },
            callback: function (v) {
                settingsObj.thickness = parseFloat(v);
                updatePreview();
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

        const previewCanvas = BB.canvas(context.canvas.width, context.canvas.height);
        const previewCtx = BB.ctx(previewCanvas);
        const previewLayerArr = layers.map((item, i) => {
            return {
                image: i === selectedLayerIndex ? previewCanvas : item.context.canvas,
                isVisible: item.isVisible,
                opacity: item.opacity,
                mixModeStr: item.mixModeStr,
                hasClipping: false,
            };
        });

        const preview = new Preview({
            width: getPreviewWidth(isSmall),
            height: getPreviewHeight(isSmall),
            project: {
                width: context.canvas.width,
                height: context.canvas.height,
                layers: previewLayerArr,
            },
        });

        preview.getElement().classList.add(
            css({
                marginLeft: '-20px',
                marginRight: '-20px',
            }),
        );
        rootEl.append(preview.getElement());

        function updatePreview(): void {
            const ctx = previewCtx;
            ctx.save();
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.drawImage(context.canvas, 0, 0);
            drawGrid(
                ctx,
                settingsObj.x,
                settingsObj.y,
                Math.max(settingsObj.thickness, 1),
                settingsObj.color,
                settingsObj.opacity,
            );
            ctx.restore();
            preview.render();
        }
        updatePreview();
        preview.render();

        result.destroy = (): void => {
            preview.destroy();
            BB.freeCanvas(previewCanvas);
            colorOptions.destroy();
        };
        result.getInput = function (): TFilterGridInput {
            result.destroy!();
            return BB.copyObj(settingsObj);
        };
        return result;
    },

    apply(params: IFilterApply<TFilterGridInput>): boolean {
        const context = params.context;
        const klCanvas = params.klCanvas;
        const history = params.history;
        if (!context || !klCanvas) {
            return false;
        }

        history?.pause(true);
        drawGrid(
            context,
            params.input.x,
            params.input.y,
            params.input.thickness,
            params.input.color,
            params.input.opacity,
        );
        history?.pause(false);

        history?.push({
            tool: ['filter', 'grid'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterGridHistoryEntry);
        return true;
    },
};
