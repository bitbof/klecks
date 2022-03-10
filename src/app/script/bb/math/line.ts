import {Vec2} from './vec2';
import {pointsToAngleDeg, clamp, dist, mix} from './math';
import {IVector2D} from "../bb.types";

/**
 * project p onto line
 * @param lineStart
 * @param lineEnd
 * @param p
 */
export const projectPointOnLine = function (lineStart: IVector2D, lineEnd: IVector2D, p: IVector2D): IVector2D {
    let x, y;
    if (lineStart.x === lineEnd.x) {
        x = lineStart.x;
        y = p.y;

        return {
            x: x,
            y: y
        };
    }
    const m = (lineEnd.y - lineStart.y) / (lineEnd.x - lineStart.x);
    const b = lineStart.y - (m * lineStart.x);

    x = (m * p.y + p.x - m * b) / (m * m + 1);
    y = (m * m * p.y + m * p.x + b) / (m * m + 1);

    return {
        x: x,
        y: y
    };
};



/**
 * Operations on a line made up of points
 *
 * getAtDist(dist) - point when traveling *dist* along the line
 * getLength - gives you total length of line
 *
 * @param params object - {points: [{x:float, y:float}, ...]}
 * @constructor
 */
export const PointLine = function (params) {
    const segmentArr = [];
    const _this = this;

    for (let i = 0; i < params.points.length; i++) {
        (function (i) {
            let length = undefined;
            if (i < params.points.length - 1) {
                length = dist(params.points[i].x, params.points[i].y, params.points[i + 1].x, params.points[i + 1].y);
            }
            segmentArr[i] = {
                x: params.points[i].x,
                y: params.points[i].y,
                length: length
            };
        })(i);
    }

    /**
     * @param dist number - distance in pixels, > 0
     * @returns {{x: number, y: number}}
     */
    this.getAtDist = function (dist) {
        let remainder = Math.min(_this.getLength(), dist);
        let i = 0;

        for (; remainder > segmentArr[i].length && i < segmentArr.length - 2; i++) {
            remainder -= segmentArr[i].length;
        }

        const fac = Math.min(1, Math.max(0, remainder / segmentArr[i].length));

        return {
            x: (segmentArr[i].x * (1 - fac) + segmentArr[i + 1].x * fac),
            y: (segmentArr[i].y * (1 - fac) + segmentArr[i + 1].y * fac)
        };
    };
    this.getLength = function () {
        let result = 0;
        for (let i = 0; i < segmentArr.length - 1; i++) {
            result += segmentArr[i].length;
        }
        return result;
    };
};

/**
 * Each instance is one line made up of bezier interpolated segments.
 * You feed it points. It calculates control points on its own, and the resulting curve.
 *
 * @constructor
 */
export const BezierLine = function () {
    const _this = this;
    const pointArr = [];
    let lastDot = 0;
    let lastPoint;
    let lastCallbackPoint;
    let lastAngle;
    let lastSpacing = null;

    /**
     * creates bezier curve from control points
     *
     * @param p1 - control point 1 {x: float, y: float}
     * @param p2 - control point 2 {x: float, y: float}
     * @param p3 - control point 3 {x: float, y: float}
     * @param p4 - control point 4 {x: float, y: float}
     * @param resolution - int
     * @returns {Array} - bezier curve made up of points {x: float, y: float}
     */
    function getBezierPoints(p1, p2, p3, p4, resolution) {
        const curvePoints = [];
        let t, result;
        for (let i = 0; i <= resolution; i++) {
            t = i / resolution;
            result = {};
            result.x = Math.pow(1 - t, 3) * p1.x + 3 * Math.pow(1 - t, 2) * t * p2.x + 3 * (1 - t) * Math.pow(t, 2) * p3.x + Math.pow(t, 3) * p4.x;
            result.y = Math.pow(1 - t, 3) * p1.y + 3 * Math.pow(1 - t, 2) * t * p2.y + 3 * (1 - t) * Math.pow(t, 2) * p3.y + Math.pow(t, 3) * p4.y;
            curvePoints[curvePoints.length] = result;
        }
        return curvePoints;
    }

    /**
     *
     * add now point to line
     * line will go until the previous point
     *
     * @param x - coord of new point
     * @param y - coord of new point
     * @param spacing - space between each step
     * @param callback - calls for each step - x, y, t - t is 0-1 how far along
     * @param controlsCallback - calls that callback with the bezier control points p1, p2, p3, p4 - each {x: float, y: float}
     */
    this.add = function (x, y, spacing, callback, controlsCallback) {
        if (lastPoint && x === lastPoint.x && y === lastPoint.y) {
            return;
        }
        lastPoint = {x: x, y: y};
        pointArr[pointArr.length] = {
            x: x,
            y: y,
            spacing: spacing
        };

        //calculate directions
        if (pointArr.length === 1) {
            lastSpacing = spacing;
            return;
        } else if (pointArr.length === 2) {
            pointArr[0].dir = Vec2.nor(Vec2.sub(pointArr[1], pointArr[0]));
            lastDot = spacing;
            lastSpacing = spacing;
            return;
        } else {
            const pointM1 = pointArr[pointArr.length - 1];
            const pointM2 = pointArr[pointArr.length - 2];
            const pointM3 = pointArr[pointArr.length - 3];
            pointM2.dir = Vec2.nor(Vec2.sub(pointM1, pointM3));
            if (isNaN(pointM2.dir.x) || isNaN(pointM2.dir.y)) {
                //when xy -3 == -1
                pointM2.dir = JSON.parse(JSON.stringify(pointM3.dir));
            }
        }

        //get bezier curve
        const a = pointArr[pointArr.length - 3];
        const b = pointArr[pointArr.length - 2];
        const p1 = a;
        const p2 = Vec2.add(a, Vec2.mul(a.dir, Vec2.dist(a, b) / 4));
        const p3 = Vec2.sub(b, Vec2.mul(b.dir, Vec2.dist(a, b) / 4));
        const p4 = b;


        let pointLine;
        if (callback) {
            let curvePoints;
            curvePoints = getBezierPoints(p1, p2, p3, p4, 20);
            pointLine = new PointLine({points: curvePoints});
        } else {
            pointLine = new PointLine({points: [p1, p4]});
        }

        //interate over curve with spacing and callback
        const len = pointLine.getLength();
        let tempSpacing = mix(lastSpacing, spacing, clamp(lastDot / len, 0, 1));
        let d = lastDot;
        for (; d <= len; d += tempSpacing) {
            tempSpacing = mix(lastSpacing, spacing, clamp(d / len, 0, 1));
            const point = pointLine.getAtDist(d);
            const angle = lastCallbackPoint ? pointsToAngleDeg(lastCallbackPoint, point) : undefined;
            if (callback) {
                callback({
                    x: point.x,
                    y: point.y,
                    t: d / len,
                    angle: angle,
                    dAngle: lastCallbackPoint ? angle - lastAngle : 0
                });
            }
            lastCallbackPoint = point;
            lastAngle = angle;
        }

        if (callback) {
            lastDot = d - len;
        } else {
            lastDot = 0;
            controlsCallback({p1: p1, p2: p2, p3: p3, p4: p4});
        }

        lastSpacing = spacing;
    };

    this.addFinal = function(spacing, callback, controlsCallback) {
        if (pointArr.length < 2) {
            return;
        }

        const p1 = pointArr[pointArr.length - 2];
        const p2 = pointArr[pointArr.length - 1];

        const newP = Vec2.add(p2, Vec2.sub(p2, p1));

        _this.add(newP.x, newP.y, spacing, callback, controlsCallback);
    };

};

/**
 * from glfx.script by evanW:
 * from SplineInterpolator.cs in the Paint.NET source code
 *
 * points go 0 - 1. I think.
 *
 * @param points
 * @constructor
 */
export const SplineInterpolator = function (points) {
    const n = points.length;
    this.xa = [];
    this.ya = [];
    this.u = [];
    this.y2 = [];
    let i;

    const first = points[0][0];
    const last = points[points.length - 1][0];

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

        this.u[i] = (6.0 * ddydx / wx - sig * this.u[i - 1]) / p;
    }

    this.y2[n - 1] = 0;

    // This is the backsubstitution loop of the tridiagonal algorithm
    for (i = n - 2; i >= 0; --i) {
        this.y2[i] = this.y2[i] * this.y2[i + 1] + this.u[i];
    }

    this.getFirstX = function () {
        return first;
    };
    this.getLastX = function () {
        return last;
    };
};

SplineInterpolator.prototype.interpolate = function (x) {
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
    return a * this.ya[klo] + b * this.ya[khi] +
        ((a * a * a - a) * this.y2[klo] + (b * b * b - b) * this.y2[khi]) * (h * h) / 6.0;
};

/**
 * find x to y. simply by stepping through. suboptimal, so don't call often.
 * searches in x 0-1 range
 *
 * @param y
 * @param resolution
 */
SplineInterpolator.prototype.findX = function (y, resolution) {
    let x = null;
    let dist = null;
    for (let i = 0; i <= resolution; i++) {
        const tempX = i / resolution;
        const tempY = this.interpolate(tempX);
        if (x === null) {
            x = tempX;
            dist = Math.abs(tempY - y);
            continue;
        }

        const tempDist = Math.abs(tempY - y);

        if (tempDist < dist) {
            x = tempX;
            dist = tempDist;
        } else {
            //distance increasing
            break;
        }
    }
    return x;
};

/**
 * input for a spline, following curve of quadratic function x^2 [0 - 1]
 * returns [[0, startVal], ..., [1, endVal]]
 * @param startVal
 * @param endVal
 * @param stepSize
 * @returns {[]}
 */
export const quadraticSplineInput = function (startVal, endVal, stepSize) {
    function round(v, dec) {
        return Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec);
    }

    const resultArr = [];
    for (let i = 0; i <= 1; i += stepSize) {
        resultArr.push([round(i, 4), round(startVal + Math.pow(i, 2) * (endVal - startVal), 4)]);
    }
    return resultArr;
};