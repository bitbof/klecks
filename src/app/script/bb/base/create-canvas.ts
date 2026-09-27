import { CANVAS_DEBUG_HOOKS } from './canvas-debug-hooks';

export function createCanvas(): HTMLCanvasElement;
export function createCanvas(w: number, h: number): HTMLCanvasElement;
export function createCanvas(w?: number, h?: number): HTMLCanvasElement {
    const result = document.createElement('canvas');
    if (w !== undefined && h !== undefined) {
        result.width = w;
        result.height = h;
    }
    CANVAS_DEBUG_HOOKS.onCreate?.(result);
    return result;
}
