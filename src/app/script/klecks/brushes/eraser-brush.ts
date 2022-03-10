import {BB} from '../../bb/bb';
import {IHistoryEntry, KlHistoryInterface} from '../history/kl-history';
import {KL} from '../kl';

export function EraserBrush() {
    let context;
    let history: KlHistoryInterface = new KL.DecoyKlHistory();
    let historyEntry: IHistoryEntry;

    let size = 30, spacing = 0.4, opacity = 1;
    let sizePressure = true, opacityPressure = false;
    let lastDot, lastInput = {x: 0, y: 0, pressure: 0};
    let lastInput2 = {x: 0, y: 0, pressure: 0};
    let started = false;

    let bezierLine;
    let isBaseLayer = false;
    let isTransparentBG = false;

    function drawDot(x, y, size, opacity) {

        context.save();
        if (isBaseLayer) {
            if (isTransparentBG) {
                context.globalCompositeOperation = "destination-out";
            } else {
                context.globalCompositeOperation = "source-atop";
            }
        } else {
            context.globalCompositeOperation = "destination-out";
        }
        let radgrad = context.createRadialGradient(size, size, 0, size, size, size);
        let sharpness = Math.pow(opacity, 2);
        sharpness = Math.max(0, Math.min((size - 1) / size, sharpness));
        let oFac = Math.max(0, Math.min(1, opacity));
        let localOpacity = 2 * oFac - oFac * oFac;
        radgrad.addColorStop(sharpness, "rgba(255, 255, 255, " + localOpacity + ")");
        radgrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        context.fillStyle = radgrad;
        context.translate(x - size, y - size);
        context.fillRect(0, 0, size * 2, size * 2);
        context.restore();
    }

    function continueLine(x, y, p) {
        p = Math.max(0, Math.min(1, p));
        let localPressure;
        let localOpacity;
        let localSize = (sizePressure) ? Math.max(0.1, p * size) : Math.max(0.1, size);

        let bdist = Math.max(1, Math.max(0.5, 1 - opacity) * localSize * spacing);

        function bezierCallback(val) {
            let factor = val.t;
            localPressure = lastInput2.pressure * (1 - factor) + p * factor;
            localOpacity = (opacityPressure) ? (opacity * localPressure * localPressure) : opacity;
            localSize = (sizePressure) ? Math.max(0.1, localPressure * size) : Math.max(0.1, size);

            drawDot(val.x, val.y, localSize, localOpacity);
        }

        if (x === null) {
            bezierLine.addFinal(bdist, bezierCallback);
        } else {
            bezierLine.add(x, y, bdist, bezierCallback);
        }
    }


    this.startLine = function (x, y, p) {
        historyEntry = {
            tool: ["brush", "EraserBrush"],
            actions: []
        };
        historyEntry.actions.push({
            action: "opacityPressure",
            params: [opacityPressure]
        });
        historyEntry.actions.push({
            action: "sizePressure",
            params: [sizePressure]
        });
        historyEntry.actions.push({
            action: "setSize",
            params: [size]
        });
        historyEntry.actions.push({
            action: "setOpacity",
            params: [opacity]
        });
        historyEntry.actions.push({
            action: "setTransparentBG",
            params: [isTransparentBG]
        });

        isBaseLayer = 0 === context.canvas.index;

        p = Math.max(0, Math.min(1, p));
        let localOpacity = (opacityPressure) ? (opacity * p * p) : opacity;
        let localSize = (sizePressure) ? Math.max(0.1, p * size) : Math.max(0.1, size);

        started = true;
        if (localSize > 1) {
            drawDot(x, y, localSize, localOpacity);
        }
        lastDot = localSize * spacing;
        lastInput.x = x;
        lastInput.y = y;
        lastInput.pressure = p;
        lastInput2 = BB.copyObj(lastInput);

        bezierLine = new BB.BezierLine();
        bezierLine.add(x, y, 0, function () {
        });

        historyEntry.actions.push({
            action: "startLine",
            params: [x, y, p]
        });
    };
    this.goLine = function (x, y, p) {
        if (!started) {
            return;
        }
        historyEntry.actions.push({
            action: "goLine",
            params: [x, y, p]
        });

        continueLine(x, y, lastInput.pressure);

        lastInput2 = BB.copyObj(lastInput);
        lastInput.x = x;
        lastInput.y = y;
        lastInput.pressure = p;
    };
    this.endLine = function () {

        if (bezierLine) {
            continueLine(null, null, lastInput.pressure);
        }

        started = false;
        bezierLine = undefined;

        if (historyEntry) {
            historyEntry.actions.push({
                action: "endLine",
                params: []
            });
            history.push(historyEntry);
            historyEntry = undefined;
        }
    };
    //cheap n' ugly
    this.drawLineSegment = function (x1, y1, x2, y2) {

        isBaseLayer = 0 === context.canvas.index;

        lastInput.x = x2;
        lastInput.y = y2;

        if (started || x1 === undefined) {
            return;
        }

        let mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
        let eX = (x2 - x1) / mouseDist;
        let eY = (y2 - y1) / mouseDist;
        let loopDist;
        let bdist = Math.max(1, Math.max(0.5, 1 - opacity) * size * spacing);
        lastDot = 0;
        for (loopDist = lastDot; loopDist <= mouseDist; loopDist += bdist) {
            drawDot(x1 + eX * loopDist, y1 + eY * loopDist, size, opacity);
        }


        let historyEntry = {
            tool: ["brush", "EraserBrush"],
            actions: []
        };
        historyEntry.actions.push({
            action: "opacityPressure",
            params: [opacityPressure]
        });
        historyEntry.actions.push({
            action: "sizePressure",
            params: [sizePressure]
        });
        historyEntry.actions.push({
            action: "setSize",
            params: [size]
        });
        historyEntry.actions.push({
            action: "setOpacity",
            params: [opacity]
        });
        historyEntry.actions.push({
            action: "setTransparentBG",
            params: [isTransparentBG]
        });

        historyEntry.actions.push({
            action: "drawLineSegment",
            params: [x1, y1, x2, y2]
        });
        history.push(historyEntry);
    };

    //IS
    this.isDrawing = function () {
        return started;
    };
    //SET
    /*this.setAlpha = function(a) {
        lastInput = {};
        alpha = a;
        updateAlphaCanvas();
    };*/
    this.setContext = function (c) {
        context = c;
    };
    this.setHistory = function (l: KlHistoryInterface) {
        history = l;
    };
    this.setSize = function (s) {
        size = s;
    };
    this.setOpacity = function (o) {
        opacity = o;
    };
    this.sizePressure = function (b) {
        sizePressure = b;
    };
    this.opacityPressure = function (b) {
        opacityPressure = b;
    };
    this.setTransparentBG = function (b) {
        isTransparentBG = b == true;
    };
    //GET
    this.getSize = function () {
        return size;
    };
    this.getOpacity = function () {
        return opacity;
    };
}