import {BB} from '../../bb/bb';
import {IHistoryEntry, KlHistoryInterface} from '../history/kl-history';
import {KL} from '../kl';

export function PixelBrush() {

    let context;
    let history: KlHistoryInterface = new KL.DecoyKlHistory();
    let historyEntry: IHistoryEntry;

    let settingColor, settingSize = 0.5, settingSpacing = 0.9, settingOpacity = 1;
    let settingColorStr;
    let settingHasSizePressure = true, settingHasOpacityPressure = false;
    let settingLockLayerAlpha = false;
    let settingIsEraser = false;
    let settingUseDither = true;

    let lineToolLastDot;
    let lastInput = {x: 0, y: 0, pressure: 0};
    let lastInput2 = {x: 0, y: 0, pressure: 0};

    let isDrawing = false;
    let bezierLine = null;
    let twoPI = Math.PI * 2;


    let ditherCanvas = BB.canvas(4, 4);
    let ditherCtx = ditherCanvas.getContext('2d');
    let ditherPattern;
    let ditherArr = [
        [3, 2],
        [1, 0],
        [3, 0],
        [1, 2],
        [2, 1],
        [0, 3],
        [0, 1],
        [2, 3],

        [2, 0],
        [0, 2],
        [0, 0],
        [2, 2],
        [1, 1],
        [3, 3],
        [3, 1],
        [1, 3]
    ];

    function updateDither() {
        ditherCtx.clearRect(0, 0, 4, 4);
        ditherCtx.fillStyle = settingIsEraser ? '#fff' : settingColorStr;
        for (let i = 0; i < Math.max(1, Math.round(settingOpacity * ditherArr.length)); i++) {
            ditherCtx.fillRect(ditherArr[i][0], ditherArr[i][1], 1, 1);
        }
        ditherPattern = context.createPattern(ditherCanvas, 'repeat');
    }


    /**
     * Tests p1->p2 or p3->p4 deviate in their direction more than max, compared to p1->p4
     * @param p1
     * @param p2
     * @param p3
     * @param p4
     * @param maxAngleRad
     */
    function cubicCurveOverThreshold(p1, p2, p3, p4, max) {
        let d = BB.Vec2.nor({
            x: p4.x - p1.x,
            y: p4.y - p1.y
        });
        let d2 = BB.Vec2.nor({
            x: p2.x - p1.x,
            y: p2.y - p1.y
        });
        let d3 = BB.Vec2.nor({
            x: p4.x - p3.x,
            y: p4.y - p3.y
        });
        let a2 = Math.abs(BB.Vec2.angle(d, d2) % Math.PI) / Math.PI * 180;
        let a3 = Math.abs(BB.Vec2.angle(d, d3) % Math.PI) / Math.PI * 180;

        return Math.max(BB.Vec2.dist(d, d2), BB.Vec2.dist(d, d3)) > max;
    }

    //bresenheim line drawing
    function plotLine(x0, y0, x1, y1, skipFirst) {
        context.save();

        if (settingIsEraser) {
            context.fillStyle = settingUseDither ? ditherPattern : '#fff';
            if (settingLockLayerAlpha) {
                context.globalCompositeOperation = "source-atop";
            } else {
                context.globalCompositeOperation = "destination-out";
            }
        } else {
            context.fillStyle = settingUseDither ? ditherPattern : settingColorStr;
            if (settingLockLayerAlpha) {
                context.globalCompositeOperation = "source-atop";
            }
        }
        context.globalAlpha = settingUseDither ? 1 : settingOpacity;

        x0 = Math.floor(x0);
        y0 = Math.floor(y0);
        x1 = Math.floor(x1);
        y1 = Math.floor(y1);

        let dX = Math.abs(x1 - x0);
        let sX = x0 < x1 ? 1 : -1;
        let dY = -Math.abs(y1 - y0);
        let sY = y0 < y1 ? 1 : -1;
        let err = dX + dY;
        while (true) {
            if (skipFirst) {
                skipFirst = false;
            } else {
                context.fillRect(x0, y0, 1, 1);
            }
            if (x0 === x1 && y0 === y1) {
                break;
            }
            let e2 = 2 * err;
            if (e2 >= dY) {
                err += dY;
                x0 += sX;
            }
            if (e2 <= dX) {
                err += dX;
                y0 += sY;
            }
        }

        context.restore();
    }

    function plotCubicBezierLine(p1, p2, p3, p4) {

        let isOverThreshold = cubicCurveOverThreshold(p1, p2, p3, p4, 0.1);

        p1.x = Math.floor(p1.x);
        p1.y = Math.floor(p1.y);
        p4.x = Math.floor(p4.x);
        p4.y = Math.floor(p4.y);

        let dist = BB.dist(p1.x, p1.y, p4.x, p4.y);
        if (!isOverThreshold || dist < 7) {
            plotLine(p1.x, p1.y, p4.x, p4.y, true);
            return;
        }

        let n = Math.max(2, Math.round(dist / 4));
        let pointArr = [];
        for (let i = 0; i <= n; i++) {
            let t = i / n;
            let a = Math.pow(1 - t, 3);
            let b = 3 * t * Math.pow(1 - t, 2);
            let c = 3 * Math.pow(t, 2) * (1 - t);
            let d = Math.pow(t, 3);
            pointArr.push({
                x: a * p1.x + b * p2.x + c * p3.x + d * p4.x,
                y: a * p1.y + b * p2.y + c * p3.y + d * p4.y
            });
        }

        for (let i = 0; i < n; i++) {
            plotLine(
                Math.round(pointArr[i].x),
                Math.round(pointArr[i].y),
                Math.round(pointArr[i + 1].x),
                Math.round(pointArr[i + 1].y),
                true
            );
        }
    }

    function drawDot(x, y, size, opacity, angle?) {
        context.save();
        if (settingIsEraser) {
            context.fillStyle = settingUseDither ? ditherPattern : '#fff';
            if (settingLockLayerAlpha) {
                context.globalCompositeOperation = "source-atop";
            } else {
                context.globalCompositeOperation = "destination-out";
            }
        } else {
            context.fillStyle = settingUseDither ? ditherPattern : settingColorStr;
            if (settingLockLayerAlpha) {
                context.globalCompositeOperation = "source-atop";
            }
        }
        context.globalAlpha = settingUseDither ? 1 : opacity;
        context.fillRect(
            Math.round(x + -size),
            Math.round(y + -size),
            Math.round(size * 2),
            Math.round(size * 2)
        );
        context.restore();
    }


    function continueLine(x, y, size, pressure) {
        if (bezierLine === null) {
            bezierLine = new BB.BezierLine();
            bezierLine.add(lastInput.x, lastInput.y, 0, function () {
            });
        }

        context.save();

        function dotCallback(val) {
            let localPressure = BB.mix(lastInput2.pressure, pressure, val.t);
            let localOpacity = settingOpacity * (settingHasOpacityPressure ? (localPressure * localPressure) : 1);
            let localSize = Math.max(0.5, settingSize * (settingHasSizePressure ? localPressure : 1));
            drawDot(val.x, val.y, localSize, localOpacity, val.angle);
        }

        function controlCallback(controlObj) {
            plotCubicBezierLine(controlObj.p1, controlObj.p2, controlObj.p3, controlObj.p4);
        }

        if (Math.round(settingSize * 2) === 1) {
            if (x === null) {
                bezierLine.addFinal(4, null, controlCallback);
            } else {
                bezierLine.add(x, y, 4, null, controlCallback);
            }

        } else {
            let localSpacing = size * settingSpacing;

            if (x === null) {
                bezierLine.addFinal(localSpacing, dotCallback);
            } else {
                bezierLine.add(x, y, localSpacing, dotCallback);
            }
        }

        context.restore();
    }

    //------------------ interface ---------------------------------------------------


    this.startLine = function (x, y, p) {
        historyEntry = {
            tool: ["brush", "PixelBrush"],
            actions: []
        };
        historyEntry.actions.push({
            action: "sizePressure",
            params: [settingHasSizePressure]
        });
        historyEntry.actions.push({
            action: "setSize",
            params: [settingSize]
        });
        historyEntry.actions.push({
            action: "setSpacing",
            params: [settingSpacing]
        });
        historyEntry.actions.push({
            action: "setOpacity",
            params: [settingOpacity]
        });
        historyEntry.actions.push({
            action: "setColor",
            params: [settingColor]
        });
        historyEntry.actions.push({
            action: "setLockAlpha",
            params: [settingLockLayerAlpha]
        });
        historyEntry.actions.push({
            action: "setIsEraser",
            params: [settingIsEraser]
        });
        historyEntry.actions.push({
            action: "setUseDither",
            params: [settingUseDither]
        });

        if (settingUseDither) {
            updateDither();
        }

        p = Math.max(0, Math.min(1, p));
        let localOpacity = settingHasOpacityPressure ? (settingOpacity * p * p) : settingOpacity;
        let localSize = settingHasSizePressure ? Math.max(0.5, p * settingSize) : Math.max(0.5, settingSize);

        isDrawing = true;
        drawDot(x, y, localSize, localOpacity);
        lineToolLastDot = localSize * settingSpacing;
        lastInput.x = x;
        lastInput.y = y;
        lastInput.pressure = p;
        lastInput2 = BB.copyObj(lastInput);

        historyEntry.actions.push({
            action: "startLine",
            params: [x, y, p]
        });
    };

    this.goLine = function (x, y, p) {
        if (!isDrawing) {
            return;
        }
        historyEntry.actions.push({
            action: "goLine",
            params: [x, y, p]
        });

        //debug
        //drawDot(x, y, 1, 0.5);

        let pressure = BB.clamp(p, 0, 1);
        let localSize = settingHasSizePressure ? Math.max(0.1, lastInput.pressure * settingSize) : Math.max(0.1, settingSize);

        continueLine(x, y, localSize, lastInput.pressure);

        lastInput2 = BB.copyObj(lastInput);
        lastInput.x = x;
        lastInput.y = y;
        lastInput.pressure = pressure;
    };

    this.endLine = function (x, y) {

        let localSize = settingHasSizePressure ? Math.max(0.1, lastInput.pressure * settingSize) : Math.max(0.1, settingSize);
        continueLine(null, null, localSize, lastInput.pressure);

        //debug
        //drawDot(lastInput.x, lastInput.y, 3, 1);
        //drawDot(x, y, 10, 0.1);

        isDrawing = false;

        bezierLine = null;

        if (historyEntry) {
            historyEntry.actions.push({
                action: "endLine",
                params: [x, y]
            });
            history.push(historyEntry);
            historyEntry = undefined;
        }
    };
    //cheap n' ugly
    this.drawLineSegment = function (x1, y1, x2, y2) {
        lastInput.x = x2;
        lastInput.y = y2;
        lastInput.pressure = 1;

        if (isDrawing || x1 === undefined) {
            return;
        }

        if (settingUseDither) {
            updateDither();
        }

        if (Math.round(settingSize * 2) === 1) {
            plotLine(x1, y1, x2, y2, true);
        } else {
            let angle = BB.pointsToAngleDeg({x: x1, y: y1}, {x: x2, y: y2});
            let mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
            let eX = (x2 - x1) / mouseDist;
            let eY = (y2 - y1) / mouseDist;
            let loopDist;
            let bdist = settingSize * settingSpacing;
            lineToolLastDot = settingSize * settingSpacing;
            for (loopDist = lineToolLastDot; loopDist <= mouseDist; loopDist += bdist) {
                drawDot(x1 + eX * loopDist, y1 + eY * loopDist, settingSize, settingOpacity, angle);
            }
        }

        let historyEntry = {
            tool: ["brush", "PixelBrush"],
            actions: []
        };
        historyEntry.actions.push({
            action: "sizePressure",
            params: [settingHasSizePressure]
        });
        historyEntry.actions.push({
            action: "setSize",
            params: [settingSize]
        });
        historyEntry.actions.push({
            action: "setSpacing",
            params: [settingSpacing]
        });
        historyEntry.actions.push({
            action: "setOpacity",
            params: [settingOpacity]
        });
        historyEntry.actions.push({
            action: "setColor",
            params: [settingColor]
        });
        historyEntry.actions.push({
            action: "setLockAlpha",
            params: [settingLockLayerAlpha]
        });
        historyEntry.actions.push({
            action: "setIsEraser",
            params: [settingIsEraser]
        });
        historyEntry.actions.push({
            action: "setUseDither",
            params: [settingUseDither]
        });

        historyEntry.actions.push({
            action: "drawLineSegment",
            params: [x1, y1, x2, y2]
        });
        history.push(historyEntry);
    };

    //IS
    this.isDrawing = function () {
        return isDrawing;
    };
    //SET
    this.setColor = function (c) {
        if (settingColor === c) {
            return;
        }
        settingColor = c;
        settingColorStr = "rgb(" + settingColor.r + "," + settingColor.g + "," + settingColor.b + ")";
    };
    this.setContext = function (c) {
        context = c;
    };
    this.setHistory = function (l: KlHistoryInterface) {
        history = l;
    };
    this.setSize = function (s) {
        settingSize = s;
    };
    this.setOpacity = function (o) {
        settingOpacity = o;
    };
    this.setSpacing = function (s) {
        settingSpacing = s;
    };
    this.sizePressure = function (b) {
        settingHasSizePressure = b;
    };
    this.opacityPressure = function (b) {
        settingHasOpacityPressure = b;
    };
    this.setLockAlpha = function (b) {
        settingLockLayerAlpha = b;
    };
    this.setIsEraser = function (b) {
        settingIsEraser = !!b;
    };
    this.setUseDither = function (b) {
        settingUseDither = !!b;
    };
    //GET
    this.getSpacing = function () {
        return settingSpacing;
    };
    this.getSize = function () {
        return settingSize;
    };
    this.getOpacity = function () {
        return settingOpacity;
    };
    this.getLockAlpha = function () {
        return settingLockLayerAlpha;
    };
    this.getIsEraser = function () {
        return settingIsEraser;
    };
    this.getUseDither = function () {
        return settingUseDither;
    };
}