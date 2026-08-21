import { TBoundsType, TCoordinateBounds, TIndexBounds, TRect, TVector2D } from '../bb-types';

export function mix(a: number, b: number, f: number): number {
    return a * (1 - f) + b * f;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
    return Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
}

export function distSquared(ax: number, ay: number, bx: number, by: number): number {
    // faster because no square-root
    return Math.pow(ax - bx, 2) + Math.pow(ay - by, 2);
}

export function lenSquared(x: number, y: number): number {
    // faster because no square-root
    return x * x + y * y;
}

export function pointsToAngleRad(p1: TVector2D, p2: TVector2D): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function pointsToAngleDeg(p1: TVector2D, p2: TVector2D): number {
    return (pointsToAngleRad(p1, p2) * 180) / Math.PI;
}

export function isInsideRect(p: TVector2D, rect: TRect): boolean {
    return (
        rect.x <= p.x && p.x <= rect.x + rect.width && rect.y <= p.y && p.y <= rect.y + rect.height
    );
}

export function clamp(num: number, min: number, max: number): number {
    return num < min ? min : num > max ? max : num;
}

export function rotate(x: number, y: number, deg: number): TVector2D {
    const theta = deg * (Math.PI / 180);
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);

    return {
        x: x * cs - y * sn,
        y: x * sn + y * cs,
    };
}

export function rotateAround(center: TVector2D, point: TVector2D, deg: number): TVector2D {
    const rot = rotate(point.x - center.x, point.y - center.y, deg);
    rot.x += center.x;
    rot.y += center.y;
    return rot;
}

export function snapAngleDeg(
    angleDeg: number,
    snapDegIncrement: number,
    maxDistDeg: number,
): number {
    const modDeg = Math.abs(angleDeg % snapDegIncrement);
    const dist = Math.min(modDeg, snapDegIncrement - modDeg);

    if (dist <= maxDistDeg) {
        angleDeg = Math.round(angleDeg / snapDegIncrement) * snapDegIncrement;
    }

    return angleDeg;
}

/**
 * angle always in range [-180, 180]
 */
export function minimizeAngleDeg(angleDeg: number): number {
    angleDeg = angleDeg % 360;
    if (angleDeg > 180) {
        angleDeg -= 360;
    } else if (angleDeg < -180) {
        angleDeg += 360;
    }
    return angleDeg;
}

export function intDxy(remainder: TVector2D, fDx: number, fDy: number): { dX: number; dY: number } {
    remainder.x += fDx;
    remainder.y += fDy;
    const dX = Math.round(remainder.x);
    const dY = Math.round(remainder.y);
    remainder.x -= dX;
    remainder.y -= dY;
    return {
        dX,
        dY,
    };
}

/**
 * return closest even number
 */
export function roundEven(f: number): number {
    if (f % 1 === 0) {
        if (f % 2 === 0) {
            return f;
        }
        return f + 1;
    }
    const above = Math.ceil(f);
    const below = Math.floor(f);
    if (above % 2 === 0) {
        return above;
    } else {
        return below;
    }
}

/**
 * return closest uneven number
 */
export function roundUneven(f: number): number {
    if (f % 1 === 0) {
        if (f % 2 === 0) {
            return f + 1;
        }
        return f;
    }
    const above = Math.ceil(f);
    const below = Math.floor(f);
    if (above % 2 === 1) {
        return above;
    } else {
        return below;
    }
}

/**
 * round number to certain precision.
 * - round(1.2345, 2) = 1.23
 * - round(1.2345, 0) = 0
 * - round(123, -1) = 120
 */
export function round(f: number, digits: number): number {
    const digitMult = Math.pow(10, digits);
    // adding epsilon is not much better
    return Math.round(f * digitMult) / digitMult;
}

const roundFormatterCache = new Map<number, Intl.NumberFormat>();
// can be multiple orders of magnitude slower, but is correct
export function roundSlow(f: number, digits: number): number {
    try {
        let formatter = roundFormatterCache.get(digits);
        if (!formatter) {
            formatter = new Intl.NumberFormat('en-US-u-nu-latn', {
                useGrouping: false,
                maximumFractionDigits: digits,
            });
            roundFormatterCache.set(digits, formatter);
        }

        return Number(formatter.format(f));
    } catch {
        return round(f, digits);
    }
}

export function getDecimalDigits(value: number): number {
    const [coefficient, exponent = '0'] = value.toString().toLowerCase().split('e');
    const fractionLength = coefficient.split('.')[1]?.length ?? 0;
    return Math.max(0, fractionLength - Number(exponent));
}

export function fixBounds<GBoundsType extends TCoordinateBounds | TIndexBounds>(
    bounds: GBoundsType,
): GBoundsType {
    return {
        ...bounds,
        x1: Math.min(bounds.x1, bounds.x2),
        y1: Math.min(bounds.y1, bounds.y2),
        x2: Math.max(bounds.x1, bounds.x2),
        y2: Math.max(bounds.y1, bounds.y2),
    };
}

/**
 * update (mutate) `target` so it includes `bounds`
 */
export function updateBounds<GBoundsType extends TCoordinateBounds | TIndexBounds>(
    target: GBoundsType | undefined,
    bounds: GBoundsType | undefined,
): GBoundsType {
    if (!bounds && !target) {
        throw new Error('at least one param needs to be defined');
    }
    if (!bounds) {
        return target!;
    }
    if (!target) {
        target = {
            type: bounds.type,
            x1: bounds.x1,
            y1: bounds.y1,
            x2: bounds.x2,
            y2: bounds.y2,
        } as GBoundsType;
    } else {
        target.x1 = Math.min(target.x1, bounds.x1);
        target.y1 = Math.min(target.y1, bounds.y1);
        target.x2 = Math.max(target.x2, bounds.x2);
        target.y2 = Math.max(target.y2, bounds.y2);
    }
    return target;
}

export function intersectBounds<GBoundsType extends TCoordinateBounds | TIndexBounds>(
    bounds: GBoundsType | undefined,
    limit: GBoundsType | undefined,
): GBoundsType | undefined {
    if (!bounds) {
        return undefined;
    }
    if (!limit) {
        return bounds;
    }
    const x1 = Math.max(limit.x1, bounds.x1);
    const y1 = Math.max(limit.y1, bounds.y1);
    const x2 = Math.min(limit.x2, bounds.x2);
    const y2 = Math.min(limit.y2, bounds.y2);

    if (x1 > x2 || y1 > y2) {
        return undefined;
    }
    return { type: bounds?.type ?? limit?.type, x1, y1, x2, y2 } as GBoundsType;
}

/**
 * determine overlap of bounds with width&height
 */
export function indexBoundsInArea(
    bounds: TIndexBounds | undefined,
    width: number,
    height: number,
): TIndexBounds | undefined {
    if (!bounds) {
        return undefined;
    }
    return intersectBounds(bounds, {
        type: 'index',
        x1: 0,
        y1: 0,
        x2: width - 1,
        y2: height - 1,
    });
}

export function coordinateBoundsToIndexBounds(bounds: TCoordinateBounds): TIndexBounds {
    const x1 = Math.floor(bounds.x1);
    const y1 = Math.floor(bounds.y1);
    const x2 = Math.ceil(bounds.x2 - 1);
    const y2 = Math.ceil(bounds.y2 - 1);
    return { type: 'index', x1, y1, x2, y2 };
}

export function indexBoundsToCoordinateBounds(bounds: TIndexBounds): TCoordinateBounds {
    const x1 = bounds.x1;
    const y1 = bounds.y1;
    const x2 = bounds.x2 + 1;
    const y2 = bounds.y2 + 1;
    return { type: 'coordinate', x1, y1, x2, y2 };
}

export function indexBoundsToRect(bounds: TIndexBounds): TRect {
    return {
        x: bounds.x1,
        y: bounds.y1,
        width: bounds.x2 - bounds.x1 + 1,
        height: bounds.y2 - bounds.y1 + 1,
    };
}

export function rectToBounds<T extends TBoundsType>(
    rect: TRect,
    type: T,
): T extends 'index' ? TIndexBounds : TCoordinateBounds {
    const x2 = rect.x + rect.width;
    const y2 = rect.y + rect.height;
    return (
        type === 'index'
            ? { type: 'index', x1: rect.x, y1: rect.y, x2: x2 - 1, y2: y2 - 1 }
            : { type: 'coordinate', x1: rect.x, y1: rect.y, x2, y2 }
    ) as T extends 'index' ? TIndexBounds : TCoordinateBounds;
}

export function boundsToRect(bounds: TIndexBounds | TCoordinateBounds): TRect {
    const isIndex = bounds.type === 'index';
    return {
        x: bounds.x1,
        y: bounds.y1,
        width: bounds.x2 - bounds.x1 + (isIndex ? 1 : 0),
        height: bounds.y2 - bounds.y1 + (isIndex ? 1 : 0),
    };
}
