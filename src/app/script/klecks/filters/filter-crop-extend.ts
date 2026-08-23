import { BB } from '../../bb/bb';
import { Input } from '../ui/components/input';
import { Checkbox } from '../ui/components/checkbox';
import { ColorOptions } from '../ui/components/color-options';
import { ViewportCropper } from '../ui/components/cropper/viewport-cropper';
import { Preview } from '../ui/project-viewport/preview';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult, TRgba } from '../kl-types';
import { LANG } from '../../language/language';
import { TCss, TRect } from '../../bb/bb-types';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { indexBoundsInArea, indexBoundsToRect } from '../../bb/math/math';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getIconUrl } from '../../icon/icon';
import { createTransform } from '../../bb/transform/create-transform';
import { EASEL_MAX_SCALE } from '../ui/easel/easel.config';
import { css } from '../../bb/base/base';

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
        const initialCrop = {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        };
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
                initialCrop.top = selectionBounds.y1;
                initialCrop.right = selectionBounds.x2 - klCanvas.getWidth();
                initialCrop.bottom = selectionBounds.y2 - klCanvas.getHeight();
                initialCrop.left = selectionBounds.x1;
            } else {
                selectionBounds = undefined;
            }
        }

        // --- input elements ---
        const leftInput = new Input({
            init: initialCrop.left,
            type: 'number',
            name: 'crop-left',
            css: { width: 75 },
            step: 1,
            onChange: function () {
                onInputChange();
            },
        });
        const rightInput = new Input({
            init: initialCrop.right,
            type: 'number',
            name: 'crop-right',
            css: { width: 75 },
            step: 1,
            onChange: function () {
                onInputChange();
            },
        });
        const topInput = new Input({
            init: initialCrop.top,
            type: 'number',
            name: 'crop-top',
            css: { width: 75 },
            step: 1,
            onChange: function () {
                onInputChange();
            },
        });
        const bottomInput = new Input({
            init: initialCrop.bottom,
            type: 'number',
            name: 'crop-bottom',
            css: { width: 75 },
            step: 1,
            onChange: function () {
                onInputChange();
            },
        });

        function getValues(): { left: number; right: number; top: number; bottom: number } {
            return {
                left: leftInput.getValue(),
                right: rightInput.getValue(),
                top: topInput.getValue(),
                bottom: bottomInput.getValue(),
            };
        }

        function updateInputRanges() {
            const { left, right, top, bottom } = getValues();
            const width = klCanvas.getWidth();
            const height = klCanvas.getHeight();
            leftInput.setRange(-width - right + 1, -width - right + maxWidth);
            rightInput.setRange(-width - left + 1, -width - left + maxWidth);
            topInput.setRange(-height - bottom + 1, -height - bottom + maxHeight);
            bottomInput.setRange(-height - top + 1, -height - top + maxHeight);
        }
        updateInputRanges();

        const sharedCss: TCss = {
            display: 'flex',
            flexDirection: 'column',
            width: 'calc(50% - 5px)',
            gap: 3,
        };
        const leftWrapper = BB.el({
            content: [LANG('filter-crop-left') + ':', leftInput.getElement()],
            css: sharedCss,
        });
        const rightWrapper = BB.el({
            content: [LANG('filter-crop-right') + ':', rightInput.getElement()],
            css: sharedCss,
        });
        const topWrapper = BB.el({
            content: [LANG('filter-crop-top') + ':', topInput.getElement()],
            css: sharedCss,
        });
        const bottomWrapper = BB.el({
            content: [LANG('filter-crop-bottom') + ':', bottomInput.getElement()],
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

        function onInputChange(): void {
            const { left, right, top, bottom } = getValues();
            const width = klCanvas.getWidth() + left + right;
            const height = klCanvas.getHeight() + top + bottom;
            const newCrop: TRect = {
                x: -left,
                y: -top,
                width: width,
                height: height,
            };
            updateInputRanges();
            cropper.setValue(newCrop);
        }

        let useRuleOfThirds = true;
        const ruleOThirdsCheckbox = new Checkbox({
            init: true,
            label: LANG('filter-crop-rule-thirds'),
            allowTab: true,
            callback: function (b) {
                useRuleOfThirds = b;
                cropper.setShowThirds(useRuleOfThirds);
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

        function updateInputValues(crop: TRect): void {
            leftInput.setValue(-crop.x);
            topInput.setValue(-crop.y);
            rightInput.setValue(crop.x + crop.width - klCanvas.getWidth());
            bottomInput.setValue(crop.y + crop.height - klCanvas.getHeight());
            updateInputRanges();
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
                css(cropper.getElement(), {
                    pointerEvents: mode === 'edit' ? undefined : 'none',
                    opacity: mode === 'edit' ? undefined : 0.5,
                });
            },
            onTransformChange: (transform) => {
                cropper.setViewportTransform(transform);
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
        rootEl.append(preview.getElement());

        const cropper = new ViewportCropper({
            width: previewWidth,
            height: previewHeight,
            value: selectionBounds
                ? indexBoundsToRect(selectionBounds)
                : {
                      x: 0,
                      y: 0,
                      width: klCanvas.getWidth(),
                      height: klCanvas.getHeight(),
                  },
            viewportTransform: preview.getTransform(),
            maxWidth,
            maxHeight,
            showThirds: useRuleOfThirds,
            onChange: updateInputValues,
        });
        updateInputValues(cropper.getValue());
        css(cropper.getElement(), {
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 0,
        });
        preview.getElement().append(cropper.getElement());
        const cropperWheelListener = new BB.PointerListener({
            target: cropper.getElement(),
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
            leftInput.destroy();
            rightInput.destroy();
            topInput.destroy();
            bottomInput.destroy();
        };
        result.getInput = function (): TFilterCropExtendInput {
            const inputs = {
                left: leftInput.getValue(),
                right: rightInput.getValue(),
                top: topInput.getValue(),
                bottom: bottomInput.getValue(),
                fillColor: selectedRgbaObj.a === 0 ? undefined : selectedRgbaObj,
            };
            result.destroy!();
            return inputs;
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
