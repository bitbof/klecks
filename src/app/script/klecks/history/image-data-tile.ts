import { TImageDataTile } from './history.types';
import { copyImageData } from '../utils/copy-image-data';
import { randomUuid } from '../../bb/base/base';
import { HISTORY_TILE_SIZE } from './kl-history';

export function createImageDataTile(data: ImageData): TImageDataTile {
    return {
        id: randomUuid(),
        data: data,
    };
}

// copy with different id
export function copyImageDataTile(tile: TImageDataTile): TImageDataTile {
    return {
        id: randomUuid(),
        data: copyImageData(tile.data),
    };
}

export function getTileSize(
    col: number,
    row: number,
    canvasSize: { width: number; height: number },
): { width: number; height: number } {
    const x = col * HISTORY_TILE_SIZE;
    const y = row * HISTORY_TILE_SIZE;
    const width = Math.min(HISTORY_TILE_SIZE, canvasSize.width - x);
    const height = Math.min(HISTORY_TILE_SIZE, canvasSize.height - y);
    if (width <= 0 || height <= 0 || col < 0 || row < 0) {
        throw new Error('invalid out-of-bounds tile');
    }
    return {
        width,
        height,
    };
}

export function getTileSizeFromIndex(
    tileIndex: number,
    canvasSize: { width: number; height: number },
): { width: number; height: number } {
    const tilesPerRow = Math.ceil(canvasSize.width / HISTORY_TILE_SIZE);
    const col = tileIndex % tilesPerRow;
    const row = Math.floor(tileIndex / tilesPerRow);
    return getTileSize(col, row, canvasSize);
}
