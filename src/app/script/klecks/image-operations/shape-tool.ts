import { BB } from '../../bb/bb';
import { IRGB, IShapeToolObject } from '../kl-types';

/**
 * Input processor for shape tool.
 * Coordinates are in canvas space.
 * angleRad is the angle of the canvas.
 */
export class ShapeTool {
    private readonly onShape: (
        isDone: boolean,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        angleRad: number,
    ) => void;
    private downX: number = 0;
    private downY: number = 0;
    private downAngleRad: number = 0;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        onShape: (
            isDone: boolean,
            x1: number,
            y1: number,
            x2: number,
            y2: number,
            angleRad: number,
        ) => void;
    }) {
        this.onShape = p.onShape;
    }

    onDown(x: number, y: number, angleRad: number): void {
        this.downX = x;
        this.downY = y;
        this.downAngleRad = angleRad;
    }

    onMove(x: number, y: number): void {
        this.onShape(false, this.downX, this.downY, x, y, this.downAngleRad);
    }

    onUp(x: number, y: number): void {
        this.onShape(true, this.downX, this.downY, x, y, this.downAngleRad);
    }
}

/**
 * Draw a shape (rectangle, ellipse, line)
 */
export function drawShape(ctx: CanvasRenderingContext2D, shapeObj: IShapeToolObject): void {
    shapeObj = {
        // defaults
        angleRad: 0,
        isOutwards: false,
        opacity: 1,
        isEraser: false,
        doLockAlpha: false,

        ...BB.copyObj(shapeObj),
    };

    if (['rect', 'ellipse', 'line'].includes(shapeObj.type)) {
        if (shapeObj.angleRad === undefined) {
            throw new Error('angleRad undefined');
        }

        const lineWidth = shapeObj.lineWidth === undefined ? -1 : Math.round(shapeObj.lineWidth);
        const angleDeg = (shapeObj.angleRad * 180) / Math.PI;

        // --- prep color ---
        if (
            !shapeObj.isEraser &&
            shapeObj.fillRgb === undefined &&
            shapeObj.strokeRgb === undefined
        ) {
            throw new Error('fillRgb and strokeRgb undefined');
        }
        const colorRGB: IRGB = shapeObj.isEraser
            ? { r: 255, g: 255, b: 255 }
            : shapeObj.fillRgb
              ? shapeObj.fillRgb
              : shapeObj.strokeRgb!;

        // --- prep canvas ---
        ctx.save();
        if (shapeObj.opacity) {
            ctx.globalAlpha = shapeObj.opacity;
        }
        if (shapeObj.isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
        }
        if (shapeObj.doLockAlpha) {
            ctx.globalCompositeOperation = 'source-atop';
        }
        ctx.rotate(-shapeObj.angleRad);
        if (shapeObj.fillRgb) {
            ctx.fillStyle = BB.ColorConverter.toRgbStr(colorRGB);
        } else if (shapeObj.strokeRgb) {
            ctx.strokeStyle = BB.ColorConverter.toRgbStr(colorRGB);
            ctx.lineWidth = lineWidth;
        }

        let x1 = shapeObj.x1;
        let y1 = shapeObj.y1;
        let x2 = shapeObj.x2;
        let y2 = shapeObj.y2;

        // --- angle snapping ---
        if (shapeObj.isAngleSnap) {
            const r1 = BB.rotate(x1, y1, (shapeObj.angleRad / Math.PI) * 180);
            const r2 = BB.rotate(x2, y2, (shapeObj.angleRad / Math.PI) * 180);

            const pAngleDeg = BB.pointsToAngleDeg(r1, r2) + 90;
            const pAngleDegSnapped = Math.round(pAngleDeg / 45) * 45;
            const rotated = BB.rotateAround(
                { x: x1, y: y1 },
                { x: x2, y: y2 },
                pAngleDegSnapped - pAngleDeg,
            );
            x2 = rotated.x;
            y2 = rotated.y;

            // needs to be perfect if p1->p2 aligns with canvas x- or y-axis
            if ((angleDeg + pAngleDegSnapped) % 90 === 0) {
                if (Math.round((angleDeg - pAngleDegSnapped) / 90) % 2 === 0) {
                    // up or down
                    x2 = x1;
                } else {
                    // left or right
                    y2 = y1;
                }
            }
        }

        let x = x1;
        let y = y1;
        let dX = x2 - x1;
        let dY = y2 - y1;

        // --- 1:1 ratio ---
        if (shapeObj.type !== 'line' && shapeObj.isFixedRatio) {
            let r1 = BB.rotate(shapeObj.x1, shapeObj.y1, (shapeObj.angleRad / Math.PI) * 180);
            let r2 = BB.rotate(shapeObj.x2, shapeObj.y2, (shapeObj.angleRad / Math.PI) * 180);

            const rx = r1.x;
            const ry = r1.y;
            let rdX = r2.x - r1.x;
            let rdY = r2.y - r1.y;

            if (Math.abs(rdX) < Math.abs(rdY)) {
                rdY = Math.abs(rdX) * (rdY < 0 ? -1 : 1);
            } else {
                rdX = Math.abs(rdY) * (rdX < 0 ? -1 : 1);
            }
            r2.x = rx + rdX;
            r2.y = ry + rdY;

            r1 = BB.rotate(r1.x, r1.y, (-shapeObj.angleRad / Math.PI) * 180);
            r2 = BB.rotate(r2.x, r2.y, (-shapeObj.angleRad / Math.PI) * 180);

            x1 = r1.x;
            y1 = r1.y;
            x2 = r2.x;
            y2 = r2.y;

            x = x1;
            y = y1;
            dX = x2 - x1;
            dY = y2 - y1;
        }

        // outwards modifier
        if (shapeObj.isOutwards) {
            x -= dX;
            y -= dY;
            dX *= 2;
            dY *= 2;

            x1 = x;
            y1 = y;
            x2 = x + dX;
            y2 = y + dY;
        }

        let p1;
        let p2;
        if (shapeObj.type === 'line') {
            // --- line ---

            // rounded
            const x1r = Math.round(x1);
            const y1r = Math.round(y1);
            const x2r = Math.round(x2);
            const y2r = Math.round(y2);

            // floored
            const x1f = Math.floor(x1);
            const y1f = Math.floor(y1);
            const x2f = Math.floor(x2);
            const y2f = Math.floor(y2);

            if (lineWidth % 2 === 0) {
                if (y1r === y2r) {
                    p1 = {
                        x: x1f,
                        y: y1r,
                    };
                    p2 = {
                        x: x2f,
                        y: y2r,
                    };

                    if (x1f < x2f) {
                        p2.x += 1;
                    } else {
                        p1.x += 1;
                    }
                } else if (x1r === x2r) {
                    p1 = {
                        x: x1r,
                        y: y1f,
                    };
                    p2 = {
                        x: x2r,
                        y: y2f,
                    };

                    if (y1f < y2f) {
                        p2.y += 1;
                    } else {
                        p1.y += 1;
                    }
                } else {
                    p1 = {
                        x: x1,
                        y: y1,
                    };
                    p2 = {
                        x: x2,
                        y: y2,
                    };
                }
            } else {
                p1 = {
                    x: x1f,
                    y: y1f,
                };
                p2 = {
                    x: x2f,
                    y: y2f,
                };
                if (y1f === y2f) {
                    if (x1f < x2f) {
                        p2.x += 1;
                    } else {
                        p1.x += 1;
                    }
                    p1.y += 0.5;
                    p2.y += 0.5;
                } else if (x1f === x2f) {
                    if (y1f < y2f) {
                        p2.y += 1;
                    } else {
                        p1.y += 1;
                    }
                    p1.x += 0.5;
                    p2.x += 0.5;
                } else {
                    p1.x = x1;
                    p1.y = y1;
                    p2.x = x2;
                    p2.y = y2;
                }
            }

            p1 = BB.rotate(p1.x, p1.y, (shapeObj.angleRad / Math.PI) * 180);
            p2 = BB.rotate(p2.x, p2.y, (shapeObj.angleRad / Math.PI) * 180);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        } else if (shapeObj.type === 'rect') {
            // --- rect ---

            // floored
            const x1f = Math.floor(x1);
            const y1f = Math.floor(y1);
            const x2f = Math.floor(x2);
            const y2f = Math.floor(y2);

            if (angleDeg % 90 === 0) {
                if (shapeObj.fillRgb) {
                    if (x1 % 1 === 0) {
                        x1 += 1;
                    }
                    if (y1 % 1 === 0) {
                        y1 += 1;
                    }
                    if (x2 % 1 === 0) {
                        x2 += 1;
                    }
                    if (y2 % 1 === 0) {
                        y2 += 1;
                    }

                    p1 = {
                        x: x1 < x2 ? x1f : x2f,
                        y: y1 < y2 ? y1f : y2f,
                    };
                    p2 = {
                        x: Math.ceil((x1 < x2 ? x2 : x1) - p1.x),
                        y: Math.ceil((y1 < y2 ? y2 : y1) - p1.y),
                    };
                    p2.x = p1.x + p2.x;
                    p2.y = p1.y + p2.y;
                } else {
                    if (lineWidth % 2 === 0) {
                        p1 = {
                            x: x1f,
                            y: y1f,
                        };
                        p2 = {
                            x: x2f,
                            y: y2f,
                        };
                    } else {
                        p1 = {
                            x: x1f + 0.5,
                            y: y1f + 0.5,
                        };
                        p2 = {
                            x: x2f + 0.5,
                            y: y2f + 0.5,
                        };
                    }
                }
            } else {
                p1 = {
                    x: x1,
                    y: y1,
                };
                p2 = {
                    x: x2,
                    y: y2,
                };
            }

            p1 = BB.rotate(p1.x, p1.y, (shapeObj.angleRad / Math.PI) * 180);
            p2 = BB.rotate(p2.x, p2.y, (shapeObj.angleRad / Math.PI) * 180);
            p2.x = p2.x - p1.x;
            p2.y = p2.y - p1.y;

            if (shapeObj.fillRgb) {
                ctx.fillRect(p1.x, p1.y, p2.x, p2.y);
            } else {
                ctx.strokeRect(p1.x, p1.y, p2.x, p2.y);
            }
        } else {
            // --- circle ---
            p1 = BB.rotate(x1, y1, (shapeObj.angleRad / Math.PI) * 180);
            p2 = BB.rotate(x2, y2, (shapeObj.angleRad / Math.PI) * 180);
            x = p1.x;
            y = p1.y;
            dX = p2.x - p1.x;
            dY = p2.y - p1.y;

            ctx.beginPath();
            ctx.ellipse(
                x + dX / 2,
                y + dY / 2,
                Math.abs(dX / 2),
                Math.abs(dY / 2),
                0,
                0,
                Math.PI * 2,
            );
            if (shapeObj.fillRgb) {
                ctx.fill();
            } else {
                ctx.stroke();
            }
        }

        ctx.restore();
    } else {
        throw new Error('unknown shape');
    }
}
