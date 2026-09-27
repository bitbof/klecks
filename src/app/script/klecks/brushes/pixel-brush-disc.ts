import { TRect } from '../../bb/bb-types';

/**
 * Half width of each pixel row of a round pixel dab. Rows are centered, so a row
 * spans [diameter / 2 - halfWidth, diameter / 2 + halfWidth), always on whole pixels.
 */
export function getPixelDiscHalfWidths(diameter: number): number[] {
    const r = diameter <= 2 ? diameter / 2 : diameter / 2 - 0.3;
    const center = diameter / 2;
    return Array.from({ length: diameter }, (_, y) => {
        const dY = y + 0.5 - center;
        const halfWidth = Math.sqrt(r * r - dY * dY);
        const x0 = Math.ceil(center - halfWidth - 0.5);
        const x1 = Math.floor(center + halfWidth - 0.5);
        return (x1 - x0 + 1) / 2;
    });
}

/**
 * Converts many overlapping round dabs into few non-overlapping rects covering the
 * same pixels. Filling those as one path is much cheaper than filling each dab.
 */
export class PixelDiscUnion {
    // Reused between calls. Each entry is one row span of one dab, packed into a
    // single number, so sorting them groups spans by row, then by left edge.
    private spans = new Float64Array(0);

    /**
     * @param discs - bounds of each dab. width === height === diameter.
     * @param clip - spans outside of it are dropped.
     */
    getRects(discs: readonly TRect[], clip: TRect): TRect[] {
        const stride = clip.width + 1;
        const rowStride = stride * stride;
        const clipRight = clip.x + clip.width;
        const clipBottom = clip.y + clip.height;
        const halfWidthsByDiameter = new Map<number, number[]>();

        const maxSpanCount = discs.reduce((sum, disc) => sum + disc.height, 0);
        if (this.spans.length < maxSpanCount) {
            this.spans = new Float64Array(maxSpanCount);
        }
        let spanCount = 0;
        for (const disc of discs) {
            let halfWidths = halfWidthsByDiameter.get(disc.width);
            if (!halfWidths) {
                halfWidths = getPixelDiscHalfWidths(disc.width);
                halfWidthsByDiameter.set(disc.width, halfWidths);
            }
            const center = disc.x + disc.width / 2;
            const startY = Math.max(clip.y, disc.y);
            const endY = Math.min(clipBottom, disc.y + disc.height);
            for (let y = startY; y < endY; y++) {
                const halfWidth = halfWidths[y - disc.y];
                const left = Math.max(clip.x, center - halfWidth) - clip.x;
                const right = Math.min(clipRight, center + halfWidth) - clip.x;
                if (left < right) {
                    this.spans[spanCount++] = (y - clip.y) * rowStride + left * stride + right;
                }
            }
        }
        const spans = this.spans.subarray(0, spanCount).sort();

        // Merge overlapping spans within a row. A merged span continues the rect of
        // the row above if that rect has the exact same left and right edge.
        const rects: TRect[] = [];
        let aboveRects: TRect[] = [];
        let rowRects: TRect[] = [];
        let aboveIndex = 0;
        let spanY = -1;
        let spanLeft = 0;
        let spanRight = 0;
        const addSpan = (): void => {
            const x = clip.x + spanLeft;
            const y = clip.y + spanY;
            const width = spanRight - spanLeft;
            while (aboveIndex < aboveRects.length && aboveRects[aboveIndex].x < x) {
                aboveIndex++;
            }
            let rect = aboveRects[aboveIndex];
            if (rect && rect.x === x && rect.width === width && rect.y + rect.height === y) {
                rect.height++;
            } else {
                rect = { x, y, width, height: 1 };
                rects.push(rect);
            }
            rowRects.push(rect);
        };
        for (const span of spans) {
            const y = Math.floor(span / rowStride);
            const left = Math.floor((span - y * rowStride) / stride);
            const right = span - y * rowStride - left * stride;
            if (y === spanY && left <= spanRight) {
                spanRight = Math.max(spanRight, right);
                continue;
            }
            if (spanY !== -1) {
                addSpan();
            }
            if (y !== spanY) {
                aboveRects = rowRects;
                rowRects = [];
                aboveIndex = 0;
            }
            spanY = y;
            spanLeft = left;
            spanRight = right;
        }
        if (spanY !== -1) {
            addSpan();
        }
        return rects;
    }
}
