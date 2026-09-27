import { ctx } from './canvas';
import { CANVAS_DEBUG_HOOKS } from './canvas-debug-hooks';

// by default only resizes if size is different
export function changeCanvasDimensions(
    canvas: HTMLCanvasElement,
    width?: number,
    height?: number,
    options?: {
        doForce?: boolean;
        ensureCleared?: boolean;
    },
): void {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    if (options?.doForce) {
        canvas.width = width ?? canvas.width;
        canvas.height = height ?? canvas.height;
    } else {
        let didChange = false;
        if (width !== undefined && width !== canvas.width) {
            canvas.width = width;
            didChange = true;
        }
        if (height !== undefined && height !== canvas.height) {
            canvas.height = height;
            didChange = true;
        }
        if (options?.ensureCleared && !didChange) {
            ctx(canvas).clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    CANVAS_DEBUG_HOOKS.onResize?.(canvas, oldWidth, oldHeight);
}
