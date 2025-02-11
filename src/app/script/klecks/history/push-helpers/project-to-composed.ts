import { IKlProject, isLayerFill } from '../../kl-types';
import { THistoryEntryDataComposed } from '../history.types';
import { canvasToLayerTiles } from './canvas-to-layer-tiles';
import { getNextLayerId } from '../get-next-layer-id';
import { BB } from '../../../bb/bb';

export function projectToComposed(project: IKlProject): THistoryEntryDataComposed {
    let lastId: string = '';
    const layerMap = Object.fromEntries(
        project.layers.map((layer, index) => {
            lastId = getNextLayerId();
            const canvas = (() => {
                if (layer.image instanceof HTMLCanvasElement) {
                    return layer.image;
                }
                const canvas = BB.canvas(project.width, project.height);
                const ctx = BB.ctx(canvas);
                if (isLayerFill(layer.image)) {
                    ctx.fillStyle = layer.image.fill;
                    ctx.fillRect(0, 0, project.width, project.height);
                } else {
                    ctx.drawImage(layer.image, 0, 0);
                }
                return canvas;
            })();
            return [
                lastId,
                {
                    name: layer.name,
                    opacity: layer.opacity,
                    isVisible: layer.isVisible,
                    mixModeStr: layer.mixModeStr ?? 'source-over',
                    index,
                    tiles: canvasToLayerTiles(canvas),
                },
            ];
        }),
    );
    return {
        size: {
            width: project.width,
            height: project.height,
        },
        selection: {},
        activeLayerId: lastId,
        layerMap,
    };
}
