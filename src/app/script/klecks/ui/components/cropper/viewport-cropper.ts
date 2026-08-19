import { BB } from '../../../../bb/bb';
import { TRect } from '../../../../bb/bb-types';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { Cropper, TCropperChange, TCropperParams, TResizeDirection } from './cropper';

function constrainAndSnap(
    cropFloat: TRect,
    lastCrop: TRect,
    direction: TResizeDirection | undefined, // undefined = move
    minWidth: number,
    minHeight: number,
    maxWidth: number,
    maxHeight: number,
): TRect {
    const isRightEdgeFixed = direction ? direction.includes('w') : false;
    const isLeftEdgeFixed = direction ? direction.includes('e') : false;
    const isBottomEdgeFixed = direction ? direction.includes('n') : false;
    const isTopEdgeFixed = direction ? direction.includes('s') : false;

    let x1 = isLeftEdgeFixed ? lastCrop.x : Math.round(cropFloat.x);
    let y1 = isTopEdgeFixed ? lastCrop.y : Math.round(cropFloat.y);
    let x2 = isRightEdgeFixed ? lastCrop.x + lastCrop.width : x1 + Math.round(cropFloat.width);
    let y2 = isBottomEdgeFixed ? lastCrop.y + lastCrop.height : y1 + Math.round(cropFloat.height);

    const width = BB.clamp(x2 - x1, minWidth, maxWidth);
    const height = BB.clamp(y2 - y1, minHeight, maxHeight);

    if (isRightEdgeFixed) {
        x1 = x2 - width;
    } else {
        x2 = x1 + width;
    }
    if (isBottomEdgeFixed) {
        y1 = y2 - height;
    } else {
        y2 = y1 + height;
    }

    return {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
    };
}

type TViewportCropperState = {
    viewportTransform: TViewportTransform;
    // raw crop in canvas coordinates, accumulates deltas, may have fractional parts
    cropFloat: TRect;
    // constrained, pixel grid snapped crop in canvas coordinates
    lastCrop: TRect;
};

export type TViewportCropperParams = Omit<TCropperParams, 'processChange' | 'toRendered'> & {
    viewportTransform: TViewportTransform;
    minWidth?: number; // default 1
    minHeight?: number; // default 1
    maxWidth?: number; // default Infinity
    maxHeight?: number; // default Infinity
};

export class ViewportCropper extends Cropper {
    private readonly state: TViewportCropperState;

    constructor(p: TViewportCropperParams) {
        const minWidth = Math.max(0, p.minWidth ?? 1);
        const minHeight = Math.max(0, p.minHeight ?? 1);
        const maxWidth = Math.max(minWidth, p.maxWidth ?? Infinity);
        const maxHeight = Math.max(minHeight, p.maxHeight ?? Infinity);
        const state: TViewportCropperState = {
            viewportTransform: { ...p.viewportTransform },
            cropFloat: { ...p.value },
            lastCrop: { ...p.value },
        };

        super({
            ...p,
            processChange: (change: TCropperChange): TRect => {
                if (change.type === 'down' || change.type === 'up') {
                    // commit: reset integer parts to the constrained crop, keep fractional remainders
                    // so sub pixel movement can still accumulate over multiple gestures
                    state.cropFloat = {
                        x: state.lastCrop.x + (state.cropFloat.x - Math.round(state.cropFloat.x)),
                        y: state.lastCrop.y + (state.cropFloat.y - Math.round(state.cropFloat.y)),
                        width:
                            state.lastCrop.width +
                            (state.cropFloat.width - Math.round(state.cropFloat.width)),
                        height:
                            state.lastCrop.height +
                            (state.cropFloat.height - Math.round(state.cropFloat.height)),
                    };
                    return { ...state.lastCrop };
                }

                const scale = state.viewportTransform.scale;
                const dX = change.dX / scale;
                const dY = change.dY / scale;

                if (change.type === 'move') {
                    state.cropFloat.x += dX;
                    state.cropFloat.y += dY;
                } else {
                    const rect = state.cropFloat;
                    if (change.direction.includes('n')) {
                        const bottom = rect.y + rect.height;
                        rect.height = Math.max(0, rect.height - dY);
                        rect.y = bottom - rect.height;
                    }
                    if (change.direction.includes('e')) {
                        rect.width = Math.max(0, rect.width + dX);
                    }
                    if (change.direction.includes('s')) {
                        rect.height = Math.max(0, rect.height + dY);
                    }
                    if (change.direction.includes('w')) {
                        const right = rect.x + rect.width;
                        rect.width = Math.max(0, rect.width - dX);
                        rect.x = right - rect.width;
                    }
                }

                state.lastCrop = constrainAndSnap(
                    state.cropFloat,
                    state.lastCrop,
                    change.type === 'resize' ? change.direction : undefined,
                    minWidth,
                    minHeight,
                    maxWidth,
                    maxHeight,
                );
                return { ...state.lastCrop };
            },
            toRendered: (crop: TRect): TRect => {
                return {
                    x: state.viewportTransform.x + crop.x * state.viewportTransform.scale,
                    y: state.viewportTransform.y + crop.y * state.viewportTransform.scale,
                    width: crop.width * state.viewportTransform.scale,
                    height: crop.height * state.viewportTransform.scale,
                };
            },
        });

        this.state = state;
    }

    setViewportTransform(viewportTransform: TViewportTransform): void {
        this.state.viewportTransform = { ...viewportTransform };
        this.render();
    }

    setValue(value: TRect): void {
        this.state.cropFloat = { ...value };
        this.state.lastCrop = { ...value };
        super.setValue(value);
    }
}
