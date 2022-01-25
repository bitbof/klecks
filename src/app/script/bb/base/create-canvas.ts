export function createCanvas(w?: number, h?: number): HTMLCanvasElement {
    const result = document.createElement('canvas');
    if (w && h) {
        result.width = w;
        result.height = h;
    }
    return result;
}