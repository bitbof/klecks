import { BB } from '../../bb/bb';
import { Checkbox } from '../ui/components/checkbox';
import { Select } from '../ui/components/select';
import constrainImg from '/src/app/img/ui/constrain.svg';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { TFilterHistoryEntry } from './filters';
import { table } from '../ui/components/table';
import { theme } from '../../theme/theme';
import { smallPreview } from '../ui/utils/preview-size';

export type TFilterResizeInput = {
    width: number;
    height: number;
    algorithm: 'smooth' | 'pixelated';
};

export type TFilterResizeHistoryEntry = TFilterHistoryEntry<'resize', TFilterResizeInput>;

export const filterResize = {
    getDialog(params: IFilterGetDialogParam) {
        //BB.centerWithin
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
        let newWidth = klCanvas.getWidth(),
            newHeight = klCanvas.getHeight();

        const maxWidth = params.maxWidth,
            maxHeight = params.maxHeight;

        const widthWrapper = BB.el({
            css: {
                width: '150px',
                height: '35px',
                lineHeight: '30px',
            },
        });
        const heightWrapper = BB.el({
            css: {
                width: '150px',
                height: '35px',
                lineHeight: '30px',
            },
        });
        const widthInput = BB.el({
            tagName: 'input',
            css: {
                cssFloat: 'right',
                width: '90px',
            },
            custom: {
                type: 'number',
                min: '1',
                max: '' + maxWidth,
                value: '' + klCanvas.getWidth(),
            },
        });
        const heightInput = BB.el({
            tagName: 'input',
            css: {
                cssFloat: 'right',
                width: '90px',
            },
            custom: {
                type: 'number',
                min: '1',
                max: '' + maxHeight,
                value: '' + klCanvas.getHeight(),
            },
        });
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
        widthWrapper.append(LANG('width') + ': ', widthInput);
        heightWrapper.append(LANG('height') + ': ', heightInput);
        const inputWrapper = BB.el({
            css: {
                background: 'url(' + constrainImg + ') no-repeat 140px 5px',
                backgroundSize: '50px 52px',
            },
        });
        inputWrapper.append(widthWrapper, heightWrapper);
        const constrainIm = new Image();
        constrainIm.src = constrainImg;
        constrainIm.height = 40;

        const sizeTable = table(
            [
                [LANG('width') + ':&nbsp;', widthInput, constrainIm],
                [BB.el({ css: { height: '5px' } }), '', ''],
                [LANG('height') + ':&nbsp;', heightInput],
            ],
            {
                '0.2': { rowspan: 3 },
            },
        );
        BB.css(sizeTable, {
            marginBottom: '10px',
        });

        rootEl.append(sizeTable);

        //contrain checkbox
        let heightChanged = false,
            widthChanged = false;
        const ratio = klCanvas.getWidth() / klCanvas.getHeight();

        function updateConstrain(): void {
            constrainIm.style.display = isConstrained ? '' : 'none';
            if (isConstrained) {
                widthInput.value = '' + klCanvas.getWidth();
                heightInput.value = '' + klCanvas.getHeight();
                update();
            }
        }

        let isConstrained = true;
        const constrainCheckbox = new Checkbox({
            init: true,
            label: LANG('constrain-proportions'),
            allowTab: true,
            callback: function (b) {
                isConstrained = b;
                updateConstrain();
            },
        });
        rootEl.append(
            BB.el({
                css: {
                    clear: 'both',
                },
            }),
        );

        const algorithmSelect = new Select({
            isFocusable: true,
            optionArr: [
                ['smooth', LANG('algorithm-smooth')],
                ['pixelated', LANG('algorithm-pixelated')],
            ],
            title: LANG('scaling-algorithm'),
            initValue: 'smooth',
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
        secondRowElement.append(constrainCheckbox.getElement(), algorithmSelect.getElement());

        const previewCanvas = BB.canvas(w, h);
        previewCanvas.style.imageRendering = 'pixelated';

        const previewCtx = BB.ctx(previewCanvas);

        function draw(): void {
            if (algorithmSelect.getValue() === 'smooth') {
                previewCanvas.style.imageRendering = previewFactor > 1 ? 'pixelated' : '';

                previewCanvas.width = klCanvas.getWidth();
                previewCanvas.height = klCanvas.getHeight();

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

        function update(): void {
            if (
                (widthInput.value.length === 0 && widthChanged) ||
                (heightInput.value.length === 0 && heightChanged)
            ) {
                heightChanged = false;
                widthChanged = false;
                return;
            }
            widthInput.value = '' + Math.max(1, parseInt(widthInput.value));
            heightInput.value = '' + Math.max(1, parseInt(heightInput.value));
            if (isConstrained) {
                if (heightChanged) {
                    widthInput.value = '' + parseInt('' + parseInt(heightInput.value) * ratio);
                }
                if (widthChanged) {
                    heightInput.value = '' + parseInt('' + parseInt(widthInput.value) / ratio);
                }

                if (
                    parseInt(widthInput.value) > maxWidth ||
                    parseInt(heightInput.value) > maxHeight
                ) {
                    const fit = BB.fitInto(
                        parseInt(widthInput.value),
                        parseInt(heightInput.value),
                        maxWidth,
                        maxHeight,
                        1,
                    );
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

            const preview = BB.fitInto(newWidth, newHeight, 280, 200, 1);
            const previewW = parseInt('' + preview.width),
                previewH = parseInt('' + preview.height);
            previewFactor = previewW / newWidth;

            const offset = BB.centerWithin(
                smallPreview.width,
                smallPreview.height,
                previewW,
                previewH,
            );

            draw();

            previewCanvas.style.width = Math.max(1, previewW) + 'px';
            previewCanvas.style.height = Math.max(1, previewH) + 'px';
            canvasWrapper.style.left = offset.x + 'px';
            canvasWrapper.style.top = offset.y + 'px';
            canvasWrapper.style.width = Math.max(1, previewW) + 'px';
            canvasWrapper.style.height = Math.max(1, previewH) + 'px';
        }

        const previewWrapper = BB.el({
            className: 'kl-transparent-preview',
            css: {
                width: smallPreview.width + 'px',
                height: smallPreview.height + 'px',
                marginLeft: '-20px',
                display: 'table',
                marginTop: '10px',
                position: 'relative',
                userSelect: 'none',
            },
        });

        const canvasWrapper = BB.el({
            parent: previewWrapper,
            content: previewCanvas,
            className: 'kl-transparent-preview__canvas',
            css: {
                width: w + 'px',
                height: h + 'px',
                position: 'absolute',
                overflow: 'hidden',
            },
        });

        function updateCheckerboard(): void {
            BB.createCheckerDataUrl(
                8,
                function (url) {
                    previewWrapper.style.background = 'url(' + url + ')';
                },
                theme.isDark(),
            );
        }
        theme.addIsDarkListener(updateCheckerboard);
        updateCheckerboard();

        rootEl.append(previewWrapper);
        update();

        result.destroy = (): void => {
            constrainCheckbox.destroy();
            theme.removeIsDarkListener(updateCheckerboard);
        };
        result.getInput = function (): TFilterResizeInput {
            result.destroy!();
            return {
                width: newWidth,
                height: newHeight,
                algorithm: algorithmSelect.getValue(),
            };
        };
        return result;
    },

    apply(params: IFilterApply<TFilterResizeInput>): boolean {
        const klCanvas = params.klCanvas;
        const history = params.history;
        const width = params.input.width;
        const height = params.input.height;
        const algorithm = params.input.algorithm;
        if (!klCanvas) {
            return false;
        }
        history?.pause(true);
        klCanvas.resize(width, height, algorithm);
        history?.pause(false);
        history?.push({
            tool: ['filter', 'resize'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterResizeHistoryEntry);
        return true;
    },
};
