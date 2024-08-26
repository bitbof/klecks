import { BB } from '../../bb/bb';
import { getSharedFx } from '../../fx-canvas/shared-fx';
import { IFilterApply, IFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { LANG } from '../../language/language';
import { TwoTabs } from '../ui/components/two-tabs';
import { TRectanglePoints } from '../../fx-canvas/filters/perspective';
import { TFilterHistoryEntry } from './filters';
import { applyToPoint, Matrix } from 'transformation-matrix';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { throwIfNull, throwIfUndefined } from '../../bb/base/base';
import { DraggableInput } from '../ui/components/draggable-input';
import { testIsSmall } from '../ui/utils/test-is-small';
import { getPreviewHeight, getPreviewWidth, mediumPreview } from '../ui/utils/preview-size';

export type TFilterPerspectiveInput = {
    before: TRectanglePoints;
    after: TRectanglePoints;
};

export type TFilterPerspectiveHistoryEntry = TFilterHistoryEntry<
    'perspective',
    TFilterPerspectiveInput
>;

export const filterPerspective = {
    getDialog(params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const isSmall = testIsSmall();
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterPerspectiveInput> = {
            element: rootEl,
        };
        if (!isSmall) {
            result.width = mediumPreview.width;
        }

        function finishInit(): void {
            const fxCanvas = throwIfNull(getSharedFx());
            const texture = throwIfUndefined(fxCanvas?.texture(context.canvas));

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
                { x: context.canvas.width, y: 0 },
                { x: context.canvas.width, y: context.canvas.height },
                { x: 0, y: context.canvas.height },
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
                        image: i === selectedLayerIndex ? fxCanvas : layers[i].context.canvas,
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
                onTransformChange: (transform) => {
                    beforeInputs.forEach((item) => item.setTransform(transform));
                    afterInputs.forEach((item) => item.setTransform(transform));
                },
            });
            BB.css(preview.getElement(), {
                overflow: 'hidden',
                marginLeft: '-20px',
                marginRight: '-20px',
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
                texture.destroy;
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
        }

        setTimeout(finishInit, 1);

        return result;
    },

    apply(params: IFilterApply<TFilterPerspectiveInput>): boolean {
        const context = params.context;
        const history = params.history;
        const before = params.input.before;
        const after = params.input.after;
        if (!context || !before || !after) {
            return false;
        }
        history?.pause(true);
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
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history?.pause(false);
        history?.push({
            tool: ['filter', 'perspective'],
            action: 'apply',
            params: [
                {
                    input: params.input,
                },
            ],
        } as TFilterPerspectiveHistoryEntry);
        return true;
    },
};
