import { BB } from '../../bb/bb';
import { getSharedFx } from '../../fx-canvas/shared-fx';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { TwoTabs } from '../ui/components/two-tabs';
import { TRectanglePoints } from '../../fx-canvas/filters/perspective';
import { applyToPoint, Matrix } from 'transformation-matrix';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { css, throwIfNull, throwIfUndefined } from '../../bb/base/base';
import { DraggableInput } from '../ui/components/draggable-input';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth, MEDIUM_PREVIEW } from '../ui/utils/preview-size';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';

export type TFilterPerspectiveInput = {
    before: TRectanglePoints;
    after: TRectanglePoints;
};

export const filterPerspective = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        const selectedLayerIndex = params.selectedLayerIndex;
        const layer = klCanvas.getLayer(selectedLayerIndex);
        const isSmall = testIsSmall();
        const layers = klCanvas.getLayers();

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterPerspectiveInput> = {
            element: rootEl,
        };
        if (!isSmall) {
            result.width = MEDIUM_PREVIEW.width;
        }

        const fxCanvas = throwIfNull(getSharedFx());
        const texture = throwIfUndefined(fxCanvas?.texture(layer.canvas));

        function update(): void {
            if (isBefore) {
                fxCanvas.draw(texture).update();
            } else {
                fxCanvas
                    .draw(texture)
                    .perspective(
                        getFlatArr(beforeInputs) as TRectanglePoints,
                        getFlatArr(afterInputs) as TRectanglePoints,
                    )
                    .update();
            }
            preview.render();
        }

        const rectPoints = [
            { x: 0, y: 0 },
            { x: layer.canvas.width, y: 0 },
            { x: layer.canvas.width, y: layer.canvas.height },
            { x: 0, y: layer.canvas.height },
        ];
        const beforeInputs = rectPoints.map((point) => {
            return new DraggableInput({
                value: point,
                onChange: () => {
                    update();
                },
            });
        });
        beforeInputs.forEach((item) => (item.getElement().style.display = 'none'));
        const afterInputs = rectPoints.map((point) => {
            return new DraggableInput({
                value: point,
                onChange: () => {
                    update();
                },
            });
        });
        function getFlatArr(inputs: DraggableInput[], matrix?: Matrix): number[] {
            return inputs.flatMap((item) => {
                let value = item.getValue();
                if (matrix) {
                    value = applyToPoint(matrix, value);
                }
                return [value.x, value.y];
            });
        }

        let isBefore = false;

        const beforeAfterTabs = new TwoTabs({
            left: LANG('compare-before'),
            right: LANG('compare-after'),
            init: 1,
            onChange: (val: number) => {
                isBefore = val === 0;
                if (isBefore) {
                    beforeInputs.forEach((item) => (item.getElement().style.display = 'block'));
                    afterInputs.forEach((item) => (item.getElement().style.display = 'none'));
                } else {
                    beforeInputs.forEach((item, index) => {
                        afterInputs[index].setValue(item.getValue());
                    });
                    beforeInputs.forEach((item) => (item.getElement().style.display = 'none'));
                    afterInputs.forEach((item) => (item.getElement().style.display = 'block'));
                }
                update();
            },
        });
        rootEl.append(beforeAfterTabs.getElement());

        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image: i === selectedLayerIndex ? fxCanvas.canvas : layers[i].canvas,
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
                width: layer.canvas.width,
                height: layer.canvas.height,
                layers: previewLayerArr,
            },
            onTransformChange: (transform) => {
                beforeInputs.forEach((item) => item.setTransform(transform));
                afterInputs.forEach((item) => item.setTransform(transform));
            },
        });
        css(preview.getElement(), {
            overflow: 'hidden',
            marginLeft: -20,
            marginRight: -20,
        });

        preview
            .getElement()
            .append(
                ...beforeInputs.map((item) => item.getElement()),
                ...afterInputs.map((item) => item.getElement()),
            );
        rootEl.append(preview.getElement());

        update();
        result.destroy = (): void => {
            preview.destroy();
            texture.destroy();
            beforeInputs.forEach((item) => item.destroy());
            afterInputs.forEach((item) => item.destroy());
        };
        result.getInput = (): TFilterPerspectiveInput => {
            result.destroy!();
            return {
                before: getFlatArr(beforeInputs) as TRectanglePoints,
                after: getFlatArr(afterInputs) as TRectanglePoints,
            };
        };

        return result;
    },

    apply(params: TFilterApply<TFilterPerspectiveInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        const before = params.input.before;
        const after = params.input.after;
        if (!context || !before || !after) {
            return false;
        }
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas
            .draw(texture)
            .multiplyAlpha()
            .perspective(before, after)
            .unmultiplyAlpha()
            .update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas.canvas, 0, 0);
        texture.destroy();
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
            });
        }
        return true;
    },
};
