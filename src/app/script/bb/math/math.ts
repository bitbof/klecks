import { IBounds, IRect, IVector2D } from '../bb-types';

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

export function pointsToAngleRad(p1: IVector2D, p2: IVector2D): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function pointsToAngleDeg(p1: IVector2D, p2: IVector2D): number {
    return (pointsToAngleRad(p1, p2) * 180) / Math.PI;
}

export function isInsideRect(p: IVector2D, rect: IRect): boolean {
    return (
        rect.x <= p.x && p.x <= rect.x + rect.width && rect.y <= p.y && p.y <= rect.y + rect.height
    );
}

export function clamp(num: number, min: number, max: number): number {
    return num < min ? min : num > max ? max : num;
}

export function rotate(x: number, y: number, deg: number): IVector2D {
    const theta = deg * (Math.PI / 180);
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);

    return {
        x: x * cs - y * sn,
        y: x * sn + y * cs,
    };
}

export function rotateAround(center: IVector2D, point: IVector2D, deg: number): IVector2D {
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

export function intDxy(remainder: IVector2D, fDx: number, fDy: number): { dX: number; dY: number } {
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
 * @param f
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
 * @param f
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
 * round(1.2345, 2) = 1.23
 * round(1.2345, 0) = 0
 * round(123, -1) = 120
 *
 * @param f
 * @param digits
 */
export function round(f: number, digits: number): number {
    const digitMult = Math.pow(10, digits);
    return Math.round(f /* + Number.EPSILON*/ * digitMult) / digitMult;
}

/**
 * update target so it includes bounds
 * @param target
 * @param bounds
 */
export function updateBounds(target: IBounds | undefined, bounds: IBounds | undefined): IBounds {
    if (!bounds && !target) {
        throw new Error('at least one param needs to be defined');
    }
    if (!bounds) {
        return target!;
    }
    if (!target) {
        target = { x1: bounds.x1, y1: bounds.y1, x2: bounds.x2, y2: bounds.y2 };
    } else {
        target.x1 = Math.min(target.x1, bounds.x1);
        target.y1 = Math.min(target.y1, bounds.y1);
        target.x2 = Math.max(target.x2, bounds.x2);
        target.y2 = Math.max(target.y2, bounds.y2);
    }
    return target;
}

/**
 * determine overlap of bounds with width&height
 */
export function boundsInArea(
    bounds: IBounds | undefined,
    width: number,
    height: number,
): IBounds | undefined {
    if (!bounds) {
        return undefined;
    }
    const x1 = Math.max(0, bounds.x1);
    const y1 = Math.max(0, bounds.y1);
    const x2 = Math.min(width - 1, bounds.x2);
    const y2 = Math.min(height - 1, bounds.y2);
    if (x1 > x2 || y1 > y2) {
        return undefined;
    }
    return { x1, y1, x2, y2 };
}

export function intBoundsWithinArea(
    bounds: IBounds,
    width: number,
    height: number,
): IBounds | undefined {
    const x1 = Math.max(0, Math.floor(bounds.x1));
    const y1 = Math.max(0, Math.floor(bounds.y1));
    const x2 = Math.min(width - 1, Math.ceil(bounds.x2));
    const y2 = Math.min(height - 1, Math.ceil(bounds.y2));
    if (x1 > x2 || y1 > y2) {
        return undefined;
    }
    return { x1, y1, x2, y2 };
}

export function integerBounds(bounds: IBounds): IBounds {
    return {
        x1: Math.floor(bounds.x1),
        y1: Math.floor(bounds.y1),
        x2: Math.ceil(bounds.x2),
        y2: Math.ceil(bounds.y2),
    };
}
