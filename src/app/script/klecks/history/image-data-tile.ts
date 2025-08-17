import { TImageDataTile } from './history.types';
import { copyImageData } from '../utils/copy-image-data';
import { randomUuid } from '../../bb/base/base';

export function createImageDataTile(data: ImageData): TImageDataTile {
    return {
        id: randomUuid(),
        // timestamp: new Date().getTime(),
        data: data,
    };
}

// copy with different id
export function copyImageDataTile(tile: TImageDataTile): TImageDataTile {
    return {
        id: randomUuid(),
        // timestamp: new Date().getTime(),
        data: copyImageData(tile.data),
    };
}
