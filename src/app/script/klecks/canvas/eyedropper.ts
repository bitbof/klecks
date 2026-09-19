import { LayerCompositor } from './layer-compositor';
import { isLayerFill, TRgb } from '../kl-types';
import { BB } from '../../bb/bb';
import { THistoryEntryDataComposed } from '../history/history.types';
import { HISTORY_TILE_SIZE } from '../history/kl-history';
import { sortLayerMap } from '../history/sort-layer-map';

export class Eyedropper {
    private canvas?: HTMLCanvasElement;
    private ctx?: CanvasRenderingContext2D;
    private readonly compositor = new LayerCompositor();

    // ----------------------------------- public -----------------------------------
    constructor() {}

    // Reads from history (ImageData) to avoid reading from canvas.
    getColorAt(x: number, y: number, composed: THistoryEntryDataComposed): TRgb {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= composed.size.width || y < 0 || y >= composed.size.height) {
            return new BB.RGB(0, 0, 0);
        }

        const tilesX = Math.ceil(composed.size.width / HISTORY_TILE_SIZE);
        const tileCol = Math.floor(x / HISTORY_TILE_SIZE);
        const tileRow = Math.floor(y / HISTORY_TILE_SIZE);
        const tileIndex = tileRow * tilesX + tileCol;

        this.canvas ??= BB.canvas(1, 1);
        this.ctx ??= BB.ctx(this.canvas);
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 1, 1);
        ctx.imageSmoothingEnabled = false;

        this.compositor.draw(
            ctx,
            Object.values(composed.layerMap).sort(sortLayerMap),
            1,
            1,
            (targetCtx, layer) => {
                const tile = layer.tiles[tileIndex];
                let fillStyle = '';
                if (isLayerFill(tile)) {
                    fillStyle = tile.fill;
                } else {
                    const pixelIndex =
                        (y % HISTORY_TILE_SIZE) * tile.data.width + (x % HISTORY_TILE_SIZE);
                    const alpha = tile.data.data[pixelIndex * 4 + 3];

                    fillStyle = BB.ColorConverter.toRgbaStr({
                        r: tile.data.data[pixelIndex * 4],
                        g: tile.data.data[pixelIndex * 4 + 1],
                        b: tile.data.data[pixelIndex * 4 + 2],
                        a: alpha / 255,
                    });
                }

                targetCtx.fillStyle = fillStyle;
                targetCtx.fillRect(0, 0, 1, 1);
            },
        );
        const imData = ctx.getImageData(0, 0, 1, 1);
        return new BB.RGB(imData.data[0], imData.data[1], imData.data[2]);
    }

    destroy(): void {
        this.compositor.destroy();
        if (this.canvas) {
            BB.freeCanvas(this.canvas);
            this.canvas = undefined;
            this.ctx = undefined;
        }
    }
}
