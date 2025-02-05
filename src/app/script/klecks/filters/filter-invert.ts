import { getSharedFx } from '../../fx-canvas/shared-fx';
import { IFilterApply } from '../kl-types';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';

export type TFilterInvertInput = null;

export const filterInvert = {
    apply(params: IFilterApply<TFilterInvertInput>): boolean {
        const context = params.layer.context;
        const klHistory = params.klHistory;
        if (!context) {
            return false;
        }

        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false;
        }

        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).invert().update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
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
