import { dist, mix, pointsToAngleDeg } from './math';
import { TVector2D } from '../bb-types';

/**
 * project p onto line
 * @param lineStart
 * @param lineEnd
 * @param p
 */
export const projectPointOnLine = function (
    lineStart: TVector2D,
    lineEnd: TVector2D,
    p: TVector2D,
): TVector2D {
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

export type TLinearLineCallback = (v: {
    x: number;
    y: number;
    t: number; // [0, 1] - how far along the current segment
    angle: number; // direction of the current segment in degrees
}) => void;

/**
 * Each instance is one line made up of straight segments.
 * You feed it points. It steps along the line with the given spacing, and calls back for each step.
 * The first step lands one spacing away from the start point.
 */
export class LinearLine {
    private lastPoint: TVector2D;
    private lastSpacing: number | undefined;
    private nextStep: number | undefined; // distance into the next segment where the next step lands

    // ----------------------------------- public -----------------------------------
    constructor(start: TVector2D) {
        this.lastPoint = { x: start.x, y: start.y };
    }

    // ---- interface ----

    /**
     * Add new point to line. Steps from the previous point to the new one.
     *
     * @param x - coord of new point
     * @param y
     * @param spacing - space between each step, for the new point. Will blend into the new spacing value along the segment.
     * @param callback - calls for each step
     */
    add(x: number, y: number, spacing: number, callback: TLinearLineCallback): void {
        const len = dist(this.lastPoint.x, this.lastPoint.y, x, y);
        if (len === 0) {
            return;
        }
        const lastSpacing = this.lastSpacing ?? spacing;
        const angle = pointsToAngleDeg(this.lastPoint, { x, y });
        let d = this.nextStep ?? spacing;
        for (; d <= len; d += mix(lastSpacing, spacing, d / len)) {
            const t = d / len;
            callback({
                x: mix(this.lastPoint.x, x, t),
                y: mix(this.lastPoint.y, y, t),
                t,
                angle,
            });
        }
        this.nextStep = d - len;
        this.lastSpacing = spacing;
        this.lastPoint = { x, y };
    }
}

export type TSplineInputPoints = [number, number][]; // [x, y]

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
    constructor(points: TSplineInputPoints) {
        const n = points.length;
        this.u = [];
        this.y2 = [];
        let i;

        this.first = points[0][0];
        this.last = points.at(-1)![0];

        points.sort(function (a, b) {
            return a[0] - b[0];
        });
        this.xa = points.map((point) => point[0]);
        this.ya = points.map((point) => point[1]);
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
 * input for a spline, following curve of a power function x^n [0 - 1]
 * returns [[0, startVal], ..., [1, endVal]]
 */
export function powerSplineInput(
    startVal: number,
    endVal: number,
    stepSize: number,
    exponent: number = 2,
): TSplineInputPoints {
    function round(v: number, dec: number): number {
        return Math.round(v * 10 ** dec) / 10 ** dec;
    }

    const resultArr: TSplineInputPoints = [];
    for (let i = 0; i <= 1; i += stepSize) {
        resultArr.push([round(i, 4), round(startVal + i ** exponent * (endVal - startVal), 4)]);
    }
    return resultArr;
}
