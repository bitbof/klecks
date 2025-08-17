import { BB } from '../../../bb/bb';

export function getTileFromCanvas(
    canvas: HTMLCanvasElement,
    col: number,
    row: number,
    tileSize: number,
) {
    const ctx = BB.ctx(canvas);

    const width = Math.min(canvas.width, (col + 1) * tileSize) - col * tileSize;
    const height = Math.min(canvas.height, (row + 1) * tileSize) - row * tileSize;

    if (width <= 0 || height <= 0) {
        throw new Error('invalid out-of-bounds tile');
    }

    return ctx.getImageData(col * tileSize, row * tileSize, width, height);
}
