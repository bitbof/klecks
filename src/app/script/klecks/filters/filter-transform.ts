import { BB } from '../../bb/bb';
import { Checkbox } from '../ui/components/checkbox';
import { FreeTransform } from '../ui/components/free-transform';
import { InterpolationAlgorithmToggle } from '../ui/components/interpolation-algorithm-toggle';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { css, Destroyer } from '../../bb/base/base';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth, MEDIUM_PREVIEW } from '../ui/utils/preview-size';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { getSelectionBounds } from '../select-tool/get-selection-bounds';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { compose, Matrix, rotate, scale, translate } from 'transformation-matrix';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';
import { MultiPolygon } from 'polygon-clipping';
import { TRect } from '../../bb/bb-types';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { getCanvasBounds } from '../../bb/base/canvas';
import { TFreeTransform } from '../transform/transform-types';
import {
    centerTransformation,
    flipTransformation,
    rotateTransformation,
    scaleTransformation,
    TComposedFree,
} from '../transform/composed-transformation';
import { Input } from '../ui/components/input';
import { composedLayerHasTransparency } from '../utils/composed-layer-has-transparency';

// preference expressed by user
let preferenceIsTransparentBg: undefined | boolean;

function getIsTransparentBg(
    isBgLayer: boolean,
    layerHasTransparency: boolean,
    preference: undefined | boolean,
): boolean {
    if (!isBgLayer) {
        return true;
    }
    if (preference !== undefined) {
        return preference;
    }
    return layerHasTransparency;
}

function drawTransform(
    ctx: CanvasRenderingContext2D,
    copiedCanvas: HTMLCanvasElement,
    isPixelated: boolean,
    transform: TFreeTransform,
    selection?: MultiPolygon,
    boundsObj?: TRect,
    doClone?: boolean,
    isTransparentBg?: boolean,
): Matrix | undefined {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    if (selection) {
        // draw original with clipped selection
        ctx.drawImage(copiedCanvas, 0, 0);
        if (!doClone) {
            const selectionPath = getSelectionPath2d(selection);
            ctx.clip(selectionPath);
            ctx.globalCompositeOperation = isTransparentBg ? 'destination-out' : 'source-atop';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        if (isTransparentBg) {
            if (doClone) {
                ctx.drawImage(copiedCanvas, 0, 0);
            }
        } else {
            ctx.drawImage(copiedCanvas, 0, 0);
            if (!doClone) {
                ctx.fillStyle = 'white';
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillRect(0, 0, width, height);
            }
        }
    }
    ctx.restore();

    let matrix: Matrix | undefined;
    if (selection) {
        const bounds = boundsObj ?? {
            x: 0,
            y: 0,
            width: ctx.canvas.width,
            height: ctx.canvas.height,
        };
        if (
            isPixelated ||
            BB.testShouldPixelate(
                transform,
                transform.width / bounds.width,
                transform.height / bounds.height,
            )
        ) {
            ctx.imageSmoothingEnabled = false;
        } else {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }
        // derived from drawTransformedImageWithBounds
        matrix = compose(
            translate(transform.x, transform.y),
            rotate((transform.angleDeg / 180) * Math.PI),
            scale(transform.width > 0 ? 1 : -1, transform.height > 0 ? 1 : -1),
            translate(-Math.abs(transform.width) / 2, -Math.abs(transform.height) / 2),
            scale(
                Math.abs(transform.width / bounds.width),
                Math.abs(transform.height / bounds.height),
            ),
            translate(-bounds.x, -bounds.y),
        );
        ctx.setTransform(...matrixToTuple(matrix));
        const selectionPath = getSelectionPath2d(selection);
        ctx.clip(selectionPath);
        ctx.drawImage(copiedCanvas, 0, 0);
    } else {
        BB.drawTransformedImageWithBounds(ctx, copiedCanvas, transform, boundsObj, isPixelated);
    }

    ctx.restore();
    return matrix;
}

export type TFilterTransformInput = {
    bounds: { x: number; y: number; width: number; height: number };
    transform: TFreeTransform;
    isPixelated: boolean;
    doClone: boolean;
    isTransparentBg: boolean;
};

export const filterTransform = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        const selectedLayerIndex = params.selectedLayerIndex;
        const layer = klCanvas.getLayer(selectedLayerIndex);
        const context = layer.context;
        const isSmall = testIsSmall();
        const layers = klCanvas.getLayers();
        const isBgLayer = selectedLayerIndex === 0;
        let hasTransparency = false;
        if (isBgLayer) {
            const layer = Object.entries(params.composed.layerMap).find(
                ([_, layer]) => layer.index === selectedLayerIndex,
            )![1];
            hasTransparency = composedLayerHasTransparency(layer);
        }
        const selection = klCanvas.getSelection();

        // determine bounds and initial transformation
        const boundsObj = selection
            ? getSelectionBounds(selection, context)
            : getCanvasBounds(context);
        if (!boundsObj) {
            return {
                error: LANG(
                    selection ? 'filter-transform-empty-selection' : 'filter-transform-empty',
                ),
            };
        }
        const initTransform = {
            x: boundsObj.x + boundsObj.width / 2,
            y: boundsObj.y + boundsObj.height / 2,
            width: boundsObj.width,
            height: boundsObj.height,
            angleDeg: 0,
        };

        const rootEl = BB.el();
        const destroyer = new Destroyer();
        const result: TFilterGetDialogResult<TFilterTransformInput> = {
            element: rootEl,
        };
        if (!isSmall) {
            result.width = MEDIUM_PREVIEW.width;
        }

        const keyListener = new BB.KeyListener({
            onDown: function (keyStr) {
                if (BB.isInputFocused(true)) {
                    return;
                }

                if (keyStr === 'left') {
                    inputX.setValue(inputX.getValue() - 1);
                    onInputsChanged();
                }
                if (keyStr === 'right') {
                    inputX.setValue(inputX.getValue() + 1);
                    onInputsChanged();
                }
                if (keyStr === 'up') {
                    inputY.setValue(inputY.getValue() - 1);
                    onInputsChanged();
                }
                if (keyStr === 'down') {
                    inputY.setValue(inputY.getValue() + 1);
                    onInputsChanged();
                }
            },
        });

        const leftWrapper = BB.el({
            css: {
                width: 100,
                height: 30,
                display: 'inline-block',
            },
        });
        const rightWrapper = BB.el({
            css: {
                width: 100,
                height: 30,
                display: 'inline-block',
            },
        });
        const rotWrapper = BB.el({
            css: {
                width: 150,
                height: 30,
                display: 'inline-block',
            },
        });
        const inputX = new Input<number>({
            type: 'number',
            init: 0,
            step: 1,
            name: 'transform-x',
            label: 'X:',
            css: { width: 70 },
            onChange: () => onInputsChanged(),
        });
        const inputY = new Input<number>({
            type: 'number',
            init: 0,
            step: 1,
            name: 'transform-y',
            label: 'Y:',
            css: { width: 70 },
            onChange: () => onInputsChanged(),
        });
        const inputR = new Input<number>({
            type: 'number',
            init: 0,
            step: 1,
            name: 'transform-rotation',
            label: LANG('filter-transform-rotation') + ':',
            css: { width: 70 },
            onChange: () => onInputsChanged(),
        });
        leftWrapper.append(inputX.getElement());
        rightWrapper.append(inputY.getElement());
        rotWrapper.append(inputR.getElement());
        if (!isSmall) {
            const inputRow = BB.el({
                parent: rootEl,
                css: {
                    marginTop: 10,
                },
            });
            inputRow.append(leftWrapper, rightWrapper, rotWrapper);
        }

        // buttons
        const buttonRow = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
            },
        });
        const flipXBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: LANG('filter-transform-flip') + ' X',
            destroyer,
            onClick: () => {
                const transformed = flipTransformation(
                    {
                        type: 'free',
                        freeTransform: freeTransform.getValue(),
                    },
                    'x',
                ) as TComposedFree;
                freeTransform.initialise(transformed.freeTransform);
                updatePreview();
            },
        });
        const flipYBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: LANG('filter-transform-flip') + ' Y',
            destroyer,
            onClick: () => {
                const transformed = flipTransformation(
                    {
                        type: 'free',
                        freeTransform: freeTransform.getValue(),
                    },
                    'y',
                ) as TComposedFree;
                freeTransform.initialise(transformed.freeTransform);
                updatePreview();
            },
        });
        const scaleRotLeftBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: '-90°',
            destroyer,
            onClick: () => {
                const transformed = rotateTransformation(
                    {
                        type: 'free',
                        freeTransform: freeTransform.getValue(),
                    },
                    -90,
                ) as TComposedFree;
                freeTransform.initialise(transformed.freeTransform);
                inputR.setValue(Math.round(transformed.freeTransform.angleDeg));
                updatePreview();
            },
        });
        const scaleRotRightBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: '+90°',
            destroyer,
            onClick: () => {
                const transformed = rotateTransformation(
                    {
                        type: 'free',
                        freeTransform: freeTransform.getValue(),
                    },
                    90,
                ) as TComposedFree;
                freeTransform.initialise(transformed.freeTransform);
                inputR.setValue(Math.round(transformed.freeTransform.angleDeg));
                updatePreview();
            },
        });
        const scaleDoubleBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: '2&times;',
            destroyer,
            onClick: () => {
                const transformed = scaleTransformation(
                    {
                        type: 'free',
                        freeTransform: freeTransform.getValue(),
                    },
                    2,
                ) as TComposedFree;
                freeTransform.initialise(transformed.freeTransform);
                updatePreview();
            },
        });
        const scaleHalfBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: '&frac12;&times;',
            destroyer,
            onClick: () => {
                const transformed = scaleTransformation(
                    {
                        type: 'free',
                        freeTransform: freeTransform.getValue(),
                    },
                    0.5,
                ) as TComposedFree;
                freeTransform.initialise(transformed.freeTransform);
                updatePreview();
            },
        });
        const centerBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            className: 'kl-button',
            content: LANG('center'),
            destroyer,
            onClick: () => {
                const transformed = centerTransformation(
                    {
                        type: 'free',
                        freeTransform: freeTransform.getValue(),
                    },
                    { x: context.canvas.width / 2, y: context.canvas.height / 2 },
                ) as TComposedFree;
                freeTransform.initialise(transformed.freeTransform);
                inputX.setValue(Math.round(transformed.freeTransform.x - initTransform.x));
                inputY.setValue(Math.round(transformed.freeTransform.y - initTransform.y));
                updatePreview();
            },
        });

        let doClone = false;
        const cloneCheckbox = new Checkbox({
            init: doClone,
            label: LANG('select-transform-clone'),
            allowTab: true,
            callback: function (b) {
                doClone = b;
                updatePreview(true);
            },
            css: {
                display: 'inline-block',
            },
            name: 'clone-before-transforming',
        });
        let isTransparentBg = getIsTransparentBg(
            isBgLayer,
            hasTransparency,
            preferenceIsTransparentBg,
        );
        let transparentBgCheckboxTouched = false;
        const transparentBgCheckbox = new Checkbox({
            init: isTransparentBg,
            label: LANG('brush-eraser-transparent-bg'),
            allowTab: true,
            callback: function (b) {
                transparentBgCheckboxTouched = true;
                isTransparentBg = b;
                updatePreview(true);
            },
            css: {
                display: 'inline-block',
            },
            name: 'transparent-background',
        });
        buttonRow.append(cloneCheckbox.getElement());
        if (isBgLayer) {
            buttonRow.append(transparentBgCheckbox.getElement());
        }

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
            name: 'constrain-proportions',
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
                marginLeft: 10,
            },
            name: 'enable-snapping',
        });
        const checkboxWrapper = BB.el();
        checkboxWrapper.append(constrainCheckbox.getElement(), snappingCheckbox.getElement());

        rootEl.append(
            BB.el({
                css: {
                    clear: 'both',
                    height: 10,
                },
            }),
        );

        const bottomRow = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
            },
        });

        const algorithmToggle = new InterpolationAlgorithmToggle({
            initValue: 'smooth',
            isFocusable: true,
            onChange: (): void => {
                updatePreview(true);
            },
        });
        bottomRow.append(checkboxWrapper, algorithmToggle.getElement());

        const previewCanvas = BB.canvas(context.canvas.width, context.canvas.height);
        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image: i === selectedLayerIndex ? previewCanvas : layers[i].canvas,
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                    hasClipping: layers[i].hasClipping,
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
        css(preview.getElement(), {
            overflow: 'hidden',
            marginLeft: -20,
            marginRight: -20,
        });
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
            drawTransform(
                ctx,
                layers[selectedLayerIndex].canvas,
                algorithmToggle.getValue() === 'pixelated',
                transform,
                selection,
                boundsObj,
                doClone,
                isTransparentBg || selectedLayerIndex > 0,
            );
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
                inputX.setValue(Math.round(t.x - initTransform.x));
                inputY.setValue(Math.round(t.y - initTransform.y));
                inputR.setValue(Math.round(t.angleDeg));
                updatePreview();
            },
            viewportTransform: preview.getTransform(),
        });
        css(freeTransform.getElement(), {
            position: 'absolute',
            left: 0,
            top: 0,
        });
        preview.getElement().append(freeTransform.getElement());

        function onInputsChanged() {
            freeTransform.setPos({
                x: inputX.getValue() + initTransform.x,
                y: inputY.getValue() + initTransform.y,
            });
            freeTransform.setAngleDeg(inputR.getValue());
            updatePreview();
        }

        updatePreview();

        result.destroy = (): void => {
            keyListener.destroy();
            freeTransform.destroy();
            constrainCheckbox.destroy();
            snappingCheckbox.destroy();
            algorithmToggle.destroy();
            inputX.destroy();
            inputY.destroy();
            inputR.destroy();
            destroyer.destroy();
            preview.destroy();
            BB.freeCanvas(previewCanvas);
        };
        result.getInput = function (): TFilterTransformInput {
            const transform = freeTransform.getValue();
            if (transparentBgCheckboxTouched) {
                preferenceIsTransparentBg = isTransparentBg;
            }
            const input: TFilterTransformInput = {
                transform,
                bounds: boundsObj,
                isPixelated: algorithmToggle.getValue() === 'pixelated',
                doClone,
                isTransparentBg,
            };
            result.destroy!();
            return BB.copyObj(input);
        };
        return result;
    },

    apply(params: TFilterApply<TFilterTransformInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        if (!context) {
            return false;
        }
        const input = params.input;
        const selectedLayerIndex = params.layer.index;

        const copyCanvas = BB.copyToCanvas(context.canvas);
        let selection = params.klCanvas.getSelection();
        const matrix = drawTransform(
            context,
            copyCanvas,
            input.isPixelated,
            input.transform,
            selection,
            input.bounds,
            input.doClone,
            input.isTransparentBg || selectedLayerIndex > 0,
        );
        if (selection && matrix) {
            selection = transformMultiPolygon(selection, matrix);
            klHistory.pause(true);
            try {
                params.klCanvas.setSelection(selection);
            } finally {
                klHistory.pause(false);
            }
        }

        {
            const layerMap = Object.fromEntries(
                params.klCanvas.getLayers().map((layerItem) => {
                    if (layerItem.id === params.layer.id) {
                        return [
                            layerItem.id,
                            {
                                tiles: canvasToLayerTiles(params.layer.canvas),
                            },
                        ];
                    }

                    return [layerItem.id, {}];
                }),
            );
            klHistory.push({
                layerMap,
                ...(selection ? { selection: { value: selection } } : undefined),
            });
        }
        return true;
    },
};
