import { isLayerFill, TRgb } from '../kl-types';
import { BB } from '../../bb/bb';
import { THistoryEntryDataComposed } from '../history/history.types';
import { HISTORY_TILE_SIZE } from '../history/kl-history';
import { sortLayerMap } from '../history/sort-layer-map';

export class Eyedropper {
    // ----------------------------------- public -----------------------------------
    constructor() {}

    // Reads from history (ImageData) to avoid reading from canvas.
    getColorAt(x: number, y: number, composed: THistoryEntryDataComposed): TRgb {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= composed.size.width || y < 0 || y >= composed.size.height) {
            return new BB.RGB(0, 0, 0);
        }

        const canvas = BB.canvas(1, 1);
        const ctx = BB.ctx(canvas);
        ctx.imageSmoothingEnabled = false;

        const tilesX = Math.ceil(composed.size.width / HISTORY_TILE_SIZE);
        const tileCol = Math.floor(x / HISTORY_TILE_SIZE);
        const tileRow = Math.floor(y / HISTORY_TILE_SIZE);
        const tileIndex = tileRow * tilesX + tileCol;

        Object.values(composed.layerMap)
            .sort(sortLayerMap)
            .forEach((layer) => {
                if (!layer.isVisible || layer.opacity === 0) {
                    return;
                }
                const tile = layer.tiles[tileIndex];
                let fillStyle = '';
                if (isLayerFill(tile)) {
                    fillStyle = tile.fill;
                } else {
                    let tileWidth = HISTORY_TILE_SIZE;
                    if (composed.size.width % HISTORY_TILE_SIZE !== 0 && tileCol === tilesX - 1) {
                        tileWidth = composed.size.width % HISTORY_TILE_SIZE;
                    }
                    const pixelIndex =
                        (y % HISTORY_TILE_SIZE) * tileWidth + (x % HISTORY_TILE_SIZE);

                    if (tile.data.data[pixelIndex * 4 + 3] === 0) {
                        return;
                    }

                    fillStyle = BB.ColorConverter.toRgbaStr({
                        r: tile.data.data[pixelIndex * 4],
                        g: tile.data.data[pixelIndex * 4 + 1],
                        b: tile.data.data[pixelIndex * 4 + 2],
                        a: tile.data.data[pixelIndex * 4 + 3] / 255,
                    });
                }

                ctx.fillStyle = fillStyle;
                ctx.globalAlpha = layer.opacity;
                ctx.globalCompositeOperation = layer.mixModeStr;
                ctx.fillRect(0, 0, 1, 1);
            });

        const imData = ctx.getImageData(0, 0, 1, 1);
        return new BB.RGB(imData.data[0], imData.data[1], imData.data[2]);
    }
}
