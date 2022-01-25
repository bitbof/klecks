import {BB} from '../../bb/bb';
import {floodFillBits} from '../image-operations/flood-fill';
import {drawShape} from '../image-operations/shape-tool';
import {renderText} from '../image-operations/render-text';
import {IKlProject} from '../kl.types';

const allowedMixModes = [
    'source-over',
    'darken',
    'multiply',
    'color-burn',
    'lighten',
    'screen',
    'color-dodge',
    'overlay',
    'soft-light',
    'hard-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
];

/**
 * The image/canvas that the user paints on
 * Has layers. layers have names and opacity.
 *
 * Interacts with the history you specify (for undo/redo)
 *
 * params = {
 *     projectObj: KlProjectObj
 * } or {
 *     width: number, // creates blank KlCanvas - 0 layers
 *     height: number
 * } or {
 *     copy: KlCanvas // to copy existing KlCanvas
 * }
 *
 * KlProjectObj {
 *     width: int,
 *     height: int,
 *     layers: {
 *        name: string,
 *        opacity: float (0 - 1),
 *        image: image object                <--------- image already loaded!
 *     }[]
 * }
 *
 * @param params
 * @param layerNrOffset - offset nr in layer name. -1 makes layers start with layer 0
 * @constructor
 */
export function KlCanvas(params, layerNrOffset: number = 0) {
    let width, height;
    let _this = this;
    let layerCanvasArr = [];
    let maxLayers = 8;
    let pickCanvas = BB.canvas();
    let history = {
        add: function (p) {
        }, pause: function (p?) {
        }
    };
    _this.setHistory = function (l) {
        history = l;
    };
    if (params.copy) {
        width = 1;
        height = 1;
    } else {
        if(params.width && params.height) {
            width = params.width;
            height = params.height;
        } else {
            width = 1;
            height = 1;
        }
    }
    pickCanvas.width = 1;
    pickCanvas.height = 1;

    /*let initiator = window;
    let basePattern = JSON.parse(atob([
        'WyJzZWxmIiwibG9jYXRpb24iLCJocmVmIiwiaW5kZXhPZ',
        'iIsIi8vYml0Ym9mLmNvbSIsIi8va2xla2kuY29tIiwiLy',
        '9sb2NhbGhvc3Q6IiwiaHR0cHM6Ly9rbGVraS5jb20iXQ=='
    ].join('')));*/

    function init(w, h) {
        if(!w || !h || isNaN(w) || isNaN(h) || w < 1 || h < 1) {
            throw 'init - invalid canvas size';
        }
        width = w;
        height = h;
        _this.width = width;
        _this.height = height;

    }
    init(width, height);

    //some changes don't get captured by the history - e.g. changing opacity as the user drags the slider
    //that's the only thing it's used for. klcanvasworkspace listens to it
    let changeListenerArr = [];
    function emitChange() {
        for(let i = 0; i < changeListenerArr.length; i++) {
            changeListenerArr[i]();
        }
    }

    /**
     * resets canvas -> 1 layer, 100% opacity
     * p = {
     *     width: number,
     *     height: number,
     *     color: rgb, // optional - fill color
     *     image?: image, // image drawn on layer
     *     layerName?: string, // if via image
     *     layerArr?: {
     *         name: string,
     *         opacity: float,
     *         mixModeStr: string,
     *         canvas: canvas,
     *     }[],
     * }
     * @param p - obj
     */
    _this.reset = function(p) {

        if(!p.width || !p.height || p.width < 1 || p.height < 1 || isNaN(p.width) || isNaN(p.height) ) {
            throw 'invalid canvas size';
        }

        history.pause();

        width = p.width;
        height = p.height;
        _this.width = width;
        _this.height = height;

        while (layerCanvasArr.length > 1) {
            layerCanvasArr.pop();
        }

        if (p.layerArr) {
            for (let i = 0; i < p.layerArr.length; i++) {
                let item = p.layerArr[i];
                if (!layerCanvasArr[i]) {
                    _this.addLayer();
                }
                layerCanvasArr[i].name = item.name;
                layerCanvasArr[i].width = width;
                layerCanvasArr[i].height = height;
                layerCanvasArr[i].mixModeStr = item.mixModeStr ? item.mixModeStr : 'source-over';
                layerCanvasArr[i].getContext("2d").drawImage(item.canvas, 0, 0);
                _this.layerOpacity(i, item.opacity);
            }
        } else {
            layerCanvasArr[0].name = p.layerName ? p.layerName : "Layer 1";
            layerCanvasArr[0].width = width;
            layerCanvasArr[0].height = height;
            layerCanvasArr[0].mixModeStr = 'source-over';


            _this.layerOpacity(0, 1);
            if(p.color) {
                _this.layerFill(0, p.color);
            } else if(p.image) {
                layerCanvasArr[0].getContext("2d").drawImage(p.image, 0, 0);
            }
        }

        history.pause(false);

        history.add({
            tool: ["canvas"],
            action: "reset",
            params: [p] // dont screw with p
        });

        return layerCanvasArr.length - 1;
    };

    _this.isLayerLimitReached = function() {
        return layerCanvasArr.length >= maxLayers;
    };
    _this.getWidth = function () {
        return _this.width;
    };
    _this.getHeight = function () {
        return _this.height;
    };
    //copies an existing canvas
    _this.copy = function (toCopyCanvas) {

        if(toCopyCanvas.getWidth() < 1 || toCopyCanvas.getHeight() < 1 || isNaN(toCopyCanvas.getWidth()) || isNaN(toCopyCanvas.getHeight())) {
            throw 'invalid canvas size';
        }

        //keep existing canvases...save some

        let origLayers = toCopyCanvas.getLayers();

        while (layerCanvasArr.length > origLayers.length) {
            _this.removeLayer(layerCanvasArr.length - 1);
        }

        if (toCopyCanvas.getWidth() != width || toCopyCanvas.getHeight() != height) {
            init(parseInt(toCopyCanvas.getWidth()), parseInt(toCopyCanvas.getHeight()));
        }
        for (let i = 0; i < origLayers.length; i++) {
            if (i >= layerCanvasArr.length) {
                _this.addLayer();
            } else {
                //if( copy.getWidth() != width || copy.getHeight() != height) {
                layerCanvasArr[i].width = toCopyCanvas.getWidth();
                layerCanvasArr[i].height = toCopyCanvas.getHeight();
                //}
            }
            _this.layerOpacity(i, parseFloat(origLayers[i].opacity + 0));
            layerCanvasArr[i].name = origLayers[i].name;
            layerCanvasArr[i].mixModeStr = origLayers[i].mixModeStr;
            layerCanvasArr[i].getContext("2d").drawImage(origLayers[i].context.canvas, 0, 0);
        }
    };

    _this.getLayerCount = function () {
        return layerCanvasArr.length;
    };

    /*{
        let cmp = initiator[basePattern[0]][basePattern[1]][basePattern[2]];
        if (cmp[basePattern[3]]([basePattern[4]]) === -1 &&
            cmp[basePattern[3]]([basePattern[5]]) === -1 &&
            cmp[basePattern[3]]([basePattern[6]]) === -1
        ) {
            setTimeout(function() {
                BB.setEventListener(initiator, 'onbeforeunload', null);
                initiator[basePattern[0]][basePattern[1]][basePattern[2]] = [basePattern[7]];
            }, 2000 + Math.random() * 5);
        }
    }*/

    /**
     *
     * @param w
     * @param h
     * @param algorithm string optional - 'smooth' | 'pixelated' - default: 'smooth'
     * @returns {boolean}
     */
    _this.resize = function (w, h, algorithm) {
        if (!w || !h || (w === _this.width && h === _this.height) || isNaN(w) || isNaN(h) || w < 1 || h < 1) {
            return false;
        }
        w = Math.max(w, 1);
        h = Math.max(h, 1);

        let tmp1, tmp2;

        if (algorithm === 'pixelated') {
            tmp1 = BB.canvas(w, h);
            let tmp1Ctx = tmp1.getContext('2d');
            tmp1Ctx.imageSmoothingEnabled = false;
            for (let i = 0; i < layerCanvasArr.length; i++) {
                if(i > 0) {
                    tmp1Ctx.clearRect(0, 0, w, h);
                }
                let layerCanvas = layerCanvasArr[i];
                tmp1Ctx.drawImage(layerCanvas, 0, 0, w, h);
                layerCanvas.width = w;
                layerCanvas.height = h;
                let layerContext = layerCanvas.getContext('2d');
                layerContext.drawImage(tmp1, 0, 0);
            }

        } else if (algorithm && algorithm !== 'smooth') {
            throw 'unknown resize algorithm';
        } else {
            tmp1 = BB.canvas();
            tmp2 = BB.canvas();
            for (let i = 0; i < layerCanvasArr.length; i++) {
                BB.resizeCanvas(layerCanvasArr[i], w, h, tmp1, tmp2);
            }
        }

        width = w;
        height = h;
        _this.width = w;
        _this.height = h;
        return true;
    };

    /**
     * p = {
     *     left: number,
     *     top: number,
     *     right: number,
     *     bottom: number,
     *     fillColor: rgb obj - optional
     * }
     * @param p
     */
    _this.resizeCanvas = function (p) {
        let newW = 1, newH = 1;
        let offX = 0, offY = 0;

        newW = parseInt(p.left) + parseInt(_this.width) + parseInt(p.right);
        newH = parseInt(p.top) + parseInt(_this.height) + parseInt(p.bottom);

        if (isNaN(newW) || isNaN(newH) || newW < 1 || newH < 1) {
            throw 'KlCanvas.resizeCanvas - invalid canvas size';
        }

        offX = p.left;
        offY = p.top;
        for (let i = 0; i < layerCanvasArr.length; i++) {
            let ctemp = BB.canvas();
            ctemp.width = _this.width;
            ctemp.height = _this.height;
            ctemp.getContext("2d").drawImage(layerCanvasArr[i], 0, 0);

            layerCanvasArr[i].width = newW;
            layerCanvasArr[i].height = newH;
            let layerCtx = layerCanvasArr[i].getContext("2d");
            layerCtx.save();

            if (i === 0 && p.fillColor) {
                layerCtx.fillStyle = BB.ColorConverter.toRgbStr(p.fillColor);
                layerCtx.fillRect(0, 0, newW, newH);
                layerCtx.clearRect(offX, offY, _this.width, _this.height);
            }
            //layerCtx.clearRect(0, 0, rootObj.width, rootObj.height);

            layerCtx.drawImage(ctemp, offX, offY);

            layerCtx.restore();
        }
        width = newW;
        height = newH;
        _this.width = newW;
        _this.height = newH;
    };
    _this.addLayer = function (selected) { //will be inserted one after the selected
        if (layerCanvasArr.length >= maxLayers) {
            return false;
        }
        let canvas = BB.canvas();
        canvas.width = _this.width;
        canvas.height = _this.height;
        (canvas as any).mixModeStr = 'source-over';
        (canvas as any).klCanvas = _this;

        if (selected === undefined) {
            layerCanvasArr[layerCanvasArr.length] = canvas;
            selected = Math.max(0, layerCanvasArr.length - 1);
        } else {
            layerCanvasArr.splice(selected + 1, 0, canvas);
            selected++;
        }

        (canvas as any).name = "Layer " + (layerCanvasArr.length + layerNrOffset);
        history.pause();
        _this.layerOpacity(selected, 1);
        history.pause(false);
        history.add({
            tool: ["canvas"],
            action: "addLayer",
            params: [selected - 1]
        });
        return selected;
    };
    _this.duplicateLayer = function (i) {
        if (!layerCanvasArr[i] || layerCanvasArr.length >= maxLayers) {
            return false;
        }
        let canvas = BB.canvas();
        canvas.width = _this.width;
        canvas.height = _this.height;
        (canvas as any).klCanvas = _this;
        layerCanvasArr.splice(i + 1, 0, canvas);

        (canvas as any).name = layerCanvasArr[i].name + " copy";
        (canvas as any).mixModeStr = layerCanvasArr[i].mixModeStr;
        canvas.getContext("2d").drawImage(layerCanvasArr[i], 0, 0);
        history.pause();
        _this.layerOpacity(i + 1, layerCanvasArr[i].opacity);
        history.pause(false);

        history.add({
            tool: ["canvas"],
            action: "duplicateLayer",
            params: [i]
        });

        return i + 1;
    };
    _this.getLayerContext = function (i, doReturnNull?) {
        if (layerCanvasArr[i]) {
            return layerCanvasArr[i].getContext("2d");
        }
        if (doReturnNull) {
            return null;
        }
        throw "layer of index " + i + " not found (in " + layerCanvasArr.length + " layers)";
    };
    _this.removeLayer = function (i) {
        if (layerCanvasArr[i]) {
            layerCanvasArr.splice(i, 1);
        } else {
            return false;
        }

        history.add({
            tool: ["canvas"],
            action: "removeLayer",
            params: [i]
        });

        return Math.max(0, i - 1);
    };
    _this.renameLayer = function (i, name) {
        if (layerCanvasArr[i]) {
            layerCanvasArr[i].name = name;
        } else {
            return false;
        }

        history.add({
            tool: ["canvas"],
            action: "renameLayer",
            params: [i, name]
        });

        return true;
    };
    _this.layerOpacity = function (i, o) {
        if (!layerCanvasArr[i]) {
            return;
        }
        o = Math.max(0, Math.min(1, o));
        layerCanvasArr[i].opacity = o;

        history.add({
            tool: ["canvas"],
            action: "layerOpacity",
            params: [i, o]
        });

        emitChange();
    };
    _this.moveLayer = function (i, d) {
        if (d === 0) {
            return;
        }
        if (layerCanvasArr[i]) {
            let temp = layerCanvasArr[i];
            layerCanvasArr.splice(i, 1);
            let target = Math.max(0, Math.min(i + d, layerCanvasArr.length));
            layerCanvasArr.splice(target, 0, temp);

            history.add({
                tool: ["canvas"],
                action: "moveLayer",
                params: [i, d]
            });
            return target;
        }
    };
    /**
     *
     * @param layerBottomIndex
     * @param layerTopIndex
     * @param mixModeStr string - canvas mix mode, or 'as-alpha', 'multiply', 'difference'
     * @returns {*}
     */
    _this.mergeLayers = function (layerBottomIndex, layerTopIndex, mixModeStr) {
        if (!layerCanvasArr[layerBottomIndex] || !layerCanvasArr[layerTopIndex] || layerBottomIndex === layerTopIndex) {
            return;
        }
        //order messed up
        if (layerBottomIndex > layerTopIndex) {
            let temp = layerBottomIndex;
            layerBottomIndex = layerTopIndex;
            layerTopIndex = temp;
        }

        let topOpacity = parseFloat(layerCanvasArr[layerTopIndex].opacity);
        if (topOpacity !== 0 && topOpacity) {
            let ctx = layerCanvasArr[layerBottomIndex].getContext("2d");
            ctx.save();

            if(mixModeStr === 'as-alpha') {

                BB.convertToAlphaChannelCanvas(layerCanvasArr[layerTopIndex]);
                ctx.globalCompositeOperation = 'destination-in';
                ctx.globalAlpha = topOpacity;
                layerCanvasArr[layerBottomIndex].getContext("2d").drawImage(layerCanvasArr[layerTopIndex], 0, 0);

            } else {

                if (mixModeStr) {
                    ctx.globalCompositeOperation = mixModeStr;
                }
                ctx.globalAlpha = topOpacity;
                layerCanvasArr[layerBottomIndex].getContext("2d").drawImage(layerCanvasArr[layerTopIndex], 0, 0);

            }

            ctx.restore();

            // workaround for chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=1281185
            // TODO remove if chrome updated
            if (mixModeStr) {
                ctx.save();
                ctx.fillStyle = "rgba(0,0,0,0.01)";
                ctx.fillRect(-0.9999999, -0.9999999, 1, 1);
                ctx.restore();
            }
        }

        history.pause(true);
        _this.removeLayer(layerTopIndex);
        history.pause(false);
        history.add({
            tool: ["canvas"],
            action: "mergeLayers",
            params: [layerBottomIndex, layerTopIndex, mixModeStr]
        });

        return layerBottomIndex;
    };
    _this.rotate = function (deg) {
        while (deg < 0) {
            deg += 360;
        }
        deg %= 360;
        if (deg % 90 != 0 || deg === 0)
            return;
        let temp = BB.canvas();
        if (deg === 0 || deg === 180) {
            temp.width = _this.width;
            temp.height = _this.height;
        } else if (deg === 90 || deg === 270) {
            temp.width = _this.height;
            temp.height = _this.width;
        }
        let ctx = temp.getContext("2d");
        for (let i = 0; i < layerCanvasArr.length; i++) {
            ctx.clearRect(0, 0, temp.width, temp.height);
            ctx.save();
            ctx.translate(temp.width / 2, temp.height / 2);
            ctx.rotate(deg * Math.PI / 180);
            if (deg === 180) {
                ctx.drawImage(layerCanvasArr[i], -temp.width / 2, -temp.height / 2);
            } else if (deg === 90 || deg === 270) {
                ctx.drawImage(layerCanvasArr[i], -temp.height / 2, -temp.width / 2);
            }
            layerCanvasArr[i].width = temp.width;
            layerCanvasArr[i].height = temp.height;
            layerCanvasArr[i].getContext("2d").clearRect(0, 0, layerCanvasArr[i].width, layerCanvasArr[i].height);
            layerCanvasArr[i].getContext("2d").drawImage(temp, 0, 0);
            ctx.restore();
        }
        _this.width = temp.width;
        _this.height = temp.height;
        width = temp.width;
        height = temp.height;
    };
    _this.flip = function (isHorizontal, isVertical, layerIndex) {
        if (!isHorizontal && !isVertical) {
            return;
        }

        let temp = BB.canvas(_this.width, _this.height);
        temp.width = _this.width;
        temp.height = _this.height;
        let tempCtx = temp.getContext("2d");

        for (let i = 0; i < layerCanvasArr.length; i++) {

            if ( (layerIndex || layerIndex === 0) && i !== layerIndex) {
                continue;
            }

            tempCtx.save();
            tempCtx.clearRect(0, 0, temp.width, temp.height);
            tempCtx.translate(temp.width / 2, temp.height / 2);
            tempCtx.scale((isHorizontal ? -1 : 1), (isVertical ? -1 : 1));
            tempCtx.drawImage(layerCanvasArr[i], -temp.width / 2, -temp.height / 2);
            tempCtx.restore();

            layerCanvasArr[i].getContext("2d").clearRect(0, 0, layerCanvasArr[i].width, layerCanvasArr[i].height);
            layerCanvasArr[i].getContext("2d").drawImage(temp, 0, 0);
        }

    };
    _this.layerFill = function (layerIndex, colorObj, compositeOperation) {
        let ctx = layerCanvasArr[layerIndex].getContext("2d");
        ctx.save();
        if(compositeOperation) {
            ctx.globalCompositeOperation = compositeOperation;
        }
        ctx.fillStyle = "rgba(" + colorObj.r + "," + colorObj.g + "," + colorObj.b + ",1)";
        ctx.fillRect(0, 0, layerCanvasArr[layerIndex].width, layerCanvasArr[layerIndex].height);
        ctx.restore();

        // workaround for chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=1281185
        // TODO remove if chrome updated
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.01)";
        ctx.fillRect(-0.9999999, -0.9999999, 1, 1);
        ctx.restore();

        /*if(!document.getElementById('testocanvas')) {
            layerCanvasArr[layerIndex].id = 'testocanvas';
            document.body.appendChild(layerCanvasArr[layerIndex]);
            BB.css(layerCanvasArr[layerIndex], {
                position: 'fixed',
                left: '0',
                top: '0',
                zIndex: '1111111',
                transform: 'scale(0.2)',
                border: '10px solid red',
            });
        }
        if(!document.getElementById('testocanvas')) {
            let c = document.createElement('canvas');
            c.width = 1000;
            c.height = 1000;
            let ctx2 = c.getContext('2d');
            ctx2.drawImage(layerCanvasArr[layerIndex], 0, 0);
            c.id = 'testocanvas';
            document.body.appendChild(c);
            BB.css(c, {
                position: 'fixed',
                left: '0',
                top: '0',
                zIndex: '1111111',
                transform: 'scale(0.2)',
                border: '10px solid red',
            });
        }*/

        history.add({
            tool: ["canvas"],
            action: "layerFill",
            params: [layerIndex, colorObj, compositeOperation]
        });
    };

    /**
     * flood fills the layer
     *
     * @param layerIndex int - index of layer to be filled
     * @param x int - starting point
     * @param y int - starting point
     * @param rgb rgbObj - fill color
     * @param opacity number 0-1
     * @param tolerance int 0-255
     * @param sampleStr string 'current' | 'all' | 'above'
     * @param grow int >= 0 - radius around filled area that is to be filled too
     * @param isContiguous boolean
     */
    _this.floodFill = function (layerIndex, x, y, rgb, opacity, tolerance, sampleStr, grow, isContiguous) {

        if (x < 0 || y < 0 || x >= width || y >= height || opacity === 0) {
            return;
        }

        tolerance = Math.round(tolerance);

        if (!(['above', 'current', 'all'].includes(sampleStr))) {
            throw 'invalid sampleStr';
        }

        let result;

        let srcCtx;
        let srcImageData;
        let srcData;

        let targetCtx;
        let targetImageData;
        let targetData;


        if (sampleStr === 'all') {

            let srcCanvas = layerCanvasArr.length === 1 ? layerCanvasArr[0] : this.getCompleteCanvas(1);
            srcCtx = srcCanvas.getContext('2d');
            srcImageData = srcCtx.getImageData(0, 0, width, height);
            srcData = srcImageData.data;
            result = floodFillBits(srcData, width, height, x, y, tolerance, Math.round(grow), isContiguous);

            srcCanvas = null;
            srcCtx = null;
            srcImageData = null;
            srcData = null;

            targetCtx = layerCanvasArr[layerIndex].getContext('2d');
            targetImageData = targetCtx.getImageData(0, 0, width, height);

        } else {
            let srcIndex = sampleStr === 'above' ? layerIndex + 1 : layerIndex;

            if (srcIndex >= layerCanvasArr.length) {
                return;
            }

            srcCtx = layerCanvasArr[srcIndex].getContext('2d');
            srcImageData = srcCtx.getImageData(0, 0, width, height);
            srcData = srcImageData.data;
            result = floodFillBits(srcData, width, height, x, y, tolerance, Math.round(grow), isContiguous);

            if (layerIndex !== srcIndex) {
                srcCtx = null;
                srcImageData = null;
                srcData = null;
            }

            targetCtx = layerIndex === srcIndex ? srcCtx : layerCanvasArr[layerIndex].getContext('2d');
            targetImageData = layerIndex === srcIndex ? srcImageData : targetCtx.getImageData(0, 0, width, height);

        }

        targetData = targetImageData.data;
        if (opacity === 1) {
            for(let i = 0; i < width * height; i++) {
                if (result.data[i] === 255) {
                    targetData[i * 4] = rgb.r;
                    targetData[i * 4 + 1] = rgb.g;
                    targetData[i * 4 + 2] = rgb.b;
                    targetData[i * 4 + 3] = 255;
                }
            }
        } else {
            for(let i = 0; i < width * height; i++) {
                if (result.data[i] === 255) {
                    targetData[i * 4] = BB.mix(targetData[i * 4], rgb.r, opacity);
                    targetData[i * 4 + 1] = BB.mix(targetData[i * 4 + 1], rgb.g, opacity);
                    targetData[i * 4 + 2] = BB.mix(targetData[i * 4 + 2], rgb.b, opacity);
                    targetData[i * 4 + 3] = BB.mix(targetData[i * 4 + 3], 255, opacity);
                }
            }
        }
        targetCtx.putImageData(targetImageData, 0, 0);


        history.add({
            tool: ["canvas"],
            action: "replaceLayer",
            params: [layerIndex, targetImageData]
        });
    };

    /**
     * draw shape via BB.drawShape
     *
     * @param layerIndex - number
     * @param shapeObj - ShapeObj see BB.drawShape
     */
    _this.drawShape = function(layerIndex, shapeObj) {
        let ctx = layerCanvasArr[layerIndex].getContext("2d");

        drawShape(ctx, shapeObj);

        history.add({
            tool: ["canvas"],
            action: "drawShape",
            params: [layerIndex, BB.copyObj(shapeObj)]
        });
    }

    _this.text = function(layerIndex, p) {
        let pCopy = JSON.parse(JSON.stringify(p));
        p = JSON.parse(JSON.stringify(p));
        p.canvas = layerCanvasArr[layerIndex];
        renderText(p);

        history.add({
            tool: ["canvas"],
            action: "text",
            params: [layerIndex, pCopy]
        });
    };

    _this.replaceLayer = function (layerIndex, imageData) {
        let ctx = layerCanvasArr[layerIndex].getContext("2d");
        ctx.putImageData(imageData, 0, 0);
        history.add({
            tool: ["canvas"],
            action: "replaceLayer",
            params: [layerIndex, imageData]
        });
    };

    _this.clearLayer = function (layerIndex) {
        let ctx = layerCanvasArr[layerIndex].getContext("2d");
        ctx.save();
        ctx.clearRect(0, 0, layerCanvasArr[layerIndex].width, layerCanvasArr[layerIndex].height);
        ctx.restore();

        history.add({
            tool: ["canvas"],
            action: "clearLayer",
            params: [layerIndex]
        });
    };
    _this.getLayers = function () {
        let result = [];
        for (let i = 0; i < layerCanvasArr.length; i++) {
            result[i] = {
                context: layerCanvasArr[i].getContext("2d"),
                opacity: layerCanvasArr[i].opacity,
                name: layerCanvasArr[i].name,
                mixModeStr: layerCanvasArr[i].mixModeStr
            };
        }
        return result;
    };
    _this.getLayersFast = function () {
        let result = [];
        for (let i = 0; i < layerCanvasArr.length; i++) {
            result[i] = {
                canvas: layerCanvasArr[i],
                opacity: layerCanvasArr[i].opacity,
                name: layerCanvasArr[i].name,
                mixModeStr: layerCanvasArr[i].mixModeStr
            };
        }
        return result;
    };
    _this.getLayerIndex = function (canvasObj, doReturnNull) {
        for (let i = 0; i < layerCanvasArr.length; i++) {
            if (layerCanvasArr[i].context.canvas === canvasObj) {
                return i;
            }
        }
        if(!doReturnNull) {
            throw "layer not found (in " + layerCanvasArr.length + " layers)";
        }
        return null;
    };
    _this.getLayer = function (i, doReturnNull) {
        if (layerCanvasArr[i]) {
            return {
                context: layerCanvasArr[i].getContext("2d"),
                opacity: layerCanvasArr[i].opacity,
                name: layerCanvasArr[i].name,
                id: i
            };
        }
        if(!doReturnNull) {
            throw "layer of index " + i + " not found (in " + layerCanvasArr.length + " layers)";
        }
        return null;
    };
    _this.getColorAt = function (x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        let ctx = pickCanvas.getContext("2d");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 1, 1);
        for (let i = 0; i < layerCanvasArr.length; i++) {
            ctx.globalAlpha = parseFloat(layerCanvasArr[i].opacity);
            ctx.globalCompositeOperation = layerCanvasArr[i].mixModeStr;
            ctx.drawImage(layerCanvasArr[i], -x, -y);
        }
        ctx.restore();
        let imdat = ctx.getImageData(0, 0, 1, 1);
        return new BB.RGB(imdat.data[0], imdat.data[1], imdat.data[2]);
    };

    _this.getDataURL = function () {
        let finalim = BB.canvas();
        finalim.width = _this.width;
        finalim.height = _this.height;
        let ctx = finalim.getContext("2d");
        for (let i = 0; i < layerCanvasArr.length; i++) {
            ctx.globalAlpha = parseFloat(layerCanvasArr[i].opacity);
            ctx.globalCompositeOperation = layerCanvasArr[i].mixModeStr;
            ctx.drawImage(layerCanvasArr[i], 0, 0);
        }
        return finalim.toDataURL("image/jpeg");
    };
    _this.getRegion = function (x, y, cnvs) {
        let finalim = cnvs;
        let ctx = finalim.getContext("2d");
        ctx.save();
        for (let i = 0; i < layerCanvasArr.length; i++) {
            ctx.globalAlpha = parseFloat(layerCanvasArr[i].opacity);
            ctx.globalCompositeOperation = layerCanvasArr[i].mixModeStr;
            ctx.drawImage(layerCanvasArr[i], -x, -y);
        }
        ctx.restore();
        return finalim;
    };
    _this.getCompleteCanvas = function (factor) {
        let resultCanvas = BB.canvas();
        resultCanvas.width = Math.max(1, parseInt('' + (_this.width * factor)));
        resultCanvas.height = Math.max(1, parseInt('' + (_this.height * factor)));
        let ctx = resultCanvas.getContext("2d");
        for (let i = 0; i < layerCanvasArr.length; i++) {
            if (parseFloat(layerCanvasArr[i].opacity) === 0) {
                continue;
            }
            ctx.globalAlpha = parseFloat(layerCanvasArr[i].opacity);
            ctx.globalCompositeOperation = layerCanvasArr[i].mixModeStr;
            ctx.drawImage(layerCanvasArr[i], 0, 0, resultCanvas.width, resultCanvas.height);
        }
        return resultCanvas;
    };
    _this.getLayerIndex = function (cnvs) {
        for (let i = 0; i < layerCanvasArr.length; i++) {
            if (layerCanvasArr[i] === cnvs) {
                return i;
            }
        }
        throw 'getLayerIndex layer not found';
    };

    _this.getProject = function(): IKlProject {
        return {
            width: width,
            height: height,
            layers: layerCanvasArr.map(layer => {
                return {
                    name: layer.name,
                    opacity: parseFloat(layer.opacity),
                    mixModeStr: layer.mixModeStr,
                    image: layer,
                };
            }),
        };
    };

    _this.addChangeListener = function(func) {
        if(changeListenerArr.includes(func)) {
            return;
        }
        changeListenerArr.push(func);
    };

    _this.removeChangeListener = function(func) {
        if(!changeListenerArr.includes(func)) {
            return;
        }
        for(let i = 0; i < changeListenerArr.length; i++) {
            if(changeListenerArr[i] === func) {
                changeListenerArr.splice(i, 1);
                return;
            }
        }
    };

    /**
     * sets mixModeStr aka globalCompositeOperation of layer
     * @param layerIndex
     * @param mixModeStr
     */
    _this.setMixMode = function(layerIndex, mixModeStr) {
        if (!layerCanvasArr[layerIndex]) {
            throw 'invalid layer'
        }
        layerCanvasArr[layerIndex].mixModeStr = mixModeStr;

        history.add({
            tool: ["canvas"],
            action: "setMixMode",
            params: [layerIndex, '' + mixModeStr]
        });
    };

    /**
     * Set composite drawing step for KlCanvasWorkspace.
     * To draw temporary stuff on a layer.
     *
     * @param layerIndex - number
     * @param compositeObj - {draw: function(ctx)} | null
     */
    _this.setComposite = function(layerIndex, compositeObj) {
        if (!layerCanvasArr[layerIndex]) {
            throw 'invalid layer'
        }
        layerCanvasArr[layerIndex].compositeObj = compositeObj;
    };

    if (params.copy) {
        _this.copy(params.copy);
        delete params.copy;
    } else if (params.projectObj) {
        (function() {
            let origLayers = params.projectObj.layers;
            init(params.projectObj.width, params.projectObj.height);

            if (!Array.isArray(origLayers)) {
                throw new Error('project.layers is not an array');
            }
            if (origLayers.length === 0) {
                throw new Error('project.layers needs at least 1 layer');
            }

            for (let i = 0; i < origLayers.length; i++) {
                if (origLayers[i].mixModeStr && !allowedMixModes.includes(origLayers[i].mixModeStr)) {
                    throw new Error('unknown mixModeStr ' + origLayers[i].mixModeStr);
                }

                _this.addLayer();
                _this.layerOpacity(i, origLayers[i].opacity);
                layerCanvasArr[i].name = origLayers[i].name;
                layerCanvasArr[i].mixModeStr = origLayers[i].mixModeStr ? origLayers[i].mixModeStr : 'source-over';
                layerCanvasArr[i].getContext("2d").drawImage(origLayers[i].image, 0, 0);
            }
        })();
        delete params.projectObj;
    }

}