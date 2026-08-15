import { BB } from '../../bb/bb';
import { input } from '../ui/components/input';
import { Checkbox } from '../ui/components/checkbox';
import { ColorOptions } from '../ui/components/color-options';
import { Cropper } from '../ui/components/cropper';
import { Preview } from '../ui/project-viewport/preview';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult, TRgba } from '../kl-types';
import { LANG } from '../../language/language';
import { TCss, TRect } from '../../bb/bb-types';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { indexBoundsInArea } from '../../bb/math/math';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getIconUrl } from '../../icon/icon';
import { createTransform } from '../../bb/transform/create-transform';
import { EASEL_MAX_SCALE } from '../ui/easel/easel.config';
import { css } from '../../bb/base/base';
import { TViewportTransform } from '../ui/project-viewport/project-viewport';

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
        const tempCanvas = klCanvas.getCompleteCanvas(1);

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
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }
        const maxWidth = params.maxWidth,
            maxHeight = params.maxHeight;

        const selection = klCanvas.getSelection();
        let selectionBounds = selection
            ? indexBoundsInArea(
                  getMultiPolyBounds(selection, 'index'),
                  klCanvas.getWidth(),
                  klCanvas.getHeight(),
              )
            : undefined;
        if (selectionBounds) {
            const boundsWidth = selectionBounds.x2 - selectionBounds.x1 + 1;
            const boundsHeight = selectionBounds.y2 - selectionBounds.y1 + 1;
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
            css: { width: 75 },
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
            css: { width: 75 },
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
            css: { width: 75 },
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
            css: { width: 75 },
            callback: function () {
                bottomChanged = true;
                updateInput();
            },
        });

        const sharedCss: TCss = {
            display: 'flex',
            flexDirection: 'column',
            width: 'calc(50% - 5px)',
            gap: 3,
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
                gap: 10,
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
                preview.setBackground(
                    selectedRgbaObj.a === 0
                        ? 'checker'
                        : BB.ColorConverter.toRgbStr(selectedRgbaObj),
                );
            },
        });

        const flexRow = BB.el({
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 10,
            },
        });
        rootEl.append(flexRow);
        flexRow.append(ruleOThirdsCheckbox.getElement(), colorOptions.getElement());

        // When dragging in the preview finishes, update the inputs
        function update(transform: TRect): void {
            left = parseInt('' + -transform.x);
            top = parseInt('' + -transform.y);
            right = parseInt('' + (transform.x + transform.width - klCanvas.getWidth()));
            bottom = parseInt('' + (transform.y + transform.height - klCanvas.getHeight()));
            leftInput.value = '' + left;
            topInput.value = '' + top;
            rightInput.value = '' + right;
            bottomInput.value = '' + bottom;
        }

        const cropperOuterWrapper = BB.el({
            css: {
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
            },
        });
        const cropperInnerWrapper = BB.el({
            parent: cropperOuterWrapper,
            css: {
                position: 'absolute',
                left: 0,
                top: 0,
                background: 'rgba(255,0,0,0.5)',
            },
        });
        function updateInnerWrapper(transform: TViewportTransform): void {
            cropperInnerWrapper.style.left = transform.x + 'px';
            cropperInnerWrapper.style.top = transform.y + 'px';
        }

        const previewPadding = 40;
        const previewWidth = getPreviewWidth(isSmall);
        const previewHeight = getPreviewHeight(isSmall);
        const preview = new Preview({
            width: previewWidth,
            height: previewHeight,
            project: {
                width: klCanvas.getWidth(),
                height: klCanvas.getHeight(),
                layers: [
                    {
                        image: tempCanvas,
                        isVisible: true,
                        opacity: 1,
                        mixModeStr: 'source-over',
                        hasClipping: false,
                    },
                ],
            },
            hasEditMode: true,
            editIcon: getIconUrl('edit-crop'),
            onModeChange: (mode) => {
                cropperOuterWrapper.style.pointerEvents = mode === 'edit' ? '' : 'none';
                cropperOuterWrapper.style.opacity = mode === 'edit' ? '' : '0.5';
            },
            onTransformChange: (transform) => {
                updateInnerWrapper(transform);
                cropper.setScale(transform.scale);
            },
            padding: previewPadding,
            background: 'checker',
        });
        if (selectionBounds) {
            const selectionWidth = selectionBounds.x2 - selectionBounds.x1 + 1;
            const selectionHeight = selectionBounds.y2 - selectionBounds.y1 + 1;
            const fit = BB.fitInto(
                selectionWidth,
                selectionHeight,
                previewWidth - previewPadding * 2,
                previewHeight - previewPadding * 2,
            );
            const scale = Math.min(EASEL_MAX_SCALE, fit.width / selectionWidth);
            preview.setTransform(
                createTransform(
                    { x: previewWidth / 2, y: previewHeight / 2 },
                    {
                        x: selectionBounds.x1 + selectionWidth / 2,
                        y: selectionBounds.y1 + selectionHeight / 2,
                    },
                    scale,
                    0,
                ),
            );
        }
        css(preview.getElement(), {
            overflow: 'hidden',
            marginLeft: -20,
            marginRight: -20,
            marginTop: 10,
        });
        preview.getElement().append(cropperOuterWrapper);
        rootEl.append(preview.getElement());

        const viewportTransform = preview.getTransform();
        const cropper = new Cropper({
            x: 0,
            y: 0,
            width: klCanvas.getWidth(),
            height: klCanvas.getHeight(),
            scale: viewportTransform.scale,
            callback: update,
            maxW: maxWidth,
            maxH: maxHeight,
            init: selectionBounds,
        });
        update(cropper.getTransform());
        cropper.setScale(viewportTransform.scale);
        cropperInnerWrapper.append(cropper.getElement());
        updateInnerWrapper(viewportTransform);
        const cropperWheelListener = new BB.PointerListener({
            target: cropperOuterWrapper,
            onWheel: preview.onWheel,
            useDirtyWheel: true,
        });
        preview.render();

        result.destroy = (): void => {
            cropperWheelListener.destroy();
            cropper.destroy();
            preview.destroy();
            BB.freeCanvas(tempCanvas);
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
