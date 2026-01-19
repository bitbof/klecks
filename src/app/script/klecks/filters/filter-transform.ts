import { BB } from '../../bb/bb';
import { Checkbox } from '../ui/components/checkbox';
import { FreeTransform } from '../ui/components/free-transform';
import { TFreeTransform } from '../ui/components/free-transform-utils';
import { Select } from '../ui/components/select';
import {
    isLayerFill,
    TFilterApply,
    TFilterGetDialogParam,
    TFilterGetDialogResult,
} from '../kl-types';
import { LANG } from '../../language/language';
import { css, throwIfNull } from '../../bb/base/base';
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
import { THistoryEntryLayerComposed } from '../history/history.types';

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

function parseCssColor(colorString: string) {
    if (colorString.startsWith('#')) {
        let hex = colorString.slice(1);
        if (hex.length === 3) {
            hex = hex
                .split('')
                .map((c) => c + c)
                .join('');
        }
        if (hex.length === 6) {
            // assume full alpha
            hex += 'ff';
        }
        const intVal = parseInt(hex, 16);
        return {
            r: (intVal >> 24) & 255,
            g: (intVal >> 16) & 255,
            b: (intVal >> 8) & 255,
            a: (intVal & 255) / 255,
        };
    }

    const rgbMatch = colorString.match(/rgba?\(([^)]+)\)/);
    if (rgbMatch) {
        const [r, g, b, a = 1] = rgbMatch[1].split(',').map((v) => parseFloat(v.trim()));
        return { r, g, b, a };
    }

    return undefined;
}

export function testComposedLayerHasTransparency(layer: THistoryEntryLayerComposed): boolean {
    for (const tile of layer.tiles) {
        if (isLayerFill(tile)) {
            const color = parseCssColor(tile.fill);
            if (color && color.a < 1) {
                return true;
            }
        } else {
            const data = tile.data.data;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] < 255) {
                    return true;
                }
            }
        }
    }
    return false;
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
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const isSmall = testIsSmall();
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));
        const isBgLayer = selectedLayerIndex === 0;
        let hasTransparency = false;
        if (isBgLayer) {
            const layer = Object.entries(params.composed.layerMap).find(
                ([_, layer]) => layer.index === selectedLayerIndex,
            )![1];
            hasTransparency = testComposedLayerHasTransparency(layer);
        }
        const selection = klCanvas.getSelection();

        // determine bounds and initial transformation
        const boundsObj = selection
            ? getSelectionBounds(selection, context)
            : BB.canvasBounds(context);
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

        const leftWrapper = BB.el({
            css: {
                width: '100px',
                height: '30px',
                display: 'inline-block',
            },
        });
        const rightWrapper = BB.el({
            css: {
                width: '100px',
                height: '30px',
                display: 'inline-block',
            },
        });
        const rotWrapper = BB.el({
            css: {
                width: '150px',
                height: '30px',
                display: 'inline-block',
            },
        });
        const inputY = BB.el({ tagName: 'input' });
        const inputX = BB.el({ tagName: 'input' });
        const inputR = BB.el({ tagName: 'input' });
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
        const buttonRow = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px',
                marginTop: '10px',
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
        });
        const flipYBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: LANG('filter-transform-flip') + ' Y',
            onClick: () => {
                const t = freeTransform.getValue();
                freeTransform.setSize(t.width, -t.height);
            },
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
        });
        const scaleDoubleBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: '2&times;',
            onClick: () => {
                const t = freeTransform.getValue();
                if (constrainCheckbox.getValue()) {
                    freeTransform.setSize(
                        (t.width < 0 ? -1 : 1) * freeTransform.getRatio() * Math.abs(t.height) * 2,
                        t.height * 2,
                    );
                } else {
                    freeTransform.setSize(t.width * 2, t.height * 2);
                }
            },
        });
        const scaleHalfBtn = BB.el({
            parent: buttonRow,
            tagName: 'button',
            content: '&frac12;&times;',
            onClick: () => {
                const t = freeTransform.getValue();
                freeTransform.setSize(Math.round(t.width / 2), Math.round(t.height / 2));
            },
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
                marginLeft: '10px',
            },
            name: 'enable-snapping',
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
            name: 'interpolation-algorithm',
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
        css(preview.getElement(), {
            overflow: 'hidden',
            marginLeft: '-20px',
            marginRight: '-20px',
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
                layers[selectedLayerIndex].context.canvas,
                algorithmSelect.getValue() === 'pixelated',
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
                inputX.value = '' + Math.round(t.x - initTransform.x);
                inputY.value = '' + Math.round(t.y - initTransform.y);
                inputR.value = '' + Math.round(t.angleDeg);
                updatePreview();
            },
            viewportTransform: preview.getTransform(),
        });
        css(freeTransform.getElement(), {
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
            if (transparentBgCheckboxTouched) {
                preferenceIsTransparentBg = isTransparentBg;
            }
            const input: TFilterTransformInput = {
                transform,
                bounds: boundsObj,
                isPixelated: algorithmSelect.getValue() === 'pixelated',
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
        klHistory.pause(true);
        const input = params.input;
        const selectedLayerIndex = params.klCanvas.getLayerIndex(context.canvas)!;

        const copyCanvas = BB.copyCanvas(context.canvas);
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
            params.klCanvas.setSelection(selection);
        }
        klHistory.pause(false);

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
