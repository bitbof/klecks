import {BB} from '../../bb/bb';
import {alphaImArr} from './brushes-common';
import {IHistoryEntry, KlHistoryInterface} from '../history/kl-history';
import {KL} from '../kl';


export function PenBrush() {

    let context;
    let history: KlHistoryInterface = new KL.DecoyKlHistory();
    let historyEntry: IHistoryEntry;

    let settingColor, settingSize = 2, settingSpacing = 0.8489, settingOpacity = 1;
    let settingColorStr;
    let settingHasSizePressure = true, settingHasOpacityPressure = false;
    let settingLockLayerAlpha = false;
    let ALPHA_CIRCLE = 0, ALPHA_CHALK = 1, ALPHA_CAL = 2, ALPHA_SQUARE = 3;
    let settingAlphaId = ALPHA_CIRCLE;

    let lineToolLastDot;
    let lastInput = {x: 0, y: 0, pressure: 0};
    let lastInput2 = {x: 0, y: 0, pressure: 0};

    let isDrawing = false;
    let alphaOpacityArr = [1, 0.9, 1, 1];

    //mipmapping
    let alphaCanvas128 = BB.canvas(128, 128);
    let alphaCanvas64 = BB.canvas(64, 64);
    let alphaCanvas32 = BB.canvas(32, 32);

    let bezierLine = null;

    let twoPI = Math.PI * 2;
    let hasDrawnDot = false; // current stroke has drawn at least one dot
    let inputArr: {x: number, y: number, pressure: number}[];

    // pressure: 0-1
    function calcOpacity(pressure: number) {
        return settingOpacity * (settingHasOpacityPressure ? pressure * pressure : 1);
    }

    function updateAlphaCanvas() {
        if (settingAlphaId === ALPHA_CIRCLE || settingAlphaId === ALPHA_SQUARE) {
            return;
        }

        let instructionArr = [
            [alphaCanvas128, 128],
            [alphaCanvas64, 64],
            [alphaCanvas32, 32]
        ];

        let ctx;

        for (let i = 0; i < instructionArr.length; i++) {
            ctx = (instructionArr[i][0] as any).getContext("2d");

            ctx.save();
            ctx.clearRect(0, 0, instructionArr[i][1], instructionArr[i][1]);

            ctx.fillStyle = "rgba(" + settingColor.r + ", " + settingColor.g + ", " + settingColor.b + ", " + alphaOpacityArr[settingAlphaId] + ")";
            ctx.fillRect(0, 0, instructionArr[i][1], instructionArr[i][1]);

            ctx.globalCompositeOperation = "destination-in";
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(alphaImArr[settingAlphaId], 0, 0, instructionArr[i][1], instructionArr[i][1]);

            ctx.restore();
        }
    }

    /**
     *
     *
     * @param x
     * @param y
     * @param size
     * @param opacity
     * @param angle
     * @param before - [x, y, size, opacity, angle] the drawDot call before
     */
    function drawDot(x, y, size, opacity, angle?, before?) {
        if (size <= 0) {
            return;
        }

        if (settingLockLayerAlpha) {
            context.globalCompositeOperation = "source-atop";
        }

        if (!before || before[3] !== opacity) {
            context.globalAlpha = opacity;
        }

        if (!before && (settingAlphaId === ALPHA_CIRCLE || settingAlphaId === ALPHA_SQUARE)) {
            context.fillStyle = settingColorStr;
        }

        if (settingAlphaId === ALPHA_CIRCLE) {
            context.beginPath();
            context.arc(x, y, size, 0, twoPI);
            context.closePath();
            context.fill();
            hasDrawnDot = true;

        } else if (settingAlphaId === ALPHA_SQUARE) {
            if (angle !== undefined) {
                context.save();
                context.translate(x, y);
                context.rotate(angle / 180 * Math.PI);
                context.fillRect(-size, -size, size * 2, size * 2);
                context.restore();
                hasDrawnDot = true;
            }

        } else { // other brush alphas
            context.save();
            context.translate(x, y);
            let targetMipmap = alphaCanvas128;
            if (size <= 32 && size > 16) {
                targetMipmap = alphaCanvas64;
            } else if (size <= 16) {
                targetMipmap = alphaCanvas32;
            }
            context.scale(size, size);
            if (settingAlphaId === ALPHA_CHALK) {
                context.rotate(((x + y) * 53123) % twoPI); // without mod it sometimes looks different
            }
            context.drawImage(targetMipmap, -1, -1, 2, 2);

            context.restore();
            hasDrawnDot = true;
        }
    }

    function continueLine(x, y, size, pressure) {
        if (bezierLine === null) {
            bezierLine = new BB.BezierLine();
            bezierLine.add(lastInput.x, lastInput.y, 0, function(){});
        }

        let drawArr = []; //draw instructions. will be all drawn at once

        function dotCallback(val) {
            let localPressure = BB.mix(lastInput2.pressure, pressure, val.t);
            let localOpacity = calcOpacity(localPressure);
            let localSize = Math.max(0.1, settingSize * (settingHasSizePressure ? localPressure : 1));
            drawArr.push([val.x, val.y, localSize, localOpacity, val.angle]);
        }

        let localSpacing = size * settingSpacing;
        if (x === null) {
            bezierLine.addFinal(localSpacing, dotCallback);
        } else {
            bezierLine.add(x, y, localSpacing, dotCallback);
        }

        // execute draw instructions
        context.save();
        let before;
        for (let i = 0; i < drawArr.length; i++) {
            let item = drawArr[i];
            drawDot(item[0], item[1], item[2], item[3], item[4], before);
            before = item;
        }
        context.restore();
    }

    //------------------ interface ---------------------------------------------------


    this.startLine = function (x, y, p) {
        historyEntry = {
            tool: ["brush", "PenBrush"],
            actions: []
        };
        historyEntry.actions.push({
            action: "opacityPressure",
            params: [settingHasOpacityPressure]
        });
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
            action: "setAlpha",
            params: [settingAlphaId]
        });
        historyEntry.actions.push({
            action: "setLockAlpha",
            params: [settingLockLayerAlpha]
        });

        p = BB.clamp(p, 0, 1);
        let localOpacity = calcOpacity(p);
        let localSize = settingHasSizePressure ? Math.max(0.1, p * settingSize) : Math.max(0.1, settingSize);

        hasDrawnDot = false;

        isDrawing = true;
        context.save();
        drawDot(x, y, localSize, localOpacity);
        context.restore();

        lineToolLastDot = localSize * settingSpacing;
        lastInput.x = x;
        lastInput.y = y;
        lastInput.pressure = p;
        lastInput2.pressure = p;

        inputArr = [{
            x,
            y,
            pressure: p,
        }];

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

        let pressure = BB.clamp(p, 0, 1);
        let localSize = settingHasSizePressure ? Math.max(0.1, lastInput.pressure * settingSize) : Math.max(0.1, settingSize);

        context.save();
        continueLine(x, y, localSize, lastInput.pressure);

        /*context.fillStyle = 'red';
        context.fillRect(Math.floor(x), Math.floor(y - 10), 1, 20);
        context.fillRect(Math.floor(x - 10), Math.floor(y), 20, 1);*/

        context.restore();

        lastInput.x = x;
        lastInput.y = y;
        lastInput2.pressure = lastInput.pressure;
        lastInput.pressure = pressure;

        inputArr.push({
            x,
            y,
            pressure: p,
        });
    };

    this.endLine = function (x, y) {

        let localSize = settingHasSizePressure ? Math.max(0.1, lastInput.pressure * settingSize) : Math.max(0.1, settingSize);
        context.save();
        continueLine(null, null, localSize, lastInput.pressure);
        context.restore();

        isDrawing = false;

        if (settingAlphaId === ALPHA_SQUARE && !hasDrawnDot) {
            // find max pressure input, use that one
            let maxInput = inputArr[0];
            inputArr.forEach(item => {
                if (item.pressure > maxInput.pressure) {
                    maxInput = item;
                }
            })

            context.save();
            let p = BB.clamp(maxInput.pressure, 0, 1);
            let localOpacity = calcOpacity(p);
            drawDot(maxInput.x, maxInput.y, localSize, localOpacity, 0);
            context.restore();
        }

        bezierLine = null;

        if (historyEntry) {
            historyEntry.actions.push({
                action: "endLine",
                params: [x, y]
            });
            history.push(historyEntry);
            historyEntry = undefined;
        }

        hasDrawnDot = false;
        inputArr = [];
    };
    //cheap n' ugly
    this.drawLineSegment = function (x1, y1, x2, y2) {
        lastInput.x = x2;
        lastInput.y = y2;
        lastInput.pressure = 1;

        if (isDrawing || x1 === undefined) {
            return;
        }

        let angle = BB.pointsToAngleDeg({x:x1, y:y1}, {x:x2, y:y2});
        let mouseDist = Math.sqrt(Math.pow(x2 - x1, 2.0) + Math.pow(y2 - y1, 2.0));
        let eX = (x2 - x1) / mouseDist;
        let eY = (y2 - y1) / mouseDist;
        let loopDist;
        let bdist = settingSize * settingSpacing;
        lineToolLastDot = settingSize * settingSpacing;
        context.save();
        for (loopDist = lineToolLastDot; loopDist <= mouseDist; loopDist += bdist) {
            drawDot(x1 + eX * loopDist, y1 + eY * loopDist, settingSize, settingOpacity, angle);
        }
        context.restore();


        let historyEntry = {
            tool: ["brush", "PenBrush"],
            actions: []
        };
        historyEntry.actions.push({
            action: "opacityPressure",
            params: [settingHasOpacityPressure]
        });
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
            action: "setAlpha",
            params: [settingAlphaId]
        });
        historyEntry.actions.push({
            action: "setLockAlpha",
            params: [settingLockLayerAlpha]
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
    this.setAlpha = function (a) {
        if (settingAlphaId === a) {
            return;
        }
        settingAlphaId = a;
        updateAlphaCanvas();
    };
    this.setColor = function (c) {
        if (settingColor === c) {
            return;
        }
        settingColor = {r: c.r, g: c.g, b: c.b};
        settingColorStr = "rgb(" + settingColor.r + "," + settingColor.g + "," + settingColor.b + ")";
        updateAlphaCanvas();
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
    this.getLockAlpha = function (b) {
        return settingLockLayerAlpha;
    };
}