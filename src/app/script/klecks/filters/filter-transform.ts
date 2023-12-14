import {BB} from '../../bb/bb';
import {Checkbox} from '../ui/components/checkbox';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {FreeTransform} from '../ui/components/free-transform';
import {IFreeTransform} from '../ui/components/free-transform-utils';
import {Select} from '../ui/components/select';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {LANG} from '../../language/language';
import {TFilterHistoryEntry} from './filters';
import {throwIfNull} from '../../bb/base/base';
import {testIsSmall} from './utils/test-is-small';
import {getPreviewHeight, getPreviewWidth, mediumPreview} from './utils/preview-size';

export type TFilterTransformInput = {
    bounds: {x: number; y: number; width: number; height: number};
    transform: IFreeTransform;
    isPixelated: boolean;
};

export type TFilterTransformHistoryEntry = TFilterHistoryEntry<
    'transform',
    TFilterTransformInput>;

export const filterTransform = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const isSmall = testIsSmall();
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, isSmall ? 280 : 490, isSmall ? 200 : 240, 1);
        const displayW = parseInt('' + fit.width), displayH = parseInt('' + fit.height);
        const w = Math.min(displayW, context.canvas.width);
        const h = Math.min(displayH, context.canvas.height);
        const displayPreviewFactor = displayW / context.canvas.width;

        // determine bounds and initial transformation
        const boundsObj = BB.canvasBounds(context);
        if (!boundsObj) {
            alert(LANG('filter-transform-empty'));
            return false;
        }
        const initTransform = {
            x: boundsObj.x + boundsObj.width / 2,
            y: boundsObj.y + boundsObj.height / 2,
            width: boundsObj.width,
            height: boundsObj.height,
            angleDeg: 0,
        };


        const rootEl = BB.el();
        const result: IFilterGetDialogResult<TFilterTransformInput> = {
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
        const inputY = BB.el({tagName: 'input'});
        const inputX = BB.el({tagName: 'input'});
        const inputR = BB.el({tagName: 'input'});
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
        const buttonRow = BB.el ({
            parent: rootEl,
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                marginLeft: '-10px',
            },
        });
        const flipXBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' X',
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setSize(-t.width, t.height);
            },
            css: actionBtnCss,
        });
        const flipYBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' Y',
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setSize(t.width, -t.height);
            },
            css: actionBtnCss,
        });
        const scaleRotLeftBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '-90°',
            onClick: () => {
                const t = freeTransform.getTransform();
                t.angleDeg -= 90;
                t.angleDeg %= 360;
                freeTransform.setAngleDeg(t.angleDeg);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });
        const scaleRotRightBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '+90°',
            onClick: () => {
                const t = freeTransform.getTransform();
                t.angleDeg += 90;
                t.angleDeg %= 360;
                freeTransform.setAngleDeg(t.angleDeg);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            css: actionBtnCss,
        });
        const scaleDoubleBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '2x',
            onClick: () => {
                const t = freeTransform.getTransform();
                if (constrainCheckbox.getValue()) {
                    freeTransform.setSize(freeTransform.getRatio() * t.height * 2, t.height * 2);
                } else {
                    freeTransform.setSize(t.width * 2, t.height * 2);
                }
            },
            css: actionBtnCss,
        });
        const scaleHalfBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: '1/2x',
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setSize(Math.round(t.width / 2), Math.round(t.height / 2));
            },
            css: actionBtnCss,
        });
        const centerBtn = BB.el ({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('center'),
            onClick: () => {
                const t = freeTransform.getTransform();
                freeTransform.setPos({ x: context.canvas.width / 2, y: context.canvas.height / 2 });
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
                freeTransform.setConstrained(isConstrained);
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

        rootEl.append(BB.el({
            css: {
                clear: 'both',
                height: '10px',
            },
        }));

        const bottomRow = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
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


        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: getPreviewWidth(isSmall) + 'px',
                height: getPreviewHeight(isSmall) + 'px',
            },
        });
        previewWrapper.oncontextmenu = function () {
            return false;
        };

        const previewLayerArr: IKlBasicLayer[] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                let canvas;
                if (i === selectedLayerIndex) {
                    canvas = BB.canvas(parseInt('' + w), parseInt('' + h));
                    const ctx = BB.ctx(canvas);
                    ctx.drawImage(layers[i].context.canvas, 0, 0, canvas.width, canvas.height);
                } else {
                    canvas = layers[i].context.canvas;
                }
                previewLayerArr.push({
                    image: canvas,
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                });
            }
        }
        const klCanvasPreview = new KlCanvasPreview({
            width: parseInt('' + displayW),
            height: parseInt('' + displayH),
            layers: previewLayerArr,
        });

        const previewInnerWrapper = BB.el({
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: parseInt('' + displayW) + 'px',
                height: parseInt('' + displayH) + 'px',
            },
        });
        previewInnerWrapper.append(klCanvasPreview.getElement());
        previewWrapper.append(previewInnerWrapper);

        let lastDrawnTransformStr = '';
        function updatePreview (doForce: boolean = false) {
            if (!freeTransform) {
                return;
            }
            const transform = freeTransform.getTransform();
            if (JSON.stringify(transform) === lastDrawnTransformStr && !doForce) {
                return;
            }
            lastDrawnTransformStr = JSON.stringify(transform);
            if (displayPreviewFactor < 1) {
                transform.x *= displayPreviewFactor;
                transform.y *= displayPreviewFactor;
                transform.width *= displayPreviewFactor;
                transform.height *= displayPreviewFactor;
            }
            const transformLayerCanvas = previewLayerArr[selectedLayerIndex].image as HTMLCanvasElement;
            const ctx = BB.ctx(transformLayerCanvas);
            ctx.save();
            ctx.clearRect(0, 0, transformLayerCanvas.width, transformLayerCanvas.height);
            BB.drawTransformedImageWithBounds(
                ctx,
                layers[selectedLayerIndex].context.canvas,
                transform,
                boundsObj,
                algorithmSelect.getValue() === 'pixelated' ||
                BB.testShouldPixelate(transform, transform.width / initTransform.width, transform.height / initTransform.height),
            );
            ctx.restore();
            klCanvasPreview.render();
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
            scale: displayPreviewFactor,
        });
        BB.css(freeTransform.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
        });
        previewInnerWrapper.append(freeTransform.getElement());

        function onInputsChanged () {
            freeTransform.setPos({
                x: parseInt(inputX.value) + initTransform.x,
                y: parseInt(inputY.value) + initTransform.y}
            );
            freeTransform.setAngleDeg(parseInt(inputR.value));
            updatePreview();
        }

        updatePreview();

        rootEl.append(previewWrapper);
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
            klCanvasPreview.destroy();
        };
        result.getInput = function (): TFilterTransformInput {
            const transform = freeTransform.getTransform();
            const input: TFilterTransformInput = {
                transform,
                bounds: boundsObj,
                isPixelated: algorithmSelect.getValue() === 'pixelated' ||
                    BB.testShouldPixelate(transform, transform.width / initTransform.width, transform.height / initTransform.height),
            };
            result.destroy!();
            return BB.copyObj(input);
        };
        return result;
    },

    apply (params: IFilterApply<TFilterTransformInput>): boolean {
        const context = params.context;
        const history = params.history;
        if (!context || !history) {
            return false;
        }
        history.pause(true);

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

        history.pause(false);
        history.push({
            tool: ['filter', 'transform'],
            action: 'apply',
            params: [{input}],
        } as TFilterTransformHistoryEntry);
        return true;
    },

};