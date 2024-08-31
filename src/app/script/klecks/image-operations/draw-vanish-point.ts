import { drawShape } from './shape-tool';
import { BB } from '../../bb/bb';
import { IRGB } from '../kl-types';

export function drawVanishPoint(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    lines: number, // int, [2, inf]
    thickness: number, // px
    color: IRGB,
    opacity: number, // 0 - 1
): void {
    ctx.save();

    const degIncrement = 180 / lines;
    for (let deg = 0; deg < 180; deg += degIncrement) {
        const p2 = BB.rotateAround({ x, y }, { x: x + 9999, y }, deg);
        drawShape(ctx, {
            type: 'line',
            x1: x,
            y1: y,
            x2: p2.x,
            y2: p2.y,
            //angleRad: 0,
            isOutwards: true,
            opacity,
            //isEraser: false,
            strokeRgb: color,
            lineWidth: thickness,
            //doLockAlpha: false,
        });
    }

    ctx.restore();
}
