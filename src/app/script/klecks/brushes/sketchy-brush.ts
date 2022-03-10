import {BB} from '../../bb/bb';
import {IHistoryEntry, KlHistoryInterface} from '../history/kl-history';
import {KL} from '../kl';

const sampleCanvas = BB.canvas(32, 32);
const sampleCtx = sampleCanvas.getContext('2d');

export function SketchyBrush() {
    let context;
    let settingColor;

    let settingSize = 1, settingOpacity = 0.2;
    let settingBlending = 0.5;
    let settingScale = 1;

    let lastX, lastY;
    let isDrawing = false;
    let lastInput = {x: 0, y: 0, pressure: 0};
    let history: KlHistoryInterface = new KL.DecoyKlHistory();
    let historyEntry: IHistoryEntry;
    let sketchySeed = 0;
    this.setHistory = function (l: KlHistoryInterface) {
        history = l;
    };
    this.setSeed = function (s) {
        sketchySeed = parseInt(s);
    };
    this.getSeed = function () {
        return parseInt('' + sketchySeed);
    };

    function rand() {
        sketchySeed++;
        return Math.sin(6324634.2345 * Math.cos(sketchySeed * 5342.3423)) * 0.5 + 0.5;
    }

    let points = [];
    let count = 0;
    let mixmode = [
        function (c1, c2) {
            return c1;
        },
        function (c1, c2) {
            let result = new BB.RGB(c1.r, c1.g, c1.b);
            result.r *= c2.r / 255;
            result.g *= c2.g / 255;
            result.b *= c2.b / 255;
            return result;
        },
        function (c1, c2) {
            let result = new BB.RGB(c1.r, c1.g, c1.b);
            result.r *= c2.r / 255;
            result.g *= c2.g / 255;
            result.b *= c2.b / 255;
            return result;
        }
    ];

    this.getSize = function () {
        return settingSize / 2;
    };
    this.setColor = function (c) {
        settingColor = c;
    };
    this.getOpacity = function () {
        return settingOpacity;
    };
    this.setOpacity = function (o) {
        settingOpacity = o;
    };
    this.getBlending = function () {
        return settingBlending;
    };
    this.setBlending = function (b) {
        settingBlending = b;
    };
    this.setSize = function (s) {
        settingSize = s * 2;
    };
    this.getScale = function () {
        return settingScale;
    };
    this.setScale = function (s) {
        settingScale = s;
    };
    this.setContext = function (c) {
        context = c;
    };
    this.startLine = function (x, y, pressure, shift) {
        if (shift && lastInput.x) {
            let lx = lastInput.x, ly = lastInput.y;
            isDrawing = true;
            //this.goLine(x,y,pressure);
            this.endLine();
        } else {
            isDrawing = true;
            lastX = x;
            lastY = y;
            lastInput.x = x;
            lastInput.y = y;
            historyEntry = {
                tool: ["brush", "SketchyBrush"],
                actions: []
            };
            historyEntry.actions.push({
                action: "setScale",
                params: [settingScale]
            });
            historyEntry.actions.push({
                action: "setSize",
                params: [settingSize / 2]
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
                action: "setBlending",
                params: [settingBlending]
            });
            historyEntry.actions.push({
                action: "startLine",
                params: [x, y, pressure]
            });
        }

    };
    this.goLine = function (p_x, p_y, pressure, preMixedColor) {
        if (!isDrawing || (p_x === lastInput.x && p_y === lastInput.y)) {
            return;
        }

        let e, b, a, g;
        let x = parseInt(p_x);
        let y = parseInt(p_y);
        points.push([x, y]);

        let mixr = settingColor.r;
        let mixg = settingColor.g;
        let mixb = settingColor.b;

        if (preMixedColor !== null) {
            mixr = preMixedColor.r;
            mixg = preMixedColor.g;
            mixb = preMixedColor.b;
        } else {
            if (settingBlending !== 0) {
                if (x + 5 >= 0 && y + 5 >= 0 && x - 5 < context.canvas.width - 1 && y - 5 < context.canvas.height - 1) {
                    mixr = 0;
                    mixg = 0;
                    mixb = 0;
                    let mixx = Math.min(context.canvas.width - 1, Math.max(0, x - 5));
                    let mixy = Math.min(context.canvas.height - 1, Math.max(0, y - 5));
                    let mixw = Math.min(context.canvas.width - 1, Math.max(0, x + 5));
                    let mixh = Math.min(context.canvas.height - 1, Math.max(0, y + 5));
                    mixw -= mixx;
                    mixh -= mixy;

                    if (mixw > 0 && mixh > 0) {
                        let imdat = context.getImageData(mixx, mixy, mixw, mixh);
                        let countmix = 0;
                        for (let i = 0; i < imdat.data.length; i += 4) {
                            mixr += imdat.data[i + 0];
                            mixg += imdat.data[i + 1];
                            mixb += imdat.data[i + 2];
                            countmix++;
                        }
                        mixr /= countmix;
                        mixg /= countmix;
                        mixb /= countmix;
                    }

                    let mixed = mixmode[0](new BB.RGB(mixr, mixg, mixb), settingColor);
                    mixr = parseInt('' + BB.mix(settingColor.r, mixed.r, settingBlending));
                    mixg = parseInt('' + BB.mix(settingColor.g, mixed.g, settingBlending));
                    mixb = parseInt('' + BB.mix(settingColor.b, mixed.b, settingBlending));
                }
            }
        }

        context.save();
        context.strokeStyle = "rgba(" + mixr + ", " + mixg + ", " + mixb + ", " + settingOpacity + ")";
        context.lineWidth = settingSize;

        context.beginPath();
        context.moveTo(lastX, lastY);
        context.lineTo(x, y);

        for (e = 0; e < points.length; e++) {
            b = points[e][0] - points[count][0];
            a = points[e][1] - points[count][1];
            g = b * b + a * a;
            if (g < 4000 * settingScale * settingScale && rand() > g / 2000 / settingScale / settingScale) {
                context.moveTo(points[count][0] + (b * 0.3), points[count][1] + (a * 0.3));
                context.lineTo(points[e][0] - (b * 0.3), points[e][1] - (a * 0.3));
            }
        }

        context.stroke();
        context.restore();


        count++;
        lastX = x;
        lastY = y;
        lastInput.x = x;
        lastInput.y = y;
        historyEntry.actions.push({
            action: "goLine",
            params: [p_x, p_y, pressure, {r: mixr, g: mixg, b: mixb}]
        });
    };
    this.endLine = function () {
        isDrawing = false;
        count = 0;
        points = [];
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
        lastInput.x = x2;
        lastInput.y = y2;

        if (isDrawing || x1 === undefined) {
            return;
        }


        context.save();
        context.lineWidth = settingSize;

        let mixr = settingColor.r, mixg = settingColor.g, mixb = settingColor.b;
        if (x1 + 5 >= 0 && y1 + 5 >= 0 && x1 - 5 < context.canvas.width - 1 && y1 - 5 < context.canvas.height - 1) {
            mixr = 0;
            mixg = 0;
            mixb = 0;
            let mixx = Math.min(context.canvas.width - 1, Math.max(0, x1 - 5));
            let mixy = Math.min(context.canvas.height - 1, Math.max(0, y1 - 5));
            let mixw = Math.min(context.canvas.width - 1, Math.max(0, x1 + 5));
            let mixh = Math.min(context.canvas.height - 1, Math.max(0, y1 + 5));
            mixw -= mixx;
            mixh -= mixy;
            if (mixw > 0 && mixh > 0) {
                let w = Math.min(sampleCanvas.width, mixw);
                let h = Math.min(sampleCanvas.height, mixh);
                sampleCtx.save();
                sampleCtx.globalCompositeOperation = 'copy';
                sampleCtx.drawImage(context.canvas, mixx, mixy, mixw, mixh, 0, 0, w, h);
                sampleCtx.restore();

                let imdat = sampleCtx.getImageData(mixx, mixy, mixw, mixh);
                let countmix = 0;
                for (let i = 0; i < imdat.data.length; i += 4) {
                    mixr += imdat.data[i + 0];
                    mixg += imdat.data[i + 1];
                    mixb += imdat.data[i + 2];
                    countmix++;
                }
                mixr /= countmix;
                mixg /= countmix;
                mixb /= countmix;
            }
        }
        let mixed = mixmode[0](new BB.RGB(mixr, mixg, mixb), settingColor);
        mixr = parseInt('' + (settingBlending * mixed.r + settingColor.r * (1 - settingBlending)));
        mixg = parseInt('' + (settingBlending * mixed.g + settingColor.g * (1 - settingBlending)));
        mixb = parseInt('' + (settingBlending * mixed.b + settingColor.b * (1 - settingBlending)));
        context.strokeStyle = "rgba(" + mixr + ", " + mixg + ", " + mixb + ", " + settingOpacity + ")";
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
        context.strokeStyle = "rgba(" + mixr + ", " + mixg + ", " + mixb + ", " + settingOpacity + ")";
        context.restore();


        let historyEntry = {
            tool: ["brush", "SketchyBrush"],
            actions: []
        };
        historyEntry.actions.push({
            action: "setScale",
            params: [settingScale]
        });
        historyEntry.actions.push({
            action: "setSize",
            params: [settingSize / 2]
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
            action: "setBlending",
            params: [settingBlending]
        });

        historyEntry.actions.push({
            action: "drawLineSegment",
            params: [x1, y1, x2, y2]
        });
        history.push(historyEntry);
    };

    this.isDrawing = function () {
        return isDrawing;
    };
}