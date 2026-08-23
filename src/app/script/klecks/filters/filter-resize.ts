import { getIconUrl } from '../../icon/icon';
import { BB } from '../../bb/bb';
import { Checkbox } from '../ui/components/checkbox';
import { InterpolationAlgorithmToggle } from '../ui/components/interpolation-algorithm-toggle';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { table } from '../ui/components/table';
import { SMALL_PREVIEW } from '../ui/utils/preview-size';
import { css } from '../../bb/base/base';
import { Input } from '../ui/components/input';

const constrainImg = getIconUrl('constrain');
export type TFilterResizeInput = {
    width: number;
    height: number;
    algorithm: 'smooth' | 'pixelated';
};

export const filterResize = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        if (!klCanvas) {
            return false;
        }

        const fit = BB.fitInto(klCanvas.getWidth(), klCanvas.getHeight(), 280, 200, 1);
        const w = parseInt('' + fit.width),
            h = parseInt('' + fit.height);

        let previewFactor = w / klCanvas.getWidth();
        const tempCanvas = klCanvas.getCompleteCanvas(1);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterResizeInput> = {
            element: rootEl,
        };
        const maxWidth = params.maxWidth,
            maxHeight = params.maxHeight;
        let isConstrained = true;
        const ratio = klCanvas.getWidth() / klCanvas.getHeight();

        const widthInput = new Input({
            type: 'number',
            init: klCanvas.getWidth(),
            name: 'resize-width',
            step: 1,
            css: { width: 90 },
            onChange: (value) => {
                if (isConstrained) {
                    heightInput.setValue(Math.max(1, Math.floor(value / ratio)));
                }
                update();
            },
        });
        const heightInput = new Input({
            type: 'number',
            init: klCanvas.getHeight(),
            name: 'resize-height',
            step: 1,
            css: { width: 90 },
            onChange: (value) => {
                if (isConstrained) {
                    widthInput.setValue(Math.max(1, Math.floor(value * ratio)));
                }
                update();
            },
        });
        function updateRanges(): void {
            if (isConstrained) {
                widthInput.setRange(
                    Math.max(1, Math.ceil(ratio)),
                    Math.max(1, Math.min(maxWidth, Math.floor(maxHeight * ratio))),
                );
                heightInput.setRange(
                    Math.max(1, Math.ceil(1 / ratio)),
                    Math.max(1, Math.min(maxHeight, Math.floor(maxWidth / ratio))),
                );
                return;
            }
            widthInput.setRange(1, maxWidth);
            heightInput.setRange(1, maxHeight);
        }
        updateRanges();

        function scale(factor: number): void {
            widthInput.setValue(widthInput.getValue() * factor, true);
            if (!isConstrained) {
                heightInput.setValue(heightInput.getValue() * factor, true);
            }
        }

        const buttonRow = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
            },
        });
        BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: '2&times;',
            onClick: () => {
                scale(2);
            },
        });
        BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: '&frac12;&times;',
            onClick: () => {
                scale(0.5);
            },
        });

        const constrainIm = new Image();
        constrainIm.src = constrainImg;
        constrainIm.height = 40;

        const sizeTable = table(
            [
                [LANG('width') + ':&nbsp;', widthInput.getElement(), constrainIm],
                [BB.el({ css: { height: 5 } }), '', ''],
                [LANG('height') + ':&nbsp;', heightInput.getElement()],
            ],
            {
                '0.2': { rowspan: 3 },
            },
        );
        css(sizeTable, {
            marginBottom: 10,
        });
        rootEl.append(sizeTable);

        const constrainCheckbox = new Checkbox({
            init: true,
            label: LANG('constrain-proportions'),
            allowTab: true,
            callback: function (newIsConstrained) {
                isConstrained = newIsConstrained;
                constrainIm.style.display = isConstrained ? '' : 'none';
                if (isConstrained) {
                    widthInput.setValue(klCanvas.getWidth());
                    heightInput.setValue(klCanvas.getHeight());
                    update();
                }
                updateRanges();
            },
            name: 'constrain-proportions',
        });
        rootEl.append(
            BB.el({
                css: {
                    clear: 'both',
                },
            }),
        );

        const algorithmToggle = new InterpolationAlgorithmToggle({
            initValue: 'smooth',
            isFocusable: true,
            onChange: (): void => {
                update();
            },
        });

        const secondRowElement = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            },
        });
        secondRowElement.append(constrainCheckbox.getElement(), algorithmToggle.getElement());

        const previewCanvas = BB.canvas(w, h);
        previewCanvas.style.imageRendering = 'pixelated';

        const previewCtx = BB.ctx(previewCanvas);

        function update(): void {
            const width = widthInput.getValue();
            const height = heightInput.getValue();

            const preview = BB.fitInto(width, height, 280, 200, 1);
            const previewW = Math.max(1, Math.round(preview.width)),
                previewH = Math.max(1, Math.round(preview.height));
            previewFactor = previewW / width;

            previewCtx.save();
            if (algorithmToggle.getValue() === 'smooth') {
                previewCanvas.style.imageRendering = previewFactor > 1 ? 'pixelated' : '';
                previewCanvas.width = klCanvas.getWidth();
                previewCanvas.height = klCanvas.getHeight();
                previewCtx.imageSmoothingQuality = 'high';
                previewCtx.drawImage(tempCanvas, 0, 0);
                BB.resizeCanvas(previewCanvas, width, height);
            } else {
                previewCanvas.style.imageRendering = 'pixelated';
                previewCanvas.width = width;
                previewCanvas.height = height;
                previewCtx.imageSmoothingEnabled = false;
                previewCtx.drawImage(tempCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
            }
            previewCtx.restore();
            css(previewCanvas, {
                width: previewW,
                height: previewH,
            });

            const offset = BB.centerWithin(
                SMALL_PREVIEW.width,
                SMALL_PREVIEW.height,
                previewW,
                previewH,
            );
            css(canvasWrapper, {
                left: offset.x,
                top: offset.y,
                width: previewW,
                height: previewH,
            });
        }

        const previewWrapper = BB.el({
            className: 'kl-transparent-preview',
            css: {
                width: SMALL_PREVIEW.width,
                height: SMALL_PREVIEW.height,
                marginLeft: -20,
                display: 'table',
                marginTop: 10,
                position: 'relative',
                userSelect: 'none',
                background: 'var(--kl-checkerboard-background)',
                backgroundSize: 16,
            },
        });

        const canvasWrapper = BB.el({
            parent: previewWrapper,
            content: previewCanvas,
            className: 'kl-transparent-preview__canvas',
            css: {
                width: w,
                height: h,
                position: 'absolute',
                overflow: 'hidden',
            },
        });

        rootEl.append(previewWrapper);
        update();

        result.destroy = (): void => {
            widthInput.destroy();
            heightInput.destroy();
            constrainCheckbox.destroy();
            algorithmToggle.destroy();
        };
        result.getInput = function (): TFilterResizeInput {
            const algorithm = algorithmToggle.getValue();
            const width = widthInput.getValue();
            const height = heightInput.getValue();
            result.destroy!();
            return {
                width,
                height,
                algorithm,
            };
        };
        return result;
    },

    apply(params: TFilterApply<TFilterResizeInput>): boolean {
        const klCanvas = params.klCanvas;
        const width = params.input.width;
        const height = params.input.height;
        const algorithm = params.input.algorithm;
        if (!klCanvas) {
            return false;
        }
        klCanvas.resize(width, height, algorithm);
        return true;
    },
};
