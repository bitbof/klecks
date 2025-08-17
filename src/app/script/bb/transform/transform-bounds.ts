import { TBounds } from '../bb-types';
import { applyToPoint, Matrix } from 'transformation-matrix';

export function transformBounds(bounds: TBounds, transform: Matrix): TBounds {
    const p1 = applyToPoint(transform, { x: bounds.x1, y: bounds.y1 });
    const p2 = applyToPoint(transform, { x: bounds.x2, y: bounds.y1 });
    const p3 = applyToPoint(transform, { x: bounds.x2, y: bounds.y2 });
    const p4 = applyToPoint(transform, { x: bounds.x1, y: bounds.y2 });
    return {
        x1: Math.min(p1.x, p2.x, p3.x, p4.x),
        y1: Math.min(p1.y, p2.y, p3.y, p4.y),
        x2: Math.max(p1.x, p2.x, p3.x, p4.x),
        y2: Math.max(p1.y, p2.y, p3.y, p4.y),
    };
}
