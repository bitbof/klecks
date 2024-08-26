import { Vec2 } from './vec2';
import { clamp, dist, mix, pointsToAngleDeg } from './math';
import { IVector2D } from '../bb-types';
import { copyObj } from '../base/base';

/**
 * project p onto line
 * @param lineStart
 * @param lineEnd
 * @param p
 */
export const projectPointOnLine = function (
    lineStart: IVector2D,
    lineEnd: IVector2D,
    p: IVector2D,
): IVector2D {
    let x, y;
    if (lineStart.x === lineEnd.x) {
        x = lineStart.x;
        y = p.y;

        return {
            x: x,
            y: y,
        };
    }
    const m = (lineEnd.y - lineStart.y) / (lineEnd.x - lineStart.x);
    const b = lineStart.y - m * lineStart.x;

    x = (m * p.y + p.x - m * b) / (m * m + 1);
    y = (m * m * p.y + m * p.x + b) / (m * m + 1);

    return {
        x: x,
        y: y,
    };
};

/**
 * Operations on a line made up of points
 */
export class PointLine {
    private readonly segmentArr: {
        x: number;
        y: number;
        length: number; // last is 0
    }[];

    // ----------------------------------- public -----------------------------------
    constructor(p: { points: IVector2D[] }) {
        this.segmentArr = [];

        for (let i = 0; i < p.points.length; i++) {
            ((i) => {
                let length = 0;
                if (i < p.points.length - 1) {
                    length = dist(
                        p.points[i].x,
                        p.points[i].y,
                        p.points[i + 1].x,
                        p.points[i + 1].y,
                    );
                }
                this.segmentArr[i] = {
                    x: p.points[i].x,
                    y: p.points[i].y,
                    length: length,
                };
            })(i);
        }
    }

    // ---- interface ----

    /**
     * returns point when traveling *dist* along the line, > 0
     * @param dist
     */
    getAtDist(dist: number): IVector2D {
        let remainder = Math.min(this.getLength(), dist);
        let i = 0;

        for (; remainder > this.segmentArr[i].length && i < this.segmentArr.length - 2; i++) {
            remainder -= this.segmentArr[i].length;
        }

        const fac = Math.min(1, Math.max(0, remainder / this.segmentArr[i].length));

        return {
            x: this.segmentArr[i].x * (1 - fac) + this.segmentArr[i + 1].x * fac,
            y: this.segmentArr[i].y * (1 - fac) + this.segmentArr[i + 1].y * fac,
        };
    }

    /**
     * total length of line
     */
    getLength(): number {
        let result = 0;
        for (let i = 0; i < this.segmentArr.length - 1; i++) {
            result += this.segmentArr[i].length;
        }
        return result;
    }
}

export type TBezierLineCallback = (v: {
    x: number;
    y: number;
    t: number; // [0, 1] - how far along
    angle?: number;
    dAngle: number;
}) => void;
type TBezierLineControlsCallback = (v: {
    p1: IVector2D;
    p2: IVector2D;
    p3: IVector2D;
    p4: IVector2D;
}) => void;

type TBezierLinePoint = {
    x: number;
    y: number;
    spacing: number;
    dir: IVector2D;
};

/**
 * Each instance is one line made up of bezier interpolated segments.
 * You feed it points. It calculates control points on its own, and the resulting curve.
 */
export class BezierLine {
    private readonly pointArr: TBezierLinePoint[];
    private lastDot: number = 0;
    private lastPoint: IVector2D | undefined;
    private lastCallbackPoint: IVector2D | undefined;
    private lastAngle: number | undefined;
    private lastSpacing: number | undefined;

    /**
     * creates bezier curve from control points
     * @param p1 - control point 1 {x: float, y: float}
     * @param p2 - control point 2 {x: float, y: float}
     * @param p3 - control point 3 {x: float, y: float}
     * @param p4 - control point 4 {x: float, y: float}
     * @param resolution - int
     * @returns bezier curve made up of points {x: float, y: float}
     */
    private getBezierPoints(
        p1: IVector2D,
        p2: IVector2D,
        p3: IVector2D,
        p4: IVector2D,
        resolution: number,
    ): IVector2D[] {
        const curvePoints = [];
        let t;
        for (let i = 0; i <= resolution; i++) {
            t = i / resolution;
            curvePoints[curvePoints.length] = {
                x:
                    Math.pow(1 - t, 3) * p1.x +
                    3 * Math.pow(1 - t, 2) * t * p2.x +
                    3 * (1 - t) * Math.pow(t, 2) * p3.x +
                    Math.pow(t, 3) * p4.x,
                y:
                    Math.pow(1 - t, 3) * p1.y +
                    3 * Math.pow(1 - t, 2) * t * p2.y +
                    3 * (1 - t) * Math.pow(t, 2) * p3.y +
                    Math.pow(t, 3) * p4.y,
            };
        }
        return curvePoints;
    }

    // ----------------------------------- public -----------------------------------
    constructor() {
        this.pointArr = [];
    }

    // ---- interface ----

    /**
     * Add new point to line. "Drawn" line will go until the previous point.
     *
     * @param x - coord of new point
     * @param y
     * @param spacing - space between each step
     * @param callback - calls for each step
     * @param controlsCallback - calls that callback with the bezier control points
     */
    add(
        x: number,
        y: number,
        spacing: number,
        callback?: TBezierLineCallback,
        controlsCallback?: TBezierLineControlsCallback,
    ): void {
        if (this.lastPoint && x === this.lastPoint.x && y === this.lastPoint.y) {
            return;
        }
        this.lastPoint = { x, y };
        this.pointArr[this.pointArr.length] = {
            x,
            y,
            spacing,
        } as TBezierLinePoint;

        //calculate directions
        if (this.pointArr.length === 1) {
            this.lastSpacing = spacing;
            return;
        } else if (this.pointArr.length === 2) {
            this.pointArr[0].dir = Vec2.nor(Vec2.sub(this.pointArr[1], this.pointArr[0]));
            this.lastDot = spacing;
            this.lastSpacing = spacing;
            return;
        } else {
            const pointM1 = this.pointArr[this.pointArr.length - 1];
            const pointM2 = this.pointArr[this.pointArr.length - 2];
            const pointM3 = this.pointArr[this.pointArr.length - 3];
            pointM2.dir = Vec2.nor(Vec2.sub(pointM1, pointM3));
            if (isNaN(pointM2.dir.x) || isNaN(pointM2.dir.y)) {
                //when xy -3 == -1
                pointM2.dir = copyObj(pointM3.dir);
            }
        }

        //get bezier curve
        const a = this.pointArr[this.pointArr.length - 3];
        const b = this.pointArr[this.pointArr.length - 2];
        const p1 = a;
        const p2 = Vec2.add(a, Vec2.mul(a.dir, Vec2.dist(a, b) / 4));
        const p3 = Vec2.sub(b, Vec2.mul(b.dir, Vec2.dist(a, b) / 4));
        const p4 = b;

        let pointLine: PointLine;
        if (callback) {
            const curvePoints = this.getBezierPoints(p1, p2, p3, p4, 20);
            pointLine = new PointLine({ points: curvePoints });
        } else {
            pointLine = new PointLine({ points: [p1, p4] });
        }

        //iterate over curve with spacing and callback
        const len = pointLine.getLength();
        let tempSpacing = mix(this.lastSpacing!, spacing, clamp(this.lastDot / len, 0, 1));
        let d = this.lastDot;
        for (; d <= len; d += tempSpacing) {
            tempSpacing = mix(this.lastSpacing!, spacing, clamp(d / len, 0, 1));
            const point = pointLine.getAtDist(d);
            const angle = this.lastCallbackPoint
                ? pointsToAngleDeg(this.lastCallbackPoint, point)
                : undefined;
            if (callback) {
                callback({
                    x: point.x,
                    y: point.y,
                    t: d / len,
                    angle: angle,
                    dAngle: this.lastCallbackPoint ? angle! - this.lastAngle! : 0,
                });
            }
            this.lastCallbackPoint = point;
            this.lastAngle = angle;
        }

        if (callback) {
            this.lastDot = d - len;
        } else {
            this.lastDot = 0;
            controlsCallback && controlsCallback({ p1: p1, p2: p2, p3: p3, p4: p4 });
        }

        this.lastSpacing = spacing;
    }

    addFinal(
        spacing: number,
        callback?: TBezierLineCallback,
        controlsCallback?: TBezierLineControlsCallback,
    ): void {
        if (this.pointArr.length < 2) {
            return;
        }

        const p1 = this.pointArr[this.pointArr.length - 2];
        const p2 = this.pointArr[this.pointArr.length - 1];

        const newP = Vec2.add(p2, Vec2.sub(p2, p1));

        this.add(newP.x, newP.y, spacing, callback, controlsCallback);
    }
}

/**
 * from SplineInterpolator.cs in the Paint.NET source code
 */
export class SplineInterpolator {
    private readonly xa: number[];
    private readonly ya: number[];
    private readonly u: number[];
    private readonly y2: number[];
    private readonly first: number;
    private readonly last: number;

    // ----------------------------------- public -----------------------------------
    constructor(points: [number, number][]) {
        const n = points.length;
        this.xa = [];
        this.ya = [];
        this.u = [];
        this.y2 = [];
        let i;

        this.first = points[0][0];
        this.last = points[points.length - 1][0];

        points.sort(function (a, b) {
            return a[0] - b[0];
        });
        for (i = 0; i < n; i++) {
            this.xa.push(points[i][0]);
            this.ya.push(points[i][1]);
        }

        this.u[0] = 0;
        this.y2[0] = 0;

        for (i = 1; i < n - 1; ++i) {
            // This is the decomposition loop of the tridiagonal algorithm.
            // y2 and u are used for temporary storage of the decomposed factors.
            const wx = this.xa[i + 1] - this.xa[i - 1];
            const sig = (this.xa[i] - this.xa[i - 1]) / wx;
            const p = sig * this.y2[i - 1] + 2.0;

            this.y2[i] = (sig - 1.0) / p;

            const ddydx =
                (this.ya[i + 1] - this.ya[i]) / (this.xa[i + 1] - this.xa[i]) -
                (this.ya[i] - this.ya[i - 1]) / (this.xa[i] - this.xa[i - 1]);

            this.u[i] = ((6.0 * ddydx) / wx - sig * this.u[i - 1]) / p;
        }

        this.y2[n - 1] = 0;

        // This is the backsubstitution loop of the tridiagonal algorithm
        for (i = n - 2; i >= 0; --i) {
            this.y2[i] = this.y2[i] * this.y2[i + 1] + this.u[i];
        }
    }

    // ---- interface ----

    getFirstX(): number {
        return this.first;
    }

    getLastX(): number {
        return this.last;
    }

    interpolate(x: number): number {
        const n = this.ya.length;
        let klo = 0;
        let khi = n - 1;

        // We will find the right place in the table by means of
        // bisection. This is optimal if sequential calls to this
        // routine are at random values of x. If sequential calls
        // are in order, and closely spaced, one would do better
        // to store previous values of klo and khi.
        while (khi - klo > 1) {
            const k = (khi + klo) >> 1;

            if (this.xa[k] > x) {
                khi = k;
            } else {
                klo = k;
            }
        }

        const h = this.xa[khi] - this.xa[klo];
        const a = (this.xa[khi] - x) / h;
        const b = (x - this.xa[klo]) / h;

        // Cubic spline polynomial is now evaluated.
        return (
            a * this.ya[klo] +
            b * this.ya[khi] +
            (((a * a * a - a) * this.y2[klo] + (b * b * b - b) * this.y2[khi]) * (h * h)) / 6.0
        );
    }

    /**
     * find x to y. simply by stepping through. suboptimal, so don't call often.
     * searches in x 0-1 range
     */
    findX(y: number, resolution: number): number | undefined {
        let x;
        let dist: number;
        for (let i = 0; i <= resolution; i++) {
            const tempX = i / resolution;
            const tempY = this.interpolate(tempX);
            if (x === undefined) {
                x = tempX;
                dist = Math.abs(tempY - y);
                continue;
            }

            const tempDist = Math.abs(tempY - y);

            if (tempDist < dist!) {
                x = tempX;
                dist = tempDist;
            } else {
                //distance increasing
                break;
            }
        }
        return x;
    }
}

/**
 * input for a spline, following curve of quadratic function x^2 [0 - 1]
 * returns [[0, startVal], ..., [1, endVal]]
 * @param startVal
 * @param endVal
 * @param stepSize
 */
export function quadraticSplineInput(
    startVal: number,
    endVal: number,
    stepSize: number,
): [number, number][] {
    function round(v: number, dec: number): number {
        return Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec);
    }

    const resultArr: [number, number][] = [];
    for (let i = 0; i <= 1; i += stepSize) {
        resultArr.push([round(i, 4), round(startVal + Math.pow(i, 2) * (endVal - startVal), 4)]);
    }
    return resultArr;
}
