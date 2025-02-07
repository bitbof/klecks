import { IRGB } from '../kl-types';
import { BB } from '../../bb/bb';
import { THistoryEntryDataComposed } from '../history/history.types';
import { HISTORY_TILE_SIZE } from '../history/kl-history';

export class Eyedropper {
    // ----------------------------------- public -----------------------------------
    constructor() {}

    // Reads from history (ImageData) to avoid reading from canvas.
    getColorAt(x: number, y: number, composed: THistoryEntryDataComposed): IRGB {
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
            .sort((a, b) => {
                if (a.index > b.index) {
                    return 1;
                }
                if (a.index < b.index) {
                    return -1;
                }
                return 0;
            })
            .forEach((layer) => {
                if (!layer.isVisible || layer.opacity === 0) {
                    return;
                }
                const tile = layer.tiles[tileIndex];
                let fillStyle = '';
                if (tile instanceof ImageData) {
                    let tileWidth = HISTORY_TILE_SIZE;
                    if (composed.size.width % HISTORY_TILE_SIZE !== 0 && tileCol === tilesX - 1) {
                        tileWidth = composed.size.width % HISTORY_TILE_SIZE;
                    }
                    const pixelIndex =
                        (y % HISTORY_TILE_SIZE) * tileWidth + (x % HISTORY_TILE_SIZE);

                    if (tile.data[pixelIndex * 4 + 3] === 0) {
                        return;
                    }

                    fillStyle = BB.ColorConverter.toRgbaStr({
                        r: tile.data[pixelIndex * 4],
                        g: tile.data[pixelIndex * 4 + 1],
                        b: tile.data[pixelIndex * 4 + 2],
                        a: tile.data[pixelIndex * 4 + 3],
                    });
                } else {
                    fillStyle = tile.fill;
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
