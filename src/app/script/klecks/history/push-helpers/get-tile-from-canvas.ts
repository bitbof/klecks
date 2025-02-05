export function getTileFromCanvas(
    canvas: HTMLCanvasElement,
    col: number,
    row: number,
    tileSize: number,
) {
    const ctx = canvas.getContext('2d')!;

    const width = Math.min(canvas.width, (col + 1) * tileSize) - col * tileSize;
    const height = Math.min(canvas.height, (row + 1) * tileSize) - row * tileSize;

    if (width <= 0 || height <= 0) {
        return new ImageData(0, 0);
    }

    return ctx.getImageData(col * tileSize, row * tileSize, width, height);
}
