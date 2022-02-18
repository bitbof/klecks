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


/**
 * Pixel operations that do the smudging via ImageData
 * everything needs to be integers
 * @param imageData
 * @param aP
 * @param bP
 * @param size
 * @param options
 */
function smudge(
    imageData: ImageData,
    aP: IVector2D, // top left of source
    bP: IVector2D, // top left of dest
    size: {w: number; h: number}, // size of both rectangles
    options: {
        opacity: number;
        alphaLock: boolean;
    }
) {
    if (aP.x === bP.x && aP.y === bP.y) {
        return;
    }

    const cSize = size.w / 2;
    const cX = aP.x + size.w / 2;
    const cY = aP.y + size.h / 2;

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
        if (aP.x + size.w > imageData.width) {
            right = aP.x + size.w - imageData.width;
        }
        if (aP.y + size.h > imageData.height) {
            bottom = aP.y + size.h - imageData.height;
        }
        if (bP.x + size.w > imageData.width) {
            right = Math.max(right, bP.x + size.w - imageData.width);
        }
        if (bP.y + size.h > imageData.height) {
            bottom = Math.max(bottom, bP.y + size.h - imageData.height);
        }

        aP.x += left;
        bP.x += left;
        aP.y += top;
        bP.y += top;

        size.w = size.w - left - right;
        size.h = size.h - top - bottom;
        if (size.w <= 0 || size.h <= 0) {
            return;
        }
    }

    /*if (statCount % 1000 === 0) {
        console.log(statAcc / 1000);
        statAcc = 0;
    }
    let start = performance.now();*/


    // determine offset
    let aIndex = aP.y * imageData.width + aP.x;
    let bIndex = bP.y * imageData.width + bP.x;
    const offset = (bIndex - aIndex) * 4;

    // array with random numbers. faster than Math.random()
    let randI = 0;
    const randLen = Math.floor(25 + Math.random() * 25);
    const randArr = [];
    for (let i = 0; i < randLen; i++) {
        randArr[i] = Math.random();
    }

    const softness = 8;

    const pixel = (ai, bi, ix, iy) => {

        const dist = Math.abs(BB.dist(cX, cY, ix, iy));
        const fac = 1 - options.opacity * (1 - BB.clamp((dist - (cSize - softness)) / softness, 0, 1));

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
        if (!options.alphaLock) {
            imageData.data[bi + 3] = Math.floor(BB.mix(imageData.data[ai + 3], imageData.data[bi + 3], fac) + 0.5);
        }

    };

    const bx1 = bP.x * 4;
    const bx2 = bx1 + (size.w - 1) * 4;

    // transfer of pixels depends on direction of smudging if there is overlap
    if (aP.y < bP.y) {
        for (let y = size.h - 1, iy = bP.y + size.h - 1; y >= 0; y--, iy--) {
            const yStart = (y + bP.y) * imageData.width * 4;
            for (let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = bP.x + size.w - 1; x >= bx1 + yStart; x -= 4, x2 -= 4, ix--) {
                pixel(x2, x, ix, iy);
            }
        }
    } else if (aP.y > bP.y) {
        for (let y = 0, iy = bP.y; y < size.h; y++, iy++) {
            const yStart = (y + bP.y) * imageData.width * 4;
            for (let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = bP.x + size.w - 1; x >= bx1 + yStart; x -= 4, x2 -= 4, ix--) {
                pixel(x2, x, ix, iy);
            }
        }
    } else {
        if (aP.x < bP.x) {
            for (let y = size.h - 1, iy = bP.y + size.h - 1; y >= 0; y--, iy--) {
                const yStart = (y + bP.y) * imageData.width * 4;
                for (let x = bx2 + yStart, x2 = bx2 + yStart - offset, ix = bP.x + size.w - 1; x >= bx1 + yStart; x -= 4, x2 -= 4, ix--) {
                    pixel(x2, x, ix, iy);
                }
            }
        } else {
            for (let y = 0, iy = bP.y; y < size.h; y++, iy++) {
                const yStart = (y + bP.y) * imageData.width * 4;
                for (let x = bx1 + yStart, x2 = bx1 + yStart - offset, ix = bP.x; x < bx2 + yStart; x += 4, x2 += 4, ix++) {
                    pixel(x2, x, ix, iy);
                }
            }
        }
    }

    /*statCount++;
    statAcc += performance.now() - start;*/
}

/**
 * Brush that pushes colors around.
 */
export function smudgeBrush() {

    let _this = this;
    let debugStr = '';
    let context;
    let history = {
        add: function (p?) {
        },
        isFake: true
    }, historyEntry;

    let settingColor, settingSize = 35, settingSpacing = 0.20446882736951905, settingOpacity = 0.8;
    let settingColorStr;
    let settingHasSizePressure = false, settingHasOpacityPressure = false;
    let settingLockLayerAlpha = false;

    let lineToolLastDot;
    let lastInput = {x: 0, y: 0, pressure: 0};
    let lastInput2 = {x: 0, y: 0, pressure: 0};

    let isDrawing = false;

    let bezierLine = null;


    let redrawBounds: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    let completeRedrawBounds: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };

    let copyImageData;


    function updateRedrawBounds(x1, y1, x2, y2) {
        if (!redrawBounds) {
            redrawBounds = { x1, y1, x2, y2 };
        } else {
            redrawBounds.x1 = Math.min(redrawBounds.x1, x1);
            redrawBounds.y1 = Math.min(redrawBounds.y1, y1);
            redrawBounds.x2 = Math.max(redrawBounds.x2, x2);
            redrawBounds.y2 = Math.max(redrawBounds.y2, y2);
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

        smudge(
            copyImageData,
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
            {
                opacity: opacity,
                alphaLock: settingLockLayerAlpha,
            }
        );
        updateRedrawBounds(Math.round(x - size), Math.round(y - size), Math.round(x - size) + w, Math.round(y - size) + h);


        lastDot = {
            x: x,
            y: y,
        };
    }

    function continueLine(x, y, size, pressure) {
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
        context.save();
        let before;
        for (let i = 0; i < drawArr.length; i++) {
            let item = drawArr[i];
            drawDot(item[0], item[1], item[2], item[3]);
            before = item;
        }
        context.restore();
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

        copyImageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);

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
            context.putImageData(copyImageData, 0, 0);
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
            context.putImageData(copyImageData, 0, 0);
            updateCompleteRedrawBounds(redrawBounds.x1, redrawBounds.y1, redrawBounds.x2, redrawBounds.y2);
        }

        if (historyEntry && completeRedrawBounds) {
            historyEntry.actions.push({
                action: "drawImage",
                params: [
                    context.getImageData(
                        completeRedrawBounds.x1,
                        completeRedrawBounds.y1,
                        completeRedrawBounds.x2 - completeRedrawBounds.x1,
                        completeRedrawBounds.y2 - completeRedrawBounds.y1
                    ),
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