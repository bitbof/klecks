import { BB } from '../../bb/bb';
import { IBounds, IRect } from '../../bb/bb-types';
import { IRGBA } from '../kl-types';

export type TTextFormat = 'left' | 'center' | 'right';
export type TTextFont = 'serif' | 'monospace' | 'sans-serif' | 'cursive' | 'fantasy' | string;

export type TRenderTextParam = {
    text: string; // text to be drawn. can contain newlines

    x: number;
    y: number;
    angleRad: number;
    size: number; // px
    align: TTextFormat;
    isBold: boolean;
    isItalic: boolean;
    font: TTextFont;
    letterSpacing?: number;
    lineHeight?: number; // em
    fill?: {
        color: IRGBA;
    };
    stroke?: {
        color: IRGBA;
        lineWidth: number;
    };
};

function textMetricToRect(metrics: TextMetrics, align: TTextFormat): IRect {
    // fallback for older browsers
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;

    if (align === 'left') {
        return {
            x: 0,
            y: -ascent,
            width: metrics.width,
            height: ascent + descent,
        };
    }
    if (align === 'right') {
        return {
            x: -metrics.width,
            y: -ascent,
            width: metrics.width,
            height: ascent + descent,
        };
    }
    // center
    return {
        x: -metrics.width / 2,
        y: -ascent,
        width: metrics.width,
        height: ascent + descent,
    };
}

/**
 * Draws text on a canvas.
 * Return bounds, relative to p.x, p.y.
 *
 * @param canvas
 * @param p
 */
export function renderText(canvas: HTMLCanvasElement, p: TRenderTextParam): IRect {
    p = BB.copyObj(p);

    // setup context
    const ctx = BB.ctx(canvas) as CanvasRenderingContext2D & {
        letterSpacing: string;
    };
    ctx.save();
    ctx.textAlign = p.align;
    ctx.letterSpacing = p.letterSpacing ? p.letterSpacing + 'px' : '0';

    // font
    const fontArr = [p.size + 'px ' + (p.font ? p.font : 'sans-serif')];
    if (p.isBold) {
        fontArr.unshift('bold');
    }
    if (p.isItalic) {
        fontArr.unshift('italic');
    }
    ctx.font = fontArr.join(' ');

    // fill
    ctx.fillStyle = p.fill ? BB.ColorConverter.toRgbaStr(p.fill.color) : 'transparent';

    // stroke
    ctx.strokeStyle = p.stroke ? BB.ColorConverter.toRgbaStr(p.stroke.color) : 'transparent';
    if (p.stroke) {
        ctx.lineWidth = p.stroke.lineWidth;
        ctx.lineJoin = 'round';
    }

    ctx.translate(p.x, p.y);
    ctx.rotate(-p.angleRad);

    const lines = p.text.split('\n').map((line) => line.replaceAll('\t', '    '));

    // bounds
    const bounds: IBounds = {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
    };
    {
        let isFirst = true;
        lines.forEach((line, lineIndex) => {
            const metrics = ctx.measureText(line);
            const x = 0;
            const y = p.size * (p.lineHeight ?? 1) * lineIndex;
            const mRect = textMetricToRect(metrics, p.align);
            if (isFirst) {
                isFirst = false;
                bounds.x1 = x + mRect.x;
                bounds.y1 = y + mRect.y;
                bounds.x2 = x + mRect.x + mRect.width;
                bounds.y2 = y + mRect.y + mRect.height;
            } else {
                bounds.x1 = Math.min(bounds.x1, x + mRect.x);
                bounds.y1 = Math.min(bounds.y1, y + mRect.y);
                bounds.x2 = Math.max(bounds.x2, x + mRect.x + mRect.width);
                bounds.y2 = Math.max(bounds.y2, y + mRect.y + mRect.height);
            }
        });
    }

    // draw stroke
    lines.forEach((line, lineIndex) => {
        const x = 0;
        const y = p.size * (p.lineHeight ?? 1) * lineIndex;
        ctx.strokeText(line, x, y);
    });

    // draw fill
    lines.forEach((line, lineIndex) => {
        const x = 0;
        const y = p.size * (p.lineHeight ?? 1) * lineIndex;
        ctx.fillText(line, x, y);
    });

    ctx.restore();
    return {
        x: bounds.x1,
        y: bounds.y1,
        width: bounds.x2 - bounds.x1,
        height: bounds.y2 - bounds.y1,
    };
}
