import { IVector2D } from '../bb-types';

export const Vec2 = {
    add: function (p1: IVector2D, p2: IVector2D): IVector2D {
        return { x: p1.x + p2.x, y: p1.y + p2.y };
    },
    sub: function (p1: IVector2D, p2: IVector2D): IVector2D {
        return { x: p1.x - p2.x, y: p1.y - p2.y };
    },
    nor: function (p: IVector2D): IVector2D {
        const len = Math.sqrt(Math.pow(p.x, 2) + Math.pow(p.y, 2));
        return { x: p.x / len, y: p.y / len };
    },
    len: function (p: IVector2D): number {
        return Math.sqrt(Math.pow(p.x, 2) + Math.pow(p.y, 2));
    },
    dist: function (p1: IVector2D, p2: IVector2D): number {
        return Vec2.len(Vec2.sub(p1, p2));
    },
    mul: function (p: IVector2D, s: number): IVector2D {
        return { x: p.x * s, y: p.y * s };
    },
    angle: function (p1: IVector2D, p2: IVector2D): number {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    },
    dot: function (a: IVector2D, b: IVector2D): number {
        const aArr = [a.x, a.y];
        const bArr = [b.x, b.y];
        return aArr.map((x, i) => aArr[i] * bArr[i]).reduce((m, n) => m + n);
    },
};
