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

export function angleDeg (center: IVector2D, p1: IVector2D): number {
    const p0 = {
        x: center.x,
        y: center.y - Math.sqrt(Math.abs(p1.x - center.x) * Math.abs(p1.x - center.x) + Math.abs(p1.y - center.y) * Math.abs(p1.y - center.y))
    };
    return (2 * Math.atan2(p1.y - p0.y, p1.x - p0.x)) * 180 / Math.PI;
}

export function angleFromPoints (p1: IVector2D, p2: IVector2D): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
}