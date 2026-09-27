// if you want to debug canvas memory usage and churn
export const CANVAS_DEBUG_HOOKS: {
    onCreate?: (canvas: HTMLCanvasElement) => void;
    onResize?: (canvas: HTMLCanvasElement, oldWidth: number, oldHeight: number) => void;
} = {};
