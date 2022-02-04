import {BB} from '../../bb/bb';


/**
 * Input processor for shape tool.
 * Coordinates are in canvas space.
 * angleRad is the angle of the canvas.
 *
 * @param p - {onShape: func(isDone, x1, y1, x2, y2, angleRad)}
 * @constructor
 */
export function ShapeTool(p) {

    let downX, downY, downAngleRad;

    this.onDown = function(x, y, angleRad) {
        downX = x;
        downY = y;
        downAngleRad = angleRad;
    };

    this.onMove = function(x, y) {
        p.onShape(false, downX, downY, x, y, downAngleRad);
    };

    this.onUp = function(x, y) {
        p.onShape(true, downX, downY, x, y, downAngleRad);
    };
}

/**
 * Draw a shape (rectangle, ellipse, line)
 * p = {
 *     type: 'rect' | 'ellipse' | 'line',
 *     x1: number,
 *     y1: number,
 *     x2: number,
 *     y2: number,
 *     angleRad: number, // angle of canvas
 *     isOutwards: boolean, // center is x1 y1
 *     opacity: number, // 0-1
 *     isEraser: boolean,
 *     fillRgb?: rgb, // for rect or ellipse
 *     strokeRgb?: rgb, // needed for line
 *     lineWidth?: number, // needed for line
 *     isAngleSnap?: boolean, // 45° angle snapping
 *     isFixedRatio?: boolean, // 1:1 for rect or ellipse
 * }
 *
 * @param ctx
 * @param shapeObj
 */
export function drawShape(ctx, shapeObj) {
    if (['rect', 'ellipse', 'line'].includes(shapeObj.type)) {

        let r1 = BB.rotate(shapeObj.x1, shapeObj.y1, shapeObj.angleRad / Math.PI * 180);
        let r2 = BB.rotate(shapeObj.x2, shapeObj.y2, shapeObj.angleRad / Math.PI * 180);
        r1.x = Math.round(r1.x);
        r1.y = Math.round(r1.y);
        r2.x = Math.round(r2.x);
        r2.y = Math.round(r2.y);

        let x = r1.x;
        let y = r1.y;
        let dX = r2.x - r1.x;
        let dY = r2.y - r1.y;

        if (shapeObj.isAngleSnap) {
            let angleDeg = BB.pointsToAngleDeg(r1, r2) + 90;
            let angleDegSnapped = Math.round(angleDeg / 45) * 45;
            let rotated = BB.rotate(dX, dY, angleDegSnapped - angleDeg);
            dX = rotated.x;
            dY = rotated.y;
        }

        if (shapeObj.type !== 'line' && shapeObj.isFixedRatio) {
            if (Math.abs(dX) < Math.abs(dY)) {
                dY = Math.abs(dX) * (dY < 0 ? -1 : 1);
            } else {
                dX = Math.abs(dY) * (dX < 0 ? -1 : 1);
            }
        }

        if (shapeObj.isOutwards) {
            x -= dX;
            y -= dY;
            dX *= 2;
            dY *= 2;
        }

        ctx.save();
        if (shapeObj.opacity) {
            ctx.globalAlpha = shapeObj.opacity;
        }
        if (shapeObj.isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
        }
        ctx.rotate(-shapeObj.angleRad);
        if (shapeObj.fillRgb) {
            ctx.fillStyle = BB.ColorConverter.toRgbStr(shapeObj.fillRgb);

            if (shapeObj.type === 'rect') {
                ctx.fillRect(x, y, dX, dY);
            } else if (shapeObj.type === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(x + dX / 2, y + dY / 2, Math.abs(dX / 2), Math.abs(dY / 2), 0, 0, Math.PI * 2);
                ctx.fill();
            }

        } else if (shapeObj.strokeRgb) {
            ctx.strokeStyle = BB.ColorConverter.toRgbStr(shapeObj.strokeRgb);
            ctx.lineWidth = Math.round(shapeObj.lineWidth);

            if (shapeObj.type === 'rect') {
                ctx.strokeRect(x, y, dX, dY);
            } else if (shapeObj.type === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(x + dX / 2, y + dY / 2, Math.abs(dX / 2), Math.abs(dY / 2), 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (shapeObj.type === 'line') {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + dX, y + dY);
                ctx.stroke();
            }
        }
        ctx.restore();

    } else {
        throw new Error('unknown shape');
    }
}