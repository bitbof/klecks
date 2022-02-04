import {IVector2D} from '../BB.types';

export function mix (x: number, y: number, a: number): number {
    return x * (1 - a) + y * a;
}

export function dist (ax: number, ay: number, bx: number, by: number): number {
    return Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
}

export function pointsToAngleRad (p1: IVector2D, p2: IVector2D): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function pointsToAngleDeg (p1: IVector2D, p2: IVector2D): number {
    return pointsToAngleRad(p1, p2) * 180 / Math.PI;
}

export function clamp (val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export function rotate (x: number, y: number, deg: number): IVector2D {
    const theta = deg * (Math.PI / 180);
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);

    return {
        x: x * cs - y * sn,
        y: x * sn + y * cs
    };
}

export function rotateAround (center: IVector2D, point: IVector2D, deg: number): IVector2D {
    const rot = rotate(point.x - center.x, point.y - center.y, deg);
    rot.x += center.x;
    rot.y += center.y;
    return rot;
}

export function intDxy(remainder: IVector2D, fDx: number, fDy: number) {
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
export function roundEven(f: number) {
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
export function roundUneven(f: number) {
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



