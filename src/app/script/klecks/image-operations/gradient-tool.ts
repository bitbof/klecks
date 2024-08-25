import { IGradient, IRGBA } from '../kl-types';
import { BB } from '../../bb/bb';

type TOnGradient = (
    isDone: boolean,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    angleRad: number,
) => void;

/**
 * Input processor for gradient tool.
 * Coordinates are in canvas space.
 * angleRad is the angle of the canvas.
 */
export class GradientTool {
    private downX: number = 0;
    private downY: number = 0;
    private downAngleRad: number = 0;
    private readonly onGradient: TOnGradient;

    // ----------------------------------- public -----------------------------------
    constructor(p: { onGradient: TOnGradient }) {
        this.onGradient = p.onGradient;
    }

    onDown(x: number, y: number, angleRad: number): void {
        this.downX = x;
        this.downY = y;
        this.downAngleRad = angleRad;
    }

    onMove(x: number, y: number): void {
        this.onGradient(false, this.downX, this.downY, x, y, this.downAngleRad);
    }

    onUp(x: number, y: number): void {
        this.onGradient(true, this.downX, this.downY, x, y, this.downAngleRad);
    }
}

export function drawGradient(ctx: CanvasRenderingContext2D, gradientObj: IGradient): void {
    ctx.save();

    const x1 = gradientObj.x1;
    const y1 = gradientObj.y1;
    let x2 = gradientObj.x2;
    let y2 = gradientObj.y2;

    if (gradientObj.doSnap) {
        const angleDeg = (gradientObj.angleRad * 180) / Math.PI;

        const r1 = BB.rotate(x1, y1, (gradientObj.angleRad / Math.PI) * 180);
        const r2 = BB.rotate(x2, y2, (gradientObj.angleRad / Math.PI) * 180);

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

    let baseColor = gradientObj.color1;
    if (gradientObj.isEraser && gradientObj.doLockAlpha) {
        baseColor = { r: 255, g: 255, b: 255 };
    }
    let color1: IRGBA = {
        ...baseColor,
        a: gradientObj.opacity,
    };
    let color2: IRGBA = {
        ...baseColor,
        a: 0,
    };
    if (gradientObj.isReversed) {
        const temp = color1;
        color1 = color2;
        color2 = temp;
    }

    let gradient: CanvasGradient;
    if (gradientObj.type === 'linear') {
        gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, BB.ColorConverter.toRgbaStr(color1));
        gradient.addColorStop(1, BB.ColorConverter.toRgbaStr(color2));
    } else if (gradientObj.type === 'linear-mirror') {
        const d = {
            x: x2 - x1,
            y: y2 - y1,
        };
        gradient = ctx.createLinearGradient(x1 - d.x, y1 - d.y, x2, y2);
        gradient.addColorStop(0, BB.ColorConverter.toRgbaStr(color2));
        gradient.addColorStop(0.5, BB.ColorConverter.toRgbaStr(color1));
        gradient.addColorStop(1, BB.ColorConverter.toRgbaStr(color2));
    } else if (gradientObj.type === 'radial') {
        const r = BB.Vec2.dist({ x: x1, y: y1 }, { x: x2, y: y2 });
        gradient = ctx.createRadialGradient(x1, y1, 0, x1, y1, r);
        gradient.addColorStop(0, BB.ColorConverter.toRgbaStr(color1));
        gradient.addColorStop(1, BB.ColorConverter.toRgbaStr(color2));
    }

    ctx.fillStyle = gradient!;
    if (gradientObj.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
    }
    if (gradientObj.doLockAlpha) {
        ctx.globalCompositeOperation = 'source-atop';
    }
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.restore();
}
