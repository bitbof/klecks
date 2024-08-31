import { BB } from '../../bb/bb';
import { Checkbox } from '../ui/components/checkbox';
import { FreeTransform } from '../ui/components/free-transform';
import { IFreeTransform } from '../ui/components/free-transform-utils';
import { Select } from '../ui/components/select';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { TFilterHistoryEntry } from './filters';
import { throwIfNull } from '../../bb/base/base';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { css } from '@emotion/css/dist/emotion-css.cjs';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth, mediumPreview } from '../ui/utils/preview-size';

export type TFilterTransformInput = {
    bounds: { x: number; y: number; width: number; height: number };
    transform: IFreeTransform;
    isPixelated: boolean;
};

export type TFilterTransformHistoryEntry = TFilterHistoryEntry<'transform', TFilterTransformInput>;

export const filterTransform = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const isSmall = testIsSmall();
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        // determine bounds and initial transformation
        const boundsObj = BB.canvasBounds(context);
        if (!boundsObj) {
            return { error: LANG('filter-transform-empty') };
        }
        const initTransform = {
            x: boundsObj.x + boundsObj.width / 2,
            y: boundsObj.y + boundsObj.height / 2,
            width: boundsObj.width,
            height: boundsObj.height,
            angleDeg: 0,
        };

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterTransformInput> = {
            element: rootEl,
        };
        if (!isSmall) {
            result.width = mediumPreview.width;
        }

        const keyListener = new BB.KeyListener({
            onDown: function (keyStr) {
                if (BB.isInputFocused(true)) {
                    return;
                }

                if (keyStr === 'left') {
                    inputX.value = '' + (parseFloat(inputX.value) - 1);
                    onInputsChanged();
                }
                if (keyStr === 'right') {
                    inputX.value = '' + (parseFloat(inputX.value) + 1);
                    onInputsChanged();
                }
                if (keyStr === 'up') {
                    inputY.value = '' + (parseFloat(inputY.value) - 1);
                    onInputsChanged();
                }
                if (keyStr === 'down') {
                    inputY.value = '' + (parseFloat(inputY.value) + 1);
                    onInputsChanged();
                }
            },
        });

        const leftWrapper = BB.el();
        const rightWrapper = BB.el();
        const rotWrapper = BB.el();
        const inputY = BB.el({ tagName: 'input' });
        const inputX = BB.el({ tagName: 'input' });
        const inputR = BB.el({ tagName: 'input' });
        leftWrapper.style.width = '100px';
        leftWrapper.style.height = '30px';
        rightWrapper.style.width = '100px';
        rightWrapper.style.height = '30px';
        rightWrapper.style.display = 'inline-block';
        leftWrapper.style.display = 'inline-block';
        rotWrapper.style.display = 'inline-block';
        rotWrapper.style.width = '150px';
        rotWrapper.style.height = '30px';
        inputY.type = 'number';
        inputX.type = 'number';
        inputR.type = 'number';
        inputX.style.width = 70 + 'px';
        inputY.style.width = 70 + 'px';
        inputR.style.width = 70 + 'px';
        inputY.value = '0';
        inputX.value = '0';
        inputR.value = '0';
        inputY.onclick = function () {
            inputY.focus();
            onInputsChanged();
        };
        inputX.onclick = function () {
            inputX.focus();
            onInputsChanged();
        };
        inputR.onclick = function () {
            inputR.focus();
            onInputsChanged();
        };
        inputY.onchange = function () {
            onInputsChanged();
        };
        inputX.onchange = function () {
            onInputsChanged();
        };
        inputR.onchange = function () {
            onInputsChanged();
        };
        inputY.onkeyup = function () {
            onInputsChanged();
        };
        inputX.onkeyup = function () {
            onInputsChanged();
        };
        inputR.onkeyup = function () {
            onInputsChanged();
        };
        leftWrapper.append('X: ', inputX);
        rightWrapper.append('Y: ', inputY);
        rotWrapper.append(LANG('filter-transform-rotation') + ': ', inputR);
        if (!isSmall) {
            const inputRow = BB.el({
                parent: rootEl,
                css: {
                    marginTop: '10px',
                },
            });
            inputRow.append(leftWrapper, rightWrapper, rotWrapper);
        }

        // buttons
        const actionBtnCss = {
            marginLeft: '10px',
            marginTop: '10px',
        };
        const buttonRow = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                marginLeft: '-10px',
            },
        });
        const flipXBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' X',
            onClick: () => {
                const t = freeTransform.getValue();
                freeTransform.setSize(-t.width, t.height);
            },
            css: actionBtnCss,
        });
        const flipYBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' Y',
            onClick: () => {
                const t = freeTransform.getValue();
                freeTransform.setSize(t.width, -t.height);
            },
            css: actionBtnCss,
        });
        const scaleRotLeftBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: '-90°',
            onClick: () => {
                const t = freeTransform.getValue();
                t.angleDeg -= 90;
                t.angleDeg %= 360;
                freeTransform.setAngleDeg(t.angleDeg);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });
        const scaleRotRightBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: '+90°',
            onClick: () => {
                const t = freeTransform.getValue();
                t.angleDeg += 90;
                t.angleDeg %= 360;
                freeTransform.setAngleDeg(t.angleDeg);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });
        const scaleDoubleBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: '2x',
            onClick: () => {
                const t = freeTransform.getValue();
                if (constrainCheckbox.getValue()) {
                    freeTransform.setSize(freeTransform.getRatio() * t.height * 2, t.height * 2);
                } else {
                    freeTransform.setSize(t.width * 2, t.height * 2);
                }
            },
            css: actionBtnCss,
        });
        const scaleHalfBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: '1/2x',
            onClick: () => {
                const t = freeTransform.getValue();
                freeTransform.setSize(Math.round(t.width / 2), Math.round(t.height / 2));
            },
            css: actionBtnCss,
        });
        const centerBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('center'),
            onClick: () => {
                const t = freeTransform.getValue();
                freeTransform.setPos({
                    x: context.canvas.width / 2,
                    y: context.canvas.height / 2,
                });
                freeTransform.setAngleDeg(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });

        let isConstrained = true;
        const constrainCheckbox = new Checkbox({
            init: true,
            label: LANG('filter-transform-constrain'),
            title: LANG('constrain-proportions'),
            allowTab: true,
            callback: function (b) {
                isConstrained = b;
                freeTransform.setIsConstrained(isConstrained);
            },
            css: {
                display: 'inline-block',
            },
        });
        let isSnapping = false;
        const snappingCheckbox = new Checkbox({
            init: true,
            label: LANG('filter-transform-snap'),
            title: LANG('filter-transform-snap-title'),
            allowTab: true,
            callback: function (b) {
                isSnapping = b;
                freeTransform.setSnapping(isSnapping);
            },
            css: {
                display: 'inline-block',
                marginLeft: '10px',
            },
        });
        const checkboxWrapper = BB.el();
        checkboxWrapper.append(constrainCheckbox.getElement(), snappingCheckbox.getElement());

        rootEl.append(
            BB.el({
                css: {
                    clear: 'both',
                    height: '10px',
                },
            }),
        );

        const bottomRow = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
            },
        });

        const algorithmSelect = new Select({
            isFocusable: true,
            optionArr: [
                ['smooth', LANG('algorithm-smooth')],
                ['pixelated', LANG('algorithm-pixelated')],
            ],
            initValue: 'smooth',
            title: LANG('scaling-algorithm'),
            onChange: (): void => {
                updatePreview(true);
            },
        });
        bottomRow.append(checkboxWrapper, algorithmSelect.getElement());

        const previewCanvas = BB.canvas(context.canvas.width, context.canvas.height);
        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image: i === selectedLayerIndex ? previewCanvas : layers[i].context.canvas,
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
            hasEditMode: true,
            onModeChange: (m) => {
                freeTransform.getElement().style.pointerEvents = m === 'edit' ? '' : 'none';
                freeTransform.getElement().style.opacity = m === 'edit' ? '' : '0.5';
            },
            onTransformChange: (transform) => {
                freeTransform.setViewportTransform(transform);
            },
            padding: 30,
        });
        preview.render();
        preview.getElement().classList.add(
            css({
                overflow: 'hidden',
                marginLeft: '-20px',
                marginRight: '-20px',
            }),
        );
        rootEl.append(preview.getElement());

        let lastDrawnTransformStr = '';
        function updatePreview(doForce: boolean = false) {
            if (!freeTransform) {
                return;
            }
            const transform = freeTransform.getValue();
            if (JSON.stringify(transform) === lastDrawnTransformStr && !doForce) {
                return;
            }
            lastDrawnTransformStr = JSON.stringify(transform);

            const ctx = BB.ctx(previewCanvas);
            ctx.save();
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            BB.drawTransformedImageWithBounds(
                ctx,
                layers[selectedLayerIndex].context.canvas,
                transform,
                boundsObj,
                algorithmSelect.getValue() === 'pixelated' ||
                    BB.testShouldPixelate(
                        transform,
                        transform.width / initTransform.width,
                        transform.height / initTransform.height,
                    ),
            );
            ctx.restore();
            preview.render();
        }

        const freeTransform = new FreeTransform({
            x: initTransform.x,
            y: initTransform.y,
            width: initTransform.width,
            height: initTransform.height,
            angleDeg: initTransform.angleDeg,
            isConstrained: true,
            snapX: [0, context.canvas.width],
            snapY: [0, context.canvas.height],
            callback: function (t) {
                inputX.value = '' + Math.round(t.x - initTransform.x);
                inputY.value = '' + Math.round(t.y - initTransform.y);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            viewportTransform: preview.getTransform(),
        });
        BB.css(freeTransform.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
        });
        preview.getElement().append(freeTransform.getElement());

        function onInputsChanged() {
            freeTransform.setPos({
                x: parseInt(inputX.value) + initTransform.x,
                y: parseInt(inputY.value) + initTransform.y,
            });
            freeTransform.setAngleDeg(parseInt(inputR.value));
            updatePreview();
        }

        updatePreview();

        result.destroy = (): void => {
            keyListener.destroy();
            freeTransform.destroy();
            constrainCheckbox.destroy();
            snappingCheckbox.destroy();
            BB.destroyEl(flipXBtn);
            BB.destroyEl(flipYBtn);
            BB.destroyEl(scaleRotLeftBtn);
            BB.destroyEl(scaleRotRightBtn);
            BB.destroyEl(scaleDoubleBtn);
            BB.destroyEl(scaleHalfBtn);
            BB.destroyEl(centerBtn);
            preview.destroy();
            BB.freeCanvas(previewCanvas);
        };
        result.getInput = function (): TFilterTransformInput {
            const transform = freeTransform.getValue();
            const input: TFilterTransformInput = {
                transform,
                bounds: boundsObj,
                isPixelated:
                    algorithmSelect.getValue() === 'pixelated' ||
                    BB.testShouldPixelate(
                        transform,
                        transform.width / initTransform.width,
                        transform.height / initTransform.height,
                    ),
            };
            result.destroy!();
            return BB.copyObj(input);
        };
        return result;
    },

    apply(params: IFilterApply<TFilterTransformInput>): boolean {
        const context = params.context;
        const history = params.history;
        if (!context) {
            return false;
        }
        history?.pause(true);

        const input = params.input;

        const copyCanvas = BB.copyCanvas(context.canvas);
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        BB.drawTransformedImageWithBounds(
            context,
            copyCanvas,
            input.transform,
            input.bounds,
            input.isPixelated,
        );

        history?.pause(false);
        history?.push({
            tool: ['filter', 'transform'],
            action: 'apply',
            params: [{ input }],
        } as TFilterTransformHistoryEntry);
        return true;
    },
};
