import { TRect, TVector2D } from '../../../../bb/bb-types';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { Cropper, TCropperParams } from './cropper';
import { Vec2 } from '../../../../bb/math/vec2';
import { clamp } from '../../../../bb/math/math';

type TCorners = {
    // top left
    tl: TVector2D;
    // bottom right
    br: TVector2D;
};

function cornersToRect({ tl, br }: TCorners): TRect {
    return {
        x: tl.x,
        y: tl.y,
        width: br.x - tl.x,
        height: br.y - tl.y,
    };
}

function rectToCorners(rect: TRect): TCorners {
    return {
        tl: { x: rect.x, y: rect.y },
        br: { x: rect.x + rect.width, y: rect.y + rect.height },
    };
}

type TSizeOptions = {
    maxWidth: number;
    maxHeight: number;
};
const minSize = 1;

function resizeTop(corners: TCorners, d: TVector2D, { maxHeight }: TSizeOptions): TCorners {
    const y = clamp(corners.tl.y + d.y, corners.br.y - maxHeight, corners.br.y - minSize);
    return {
        tl: { x: corners.tl.x, y },
        br: corners.br,
    };
}

function resizeBottom(corners: TCorners, d: TVector2D, { maxHeight }: TSizeOptions): TCorners {
    const y = clamp(corners.br.y + d.y, corners.tl.y + minSize, corners.tl.y + maxHeight);
    return {
        tl: corners.tl,
        br: { x: corners.br.x, y },
    };
}

function resizeLeft(corners: TCorners, d: TVector2D, { maxWidth }: TSizeOptions): TCorners {
    const x = clamp(corners.tl.x + d.x, corners.br.x - maxWidth, corners.br.x - minSize);
    return {
        tl: { x, y: corners.tl.y },
        br: corners.br,
    };
}

function resizeRight(corners: TCorners, d: TVector2D, { maxWidth }: TSizeOptions): TCorners {
    const x = clamp(corners.br.x + d.x, corners.tl.x + minSize, corners.tl.x + maxWidth);
    return {
        tl: corners.tl,
        br: { x, y: corners.br.y },
    };
}

function resizeWidth(corners: TCorners, dWidth: number, { maxWidth }: TSizeOptions): TCorners {
    const centerX = (corners.tl.x + corners.br.x) / 2;
    const width = clamp(corners.br.x - corners.tl.x + dWidth, minSize, maxWidth);
    return {
        tl: { x: centerX - width / 2, y: corners.tl.y },
        br: { x: centerX + width / 2, y: corners.br.y },
    };
}

function resizeHeight(corners: TCorners, dHeight: number, { maxHeight }: TSizeOptions): TCorners {
    const centerY = (corners.tl.y + corners.br.y) / 2;
    const height = clamp(corners.br.y - corners.tl.y + dHeight, minSize, maxHeight);
    return {
        tl: { x: corners.tl.x, y: centerY - height / 2 },
        br: { x: corners.br.x, y: centerY + height / 2 },
    };
}

export type TViewportCropperParams = Omit<TCropperParams, 'processEvent' | 'toRendered'> & {
    viewportTransform: TViewportTransform;
    maxWidth: number;
    maxHeight: number;
};

export class ViewportCropper extends Cropper {
    private cropCorners: TCorners;
    private viewportTransform: TViewportTransform;

    constructor(p: TViewportCropperParams) {
        const options = { maxWidth: p.maxWidth, maxHeight: p.maxHeight };
        let wasSymmetric = false;
        super({
            ...p,
            processEvent: (change) => {
                if (change.type === 'start') {
                    const value = this.getValue();
                    this.cropCorners = rectToCorners(value);
                    return value;
                }
                // no rotation for now
                const dX = change.dX / this.viewportTransform.scale;
                const dY = change.dY / this.viewportTransform.scale;
                const d: TVector2D = { x: dX, y: dY };
                if (change.type === 'move') {
                    this.cropCorners = {
                        tl: Vec2.add(this.cropCorners.tl, d),
                        br: Vec2.add(this.cropCorners.br, d),
                    };
                } else if (change.type === 'resize') {
                    if (change.isSymmetric && !wasSymmetric) {
                        // else they're not in sync
                        this.cropCorners = rectToCorners(this.getValue());
                    }
                    wasSymmetric = change.isSymmetric;

                    if (change.direction.includes('w')) {
                        if (change.isSymmetric) {
                            this.cropCorners = resizeWidth(this.cropCorners, -2 * d.x, options);
                        } else {
                            this.cropCorners = resizeLeft(this.cropCorners, d, options);
                        }
                    } else if (change.direction.includes('e')) {
                        if (change.isSymmetric) {
                            this.cropCorners = resizeWidth(this.cropCorners, 2 * d.x, options);
                        } else {
                            this.cropCorners = resizeRight(this.cropCorners, d, options);
                        }
                    }
                    if (change.direction.includes('n')) {
                        if (change.isSymmetric) {
                            this.cropCorners = resizeHeight(this.cropCorners, -2 * d.y, options);
                        } else {
                            this.cropCorners = resizeTop(this.cropCorners, d, options);
                        }
                    } else if (change.direction.includes('s')) {
                        if (change.isSymmetric) {
                            this.cropCorners = resizeHeight(this.cropCorners, 2 * d.y, options);
                        } else {
                            this.cropCorners = resizeBottom(this.cropCorners, d, options);
                        }
                    }
                }
                const roundedCrop: TCorners = {
                    tl: {
                        x: Math.round(this.cropCorners.tl.x),
                        y: Math.round(this.cropCorners.tl.y),
                    },
                    br: {
                        x: Math.round(this.cropCorners.br.x),
                        y: Math.round(this.cropCorners.br.y),
                    },
                };
                return cornersToRect(roundedCrop);
            },
            toRendered: (crop: TRect): TRect => {
                const transform = this.viewportTransform;
                return {
                    x: transform.x + crop.x * transform.scale,
                    y: transform.y + crop.y * transform.scale,
                    width: crop.width * transform.scale,
                    height: crop.height * transform.scale,
                };
            },
        });
        this.viewportTransform = p.viewportTransform;
        this.cropCorners = rectToCorners(p.value);
        this.render();
    }

    setViewportTransform(viewportTransform: TViewportTransform): void {
        this.viewportTransform = { ...viewportTransform };
        this.render();
    }
}
