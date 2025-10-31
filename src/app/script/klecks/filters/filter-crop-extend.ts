import { BB } from '../../bb/bb';
import { input } from '../ui/components/input';
import { Checkbox } from '../ui/components/checkbox';
import { ColorOptions } from '../ui/components/color-options';
import { Cropper } from '../ui/components/cropper';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult, TRgba } from '../kl-types';
import { LANG } from '../../language/language';
import { TRect } from '../../bb/bb-types';
import { SMALL_PREVIEW } from '../ui/utils/preview-size';
import { intBoundsWithinArea } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';

export type TFilterCropExtendInput = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    fillColor?: TRgba;
};

export const filterCropExtend = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        if (!klCanvas) {
            return false;
        }
        const tempCanvas = BB.canvas();
        {
            const fit = BB.fitInto(klCanvas.getWidth(), klCanvas.getHeight(), 560, 400, 1);
            const w = parseInt('' + fit.width),
                h = parseInt('' + fit.height);
            const previewFactor = w / klCanvas.getWidth();
            tempCanvas.width = w;
            tempCanvas.height = h;
            tempCanvas.style.display = 'block';
            BB.ctx(tempCanvas).drawImage(klCanvas.getCompleteCanvas(previewFactor), 0, 0, w, h);
        }

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterCropExtendInput> = {
            element: rootEl,
        };
        let left = 0,
            right = 0,
            top = 0,
            bottom = 0;
        let leftChanged = false,
            rightChanged = false,
            topChanged = false,
            bottomChanged = false;
        const maxWidth = params.maxWidth,
            maxHeight = params.maxHeight;
        let scale: number = 1;

        const selection = klCanvas.getSelection();
        let selectionBounds = selection
            ? intBoundsWithinArea(
                  getMultiPolyBounds(selection),
                  klCanvas.getWidth(),
                  klCanvas.getHeight(),
              )
            : undefined;
        if (selectionBounds) {
            const boundsWidth = selectionBounds.x2 - selectionBounds.x1;
            const boundsHeight = selectionBounds.y2 - selectionBounds.y1;
            if (boundsWidth <= maxWidth && boundsHeight <= maxHeight) {
                top = selectionBounds.y1;
                right = selectionBounds.x2 - klCanvas.getWidth();
                bottom = selectionBounds.y2 - klCanvas.getHeight();
                left = selectionBounds.x1;
            } else {
                selectionBounds = undefined;
            }
        }

        // --- input elements ---
        const leftInput = input({
            init: left,
            type: 'number',
            min: -klCanvas.getWidth(),
            max: maxWidth,
            css: { width: '75px' },
            callback: function () {
                leftChanged = true;
                updateInput();
            },
        });
        const rightInput = input({
            init: right,
            type: 'number',
            min: -klCanvas.getWidth(),
            max: maxWidth,
            css: { width: '75px' },
            callback: function () {
                rightChanged = true;
                updateInput();
            },
        });
        const topInput = input({
            init: top,
            type: 'number',
            min: -klCanvas.getHeight(),
            max: maxHeight,
            css: { width: '75px' },
            callback: function () {
                topChanged = true;
                updateInput();
            },
        });
        const bottomInput = input({
            init: bottom,
            type: 'number',
            min: -klCanvas.getHeight(),
            max: maxHeight,
            css: { width: '75px' },
            callback: function () {
                bottomChanged = true;
                updateInput();
            },
        });

        const sharedCss = {
            display: 'flex',
            flexDirection: 'column',
            width: 'calc(50% - 5px)',
            gap: '3px',
        };
        const leftWrapper = BB.el({
            content: [LANG('filter-crop-left') + ':', leftInput],
            css: sharedCss,
        });
        const rightWrapper = BB.el({
            content: [LANG('filter-crop-right') + ':', rightInput],
            css: sharedCss,
        });
        const topWrapper = BB.el({
            content: [LANG('filter-crop-top') + ':', topInput],
            css: sharedCss,
        });
        const bottomWrapper = BB.el({
            content: [LANG('filter-crop-bottom') + ':', bottomInput],
            css: sharedCss,
        });
        const wrapWrapper = BB.el({
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
            },
        });
        wrapWrapper.append(leftWrapper, rightWrapper, topWrapper, bottomWrapper);
        rootEl.append(wrapWrapper);

        function updateInput(): void {
            left = parseInt(leftInput.value);
            right = parseInt(rightInput.value);
            top = parseInt(topInput.value);
            bottom = parseInt(bottomInput.value);
            let newWidth = klCanvas.getWidth() + left + right;
            let newHeight = klCanvas.getHeight() + top + bottom;

            if (newWidth <= 0) {
                if (leftChanged) {
                    left = -klCanvas.getWidth() - right + 1;
                    leftInput.value = '' + left;
                }
                if (rightChanged) {
                    right = -klCanvas.getWidth() - left + 1;
                    rightInput.value = '' + right;
                }
                newWidth = 1;
            }
            if (newWidth > maxWidth) {
                if (leftChanged) {
                    left = -klCanvas.getWidth() - right + maxWidth;
                    leftInput.value = '' + left;
                }
                if (rightChanged) {
                    right = -klCanvas.getWidth() - left + maxWidth;
                    rightInput.value = '' + right;
                }
                newWidth = maxWidth;
            }
            if (newHeight <= 0) {
                if (topChanged) {
                    top = -klCanvas.getHeight() - bottom + 1;
                    topInput.value = '' + top;
                }
                if (bottomChanged) {
                    bottom = -klCanvas.getHeight() - top + 1;
                    bottomInput.value = '' + bottom;
                }
                newHeight = 1;
            }
            if (newHeight > maxHeight) {
                if (topChanged) {
                    top = -klCanvas.getHeight() - bottom + maxHeight;
                    topInput.value = '' + top;
                }
                if (bottomChanged) {
                    bottom = -klCanvas.getHeight() - top + maxHeight;
                    bottomInput.value = '' + bottom;
                }
                newHeight = maxHeight;
            }
            cropper.setTransform({
                x: -left,
                y: -top,
                width: newWidth,
                height: newHeight,
            });

            leftChanged = false;
            rightChanged = false;
            topChanged = false;
            bottomChanged = false;
        }

        let useRuleOfThirds = true;
        const ruleOThirdsCheckbox = new Checkbox({
            init: true,
            label: LANG('filter-crop-rule-thirds'),
            allowTab: true,
            callback: function (b) {
                useRuleOfThirds = b;
                cropper.showThirds(useRuleOfThirds);
            },
            name: 'rule-of-thirds',
        });
        rootEl.append(
            BB.el({
                css: {
                    clear: 'both',
                },
            }),
        );

        let selectedRgbaObj = { r: 0, g: 0, b: 0, a: 0 };
        const colorOptionsArr = [
            { r: 0, g: 0, b: 0, a: 0 },
            { r: 255, g: 255, b: 255, a: 1 },
            { r: 0, g: 0, b: 0, a: 1 },
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
            onChange: function (rgbaObj) {
                selectedRgbaObj = rgbaObj!;
                updateBg();
            },
        });

        const flexRow = BB.el({
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '10px',
            },
        });
        rootEl.append(flexRow);
        flexRow.append(ruleOThirdsCheckbox.getElement(), colorOptions.getElement());

        // when input field changed, or dragging in preview finished
        // adjusts the zoom
        function update(transform: TRect): void {
            const fit = BB.fitInto(transform.width, transform.height, 260, 180, 1);
            scale = fit.width / transform.width;

            const offset = BB.centerWithin(
                SMALL_PREVIEW.width,
                previewHeight,
                fit.width,
                fit.height,
            );

            tempCanvas.style.width = klCanvas.getWidth() * scale + 'px';
            tempCanvas.style.height = klCanvas.getHeight() * scale + 'px';

            offsetWrapper.style.left = offset.x - transform.x * scale + 'px';
            offsetWrapper.style.top = offset.y - transform.y * scale + 'px';

            left = parseInt('' + -transform.x);
            top = parseInt('' + -transform.y);
            right = parseInt('' + (transform.x + transform.width - klCanvas.getWidth()));
            bottom = parseInt('' + (transform.y + transform.height - klCanvas.getHeight()));
            leftInput.value = '' + left;
            topInput.value = '' + top;
            rightInput.value = '' + right;
            bottomInput.value = '' + bottom;

            if (selectedRgbaObj.a !== 0) {
                tempCanvas.style.background = 'var(--kl-checkerboard-background)';
                tempCanvas.style.backgroundSize = 100 * scale + 'px';
            }
            previewWrapper.style.backgroundPosition = offset.x + 'px ' + offset.y + 'px';
            previewWrapper.style.backgroundSize = 100 * scale + 'px';

            cropper.setScale(scale);
        }

        const previewHeight = SMALL_PREVIEW.height - 2; // two less because of border
        const previewWrapper = BB.el({
            className: 'kl-edit-crop-preview',
            css: {
                width: SMALL_PREVIEW.width + 'px',
                marginTop: '10px',
                marginLeft: '-20px',
                height: previewHeight + 'px',
                backgroundColor: '#9e9e9e',
                position: 'relative',
                borderTop: '1px solid rgb(144,144,144)',
                borderBottom: '1px solid rgb(144,144,144)',
                overflow: 'hidden',
                userSelect: 'none',
                touchAction: 'none',
                background: 'var(--kl-checkerboard-background)',
            },
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
                right: '0',
            },
        });
        previewWrapper.append(bgColorOverlay);

        const offsetWrapper = BB.el({
            parent: previewWrapper,
            css: {
                position: 'absolute',
                left: '0',
                top: '0',
            },
        });

        BB.el({
            parent: offsetWrapper,
            content: tempCanvas,
            css: {
                boxShadow: '0 0 0px 1px rgb(130,130,130)',
                position: 'absolute',
                left: '0px',
                top: '0px',
            },
        });

        rootEl.append(previewWrapper);
        const cropper = new Cropper({
            x: 0,
            y: 0,
            width: klCanvas.getWidth(),
            height: klCanvas.getHeight(),
            scale: scale,
            callback: update,
            maxW: maxWidth,
            maxH: maxHeight,
            init: selectionBounds,
        });
        update(cropper.getTransform());
        offsetWrapper.append(cropper.getElement());

        function updateBg(): void {
            if (selectedRgbaObj.a === 0) {
                bgColorOverlay.style.background = '';
                tempCanvas.style.background = '';
            } else {
                bgColorOverlay.style.background = BB.ColorConverter.toRgbStr(selectedRgbaObj);
                tempCanvas.style.background = 'var(--kl-checkerboard-background)';
                tempCanvas.style.backgroundSize = 100 * scale + 'px';
            }
        }

        result.destroy = (): void => {
            cropper.destroy();
            ruleOThirdsCheckbox.destroy();
            colorOptions.destroy();
        };
        result.getInput = function (): TFilterCropExtendInput {
            result.destroy!();
            return {
                left: left,
                right: right,
                top: top,
                bottom: bottom,
                fillColor: selectedRgbaObj.a === 0 ? undefined : selectedRgbaObj,
            };
        };
        return result;
    },

    apply(params: TFilterApply<TFilterCropExtendInput>): boolean {
        const klCanvas = params.klCanvas;
        if (
            !klCanvas ||
            isNaN(params.input.left) ||
            isNaN(params.input.right) ||
            isNaN(params.input.top) ||
            isNaN(params.input.bottom)
        ) {
            return false;
        }
        klCanvas.resizeCanvas(params.input);

        return true;
    },
};
