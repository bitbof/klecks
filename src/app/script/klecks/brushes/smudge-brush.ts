import {BB} from '../../bb/bb';
import {IVector2D} from '../../bb/bb.types';



// let statCount = 1;
// let statAcc = 0;
// stats on win10, chrome, size 100, opacity 80, smudge()
// unoptimized: 1 ms
// minimal: 0.09 ms
// minimal + circle: 0.5ms
// minimal + circle + ix, iy: 0.23ms
// unoptimized + ix, iy: 0.64 ms
// unoptimized + ix, iy + sans rounding: 0.61 ms
// ix, iy + sans rounding + sans random: 0.32ms
// ix, iy + sans rounding + fast random: 0.46 ms
// ix, iy + sans rounding + fast random + offset const: 0.48 ms



interface IBounds {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface ISmudgeParams {
    aP: IVector2D;
    bP: IVector2D;
    size: {
        w: number;
        h: number;
    };
    brush: {
        center: IVector2D,
        size: number;
        opacity: number;
        alphaLock: boolean;
    };
}


/**
 * determine bounds of smudge
 * @param imWidth
 * @param imHeight
 * @param aP
 * @param bP
 * @param size
 */
function prepSmudge(
    imWidth: number,
    imHeight: number,
    aP: IVector2D, // top left of source, integers
    bP: IVector2D, // top left of dest, integers
    size: {w: number; h: number}, // size of both rectangles, integers
): {
    aP: IVector2D,
    bP: IVector2D,
    size: {w: number; h: number},
} {

    if (aP.x === bP.x && aP.y === bP.y) {
        return null;
    }

    aP = BB.copyObj(aP);
    bP = BB.copyObj(bP);
    size = BB.copyObj(size);

    // corner behavior
    // cut down rectangles, if a or b go outside
    // i.e. if user drags partially or fully outside the canvas
    {
        let top = 0;
        let right = 0;
        let bottom = 0;
        let left = 0;

        if (aP.x < 0) {
            left = -aP.x;
        }
        if (aP.y < 0) {
            top = -aP.y;
        }
        if (bP.x < 0) {
            left = Math.max(left, -bP.x);
        }
        if (bP.y < 0) {
            top = Math.max(top, -bP.y);
        }
        if (aP.x + size.w > imWidth) {
            right = aP.x + size.w - imWidth;
        }
        if (aP.y + size.h > imHeight) {
            bottom = aP.y + size.h - imHeight;
        }
        if (bP.x + size.w > imWidth) {
            right = Math.max(right, bP.x + size.w - imWidth);
        }
        if (bP.y + size.h > imHeight) {
            bottom = Math.max(bottom, bP.y + size.h - imHeight);
        }

        aP.x += left;
        bP.x += left;
        aP.y += top;
        bP.y += top;

        size.w = size.w - left - right;
        size.h = size.h - top - bottom;
        if (size.w <= 0 || size.h <= 0) {
            return null;
        }
    }

    return {
        aP: {
            x: aP.x,
            y: aP.y,
        },
        bP: {
            x: bP.x,
            y: bP.y,
        },
        size: {
            w: size.w,
            h: size.h,
        }
    };
}


/**
 * Pixel operations that do the smudging via ImageData
 * @param imageData
 * @param p
 */
function smudge(imageData: ImageData, p : ISmudgeParams) {

    p = BB.copyObj(p);

    const cSize = p.brush.size;
    const cX = p.brush.center.x;
    const cY = p.brush.center.y;

    /*if (statCount % 1000 === 0) {
        console.log(statAcc / 1000);
        statAcc = 0;
    }
    let start = performance.now();*/


    // determine offset
    let aIndex = p.aP.y * imageData.width + p.aP.x;
    let bIndex = p.bP.y * imageData.width + p.bP.x;
    const offset = (bIndex - aIndex) * 4;

    // array with random numbers. faster than Math.random()
    let randI = 0;
    const randLen = Math.floor(25 + Math.random() * 25);
    const randArr = [];
    for (let i = 0; i < randLen; i++) {
        randArr[i] = Math.random();
    }

    const softness = Math.max(3, Math.min(8, p.brush.size - 8));

    const pixel = (ai, bi, ix, iy) => {

        const dist = Math.abs(BB.dist(cX, cY, ix, iy));
        const fac = 1 - p.brush.opacity * (1 - BB.clamp((dist - (cSize - softness)) / softness, 0, 1));

        if (fac === 1) {
            return;
        }

        if (!imageData.data[ai + 3]) {

        } else if (!imageData.data[bi + 3]) { // don't mix if target fully transparent. pixel might have a strange color.
            imageData.data[bi] = imageData.data[ai + 0];
            imageData.data[bi + 1] = imageData.data[ai + 1];
            imageData.data[bi + 2] = imageData.data[ai + 2];
        } else {

            // consider alpha ratio. If a has lower alpha than b, then b should be stronger, and vice versa
            // not totally accurate. TODO research accurate smudging
            let fac2;
            if (imageData.data[ai + 3] < imageData.data[bi + 3]) {
                fac2 = 1 - imageData.data[ai + 3] / imageData.data[bi + 3] * (1 - fac);
            } else {
                fac2 = imageData.data[bi + 3] / imageData.data[ai + 3] * fac;
            }

            // ImageData's Uint8ClampedArray rounds -> 0.5 becomes 1. But not in Safari, so needs to be done manually
            // Offset mixed color by random number noise (-0.5, 0.5), so it doesn't get stuck while mixing.
            // No +0.5, because it cancels out with rand.
            imageData.data[bi] = Math.floor(BB.mix(imageData.data[ai], imageData.data[bi + 0], fac2) + randArr[randI++ % randLen]);
            imageData.data[bi + 1] = Math.floor(BB.mix(imageData.data[ai + 1], imageData.data[bi + 1], fac2) + randArr[randI++ % randLen]);
            imageData.data[bi + 2] = Math.floor(BB.mix(imageData.data[ai + 2], imageData.data[bi + 2], fac2) + randArr[randI++ % randLen]);
        }
        // Always mix alpha. unless alpha lock
        if (!p.brush.alphaLock) {
            imageData.data[bi + 3] = Math.floor(BB.mix(imageData.data[ai + 3], imageData.data[bi + 3], fac) + 0.5);
        }

    };

    const bx1 = p.bP.x * 4;
    const bx2 = bx1 + (p.size.w - 1) * 4;

    // transfer of pixels depends on direction of smudging if there is overlap
    if (p.aP.y < p.bP.y) {
        for (let y = p.size.h - 1, iy = p.bP.y + p.size.h - 1; y >= 0; y--, iy--) {
            const yStart = (y + p.bP.y) * imageData.width * 4;
            for (let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = p.bP.x + p.size.w - 1; x >= bx1 + yStart; x -= 4, x2 -= 4, ix--) {
                pixel(x2, x, ix, iy);
            }
        }
    } else if (p.aP.y > p.bP.y) {
        for (let y = 0, iy = p.bP.y; y < p.size.h; y++, iy++) {
            const yStart = (y + p.bP.y) * imageData.width * 4;
            for (let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = p.bP.x + p.size.w - 1; x >= bx1 + yStart; x -= 4, x2 -= 4, ix--) {
                pixel(x2, x, ix, iy);
            }
        }
    } else {
        if (p.aP.x < p.bP.x) {
            for (let y = p.size.h - 1, iy = p.bP.y + p.size.h - 1; y >= 0; y--, iy--) {
                const yStart = (y + p.bP.y) * imageData.width * 4;
                for (let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = p.bP.x + p.size.w - 1; x >= bx1 + yStart; x -= 4, x2 -= 4, ix--) {
                    pixel(x2, x, ix, iy);
                }
            }
        } else {
            for (let y = 0, iy = p.bP.y; y < p.size.h; y++, iy++) {
                const yStart = (y + p.bP.y) * imageData.width * 4;
                for (let x = bx1 + yStart, x2 = bx1 + yStart - offset, ix = p.bP.x; x < bx2 + yStart; x += 4, x2 += 4, ix++) {
                    pixel(x2, x, ix, iy);
                }
            }
        }
    }

    //statCount++;
    //statAcc += performance.now() - start;
}

/**
 * Brush that pushes colors around.
 */
export function smudgeBrush() {

    let _this = this;
    let debugStr = '';
    let context: CanvasRenderingContext2D;
    let history = {
        add: function (p?) {
        },
        isFake: true
    }, historyEntry;

    let settingColor, settingSize = 35, settingSpacing = 0.20446882736951905, settingOpacity = 0.8;
    let settingColorStr: string;
    let settingHasSizePressure = false, settingHasOpacityPressure = false;
    let settingLockLayerAlpha = false;

    let lineToolLastDot;
    let lastInput = {x: 0, y: 0, pressure: 0};
    let lastInput2 = {x: 0, y: 0, pressure: 0};

    let isDrawing = false;

    let bezierLine = null;


    let redrawBounds: IBounds;
    let completeRedrawBounds: IBounds;

    let copyImageData: ImageData;

    let smudgeBuffer: ISmudgeParams[] = [];
    const cellSize = 256;
    let copiedCells: boolean[];

    function updateRedrawBounds(bounds: IBounds) {
        if (!bounds) {
            return;
        }
        if (!redrawBounds) {
            redrawBounds = { x1: bounds.x1, y1: bounds.y1, x2: bounds.x2, y2: bounds.y2 };
        } else {
            redrawBounds.x1 = Math.min(redrawBounds.x1, bounds.x1);
            redrawBounds.y1 = Math.min(redrawBounds.y1, bounds.y1);
            redrawBounds.x2 = Math.max(redrawBounds.x2, bounds.x2);
            redrawBounds.y2 = Math.max(redrawBounds.y2, bounds.y2);
        }
    }
    function updateCompleteRedrawBounds(x1, y1, x2, y2) {
        if (!completeRedrawBounds) {
            completeRedrawBounds = { x1, y1, x2, y2 };
        } else {
            completeRedrawBounds.x1 = Math.min(completeRedrawBounds.x1, x1);
            completeRedrawBounds.y1 = Math.min(completeRedrawBounds.y1, y1);
            completeRedrawBounds.x2 = Math.max(completeRedrawBounds.x2, x2);
            completeRedrawBounds.y2 = Math.max(completeRedrawBounds.y2, y2);
        }
    }


    let lastDot;

    /**
     * update copyImageData. copy over new regions if needed
     */
    function copyFromCanvas() {

        const touchedCells = copiedCells.map(item => false);

        const bounds: IBounds[] = [];
        const cellsW = Math.ceil(copyImageData.width / cellSize);

        if (!redrawBounds) {
            return;
        }
        bounds.push({
            x1: Math.floor(redrawBounds.x1 / cellSize),
            y1: Math.floor(redrawBounds.y1 / cellSize),
            x2: Math.floor(redrawBounds.x2 / cellSize),
            y2: Math.floor(redrawBounds.y2 / cellSize),
        });
        bounds.forEach(item => {
            for (let i = item.x1; i <= item.x2; i++) {
                for (let e = item.y1; e <= item.y2; e++) {
                    touchedCells[e * cellsW + i] = true;
                }
            }
        });

        touchedCells.forEach((item, i) => {
            if (!item || copiedCells[i]) {
                // not touched, or already copied
                return;
            }
            copiedCells[i] = true;
            const x = i % cellsW;
            const y = Math.floor(i / cellsW);
            const w = (Math.min(x * cellSize + cellSize, copyImageData.width) - 1) % cellSize + 1;
            const h = (Math.min(y * cellSize + cellSize, copyImageData.height) - 1) % cellSize + 1;

            // temp canvas to prevent main canvas from getting slowed down in chrome
            const tmpCanvas = BB.canvas(w, h);
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(context.canvas, -x * cellSize, -y * cellSize);

            const data = tmpCtx.getImageData(0, 0, w, h);

            for (let i = 0; i < h; i++) {
                for (let e = 0, e2 = i * w * 4, e3 = ((y * cellSize + i) * copyImageData.width + x * cellSize) * 4; e < w; e++, e2 += 4, e3 += 4) {
                    copyImageData.data[e3] = data.data[e2];
                    copyImageData.data[e3 + 1] = data.data[e2 + 1];
                    copyImageData.data[e3 + 2] = data.data[e2 + 2];
                    copyImageData.data[e3 + 3] = data.data[e2 + 3];
                }
            }
        });
    }


    /**
     *
     *
     * @param x
     * @param y
     * @param size
     * @param opacity
     */
    function drawDot(x, y, size, opacity) {
        if (!lastDot) {
            lastDot = {
                x: x,
                y: y,
            };
            return;
        }

        size = Math.round(size);


        const w = Math.round(size * 2);
        const h = Math.round(size * 2);

        const bounds = prepSmudge(
            copyImageData.width,
            copyImageData.height,
            {
                x: Math.round(lastDot.x - size),
                y: Math.round(lastDot.y - size),
            },
            {
                x: Math.round(x - size),
                y: Math.round(y - size),
            },
            {
                w,
                h,
            },
        );

        if (bounds) {
            const params: ISmudgeParams = {
                aP: bounds.aP,
                bP: bounds.bP,
                size: bounds.size,
                brush: {
                    center: { x, y },
                    size,
                    opacity,
                    alphaLock: settingLockLayerAlpha,
                }
            };
            updateRedrawBounds({
                x1: params.bP.x,
                y1: params.bP.y,
                x2: params.bP.x + params.brush.size * 2,
                y2: params.bP.y + params.brush.size * 2,
            });
            smudgeBuffer.push(params);
        }

        lastDot = {
            x: x,
            y: y,
        };
    }

    function continueLine(x, y, size, pressure) {
        smudgeBuffer = [];

        if(bezierLine === null) {
            bezierLine = new BB.BezierLine();
            bezierLine.add(lastInput.x, lastInput.y, 0, function(){});
        }

        let drawArr = []; //draw instructions. will be all drawn at once

        function dotCallback(val) {
            let localPressure = BB.mix(lastInput2.pressure, pressure, val.t);
            let localOpacity = settingOpacity * (settingHasOpacityPressure ? (localPressure * localPressure) : 1);
            let localSize = Math.max(0.1, settingSize * (settingHasSizePressure ? localPressure : 1));
            drawArr.push([val.x, val.y, localSize, localOpacity, val.angle]);
        }

        let localSpacing = size * settingSpacing / 3;
        if(x === null) {
            bezierLine.addFinal(localSpacing, dotCallback);
        } else {
            bezierLine.add(x, y, localSpacing, dotCallback);
        }

        // execute draw instructions
        let before;
        for (let i = 0; i < drawArr.length; i++) {
            let item = drawArr[i];
            drawDot(item[0], item[1], item[2], item[3]);
            before = item;
        }

        copyFromCanvas();

        for (let i = 0; i < smudgeBuffer.length; i++) {
            smudge(copyImageData, smudgeBuffer[i]);
        }
    }

    //------------------ interface ---------------------------------------------------


    this.startLine = function (x, y, p) {
        historyEntry = {
            tool: ["brush", "smudge"],
            actions: []
        };

        p = BB.clamp(p, 0, 1);
        let localOpacity = settingHasOpacityPressure ? (settingOpacity * p * p) : settingOpacity;
        let localSize = settingHasSizePressure ? Math.max(0.1, p * settingSize) : Math.max(0.1, settingSize);

        lastDot = null;
        isDrawing = true;

        copyImageData = new ImageData(context.canvas.width, context.canvas.height);
        const totalCells = Math.ceil(context.canvas.width / cellSize) * Math.ceil(context.canvas.height / cellSize);
        copiedCells = '0'.repeat(totalCells).split('').map(item => false);

        drawDot(x, y, localSize, localOpacity);

        lineToolLastDot = localSize * settingSpacing;
        lastInput.x = x;
        lastInput.y = y;
        lastInput.pressure = p;
        lastInput2.pressure = p;

        completeRedrawBounds = null;
    };

    this.goLine = function (x, y, p) {
        if (!isDrawing) {
            return;
        }

        redrawBounds = null;
        let pressure = BB.clamp(p, 0, 1);
        let localSize = settingHasSizePressure ? Math.max(0.1, lastInput.pressure * settingSize) : Math.max(0.1, settingSize);

        continueLine(x, y, localSize, lastInput.pressure);


        if (redrawBounds) {
            context.putImageData(copyImageData, 0, 0, redrawBounds.x1, redrawBounds.y1, redrawBounds.x2 - redrawBounds.x1 - 1, redrawBounds.y2 - redrawBounds.y1 - 1);
            updateCompleteRedrawBounds(redrawBounds.x1, redrawBounds.y1, redrawBounds.x2, redrawBounds.y2);
        }

        lastInput.x = x;
        lastInput.y = y;
        lastInput2.pressure = lastInput.pressure;
        lastInput.pressure = pressure;

    };

    this.endLine = function (x, y) {
        redrawBounds = null;
        let localSize = settingHasSizePressure ? Math.max(0.1, lastInput.pressure * settingSize) : Math.max(0.1, settingSize);
        context.save();
        continueLine(null, null, localSize, lastInput.pressure);
        context.restore();

        isDrawing = false;

        bezierLine = null;

        if (redrawBounds) {
            context.putImageData(copyImageData, 0, 0, redrawBounds.x1, redrawBounds.y1, redrawBounds.x2 - redrawBounds.x1 - 1, redrawBounds.y2 - redrawBounds.y1 - 1);
            updateCompleteRedrawBounds(redrawBounds.x1, redrawBounds.y1, redrawBounds.x2, redrawBounds.y2);
        }

        if (historyEntry && completeRedrawBounds) {
            let historyImageData = copyImageData;
            if (!(completeRedrawBounds.x1 === 0 && completeRedrawBounds.y1 === 0 && completeRedrawBounds.x2 >= context.canvas.width - 1 && completeRedrawBounds.y2 >= context.canvas.height - 1)) {

                // temp canvas to prevent main canvas from getting slowed down in chrome
                const tmpCanvas = BB.canvas(completeRedrawBounds.x2 - completeRedrawBounds.x1 + 1, completeRedrawBounds.y2 - completeRedrawBounds.y1 + 1);
                const tmpCtx = tmpCanvas.getContext('2d');
                tmpCtx.drawImage(context.canvas, -completeRedrawBounds.x1, -completeRedrawBounds.y1);

                historyImageData = tmpCtx.getImageData(
                    0,
                    0,
                    tmpCanvas.width,
                    tmpCanvas.height,
                );
            }
            historyEntry.actions.push({
                action: "drawImage",
                params: [
                    historyImageData,
                    completeRedrawBounds.x1,
                    completeRedrawBounds.y1,
                ],
            });
            history.add(historyEntry);
        }
        copyImageData = null;
        historyEntry = undefined;
    };

    this.drawImage = (imageData: ImageData, x: number, y: number) => {
        context.putImageData(imageData, x, y);
    };

    this.drawLineSegment = function (x1, y1, x2, y2) {
        return;
        /*
        // todo
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
        for (loopDist = lineToolLastDot; loopDist <= mouseDist; loopDist += bdist) {
            drawDot(x1 + eX * loopDist, y1 + eY * loopDist, settingSize, settingOpacity);
        }


        let historyEntry = {
            tool: ["brush", "smudge"],
            actions: []
        };
        // todo
        history.add(historyEntry);*/
    };

    //IS
    this.isDrawing = function () {
        return isDrawing;
    };
    //SET

    // not needed, but might add in the future
    this.setColor = function (c) {
        if(settingColor === c) {
            return;
        }
        settingColor = {r: c.r, g: c.g, b: c.b};
        settingColorStr = "rgb(" + settingColor.r + "," + settingColor.g + "," + settingColor.b + ")";
    };
    this.setContext = function (c) {
        context = c;
    };
    this.setHistory = function (l) {
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
    this.setDebug = function(str) {
        debugStr = str;
    };
}