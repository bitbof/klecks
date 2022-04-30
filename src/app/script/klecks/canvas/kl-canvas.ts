import {BB} from '../../bb/bb';
import {floodFillBits} from '../image-operations/flood-fill';
import {drawShape} from '../image-operations/shape-tool';
import {IRenderTextParam, renderText} from '../image-operations/render-text';
import {IKlProject, IMixMode, IRGB, IShapeToolObject} from '../kl.types';
import {DecoyKlHistory, KlHistoryInterface} from '../history/kl-history';
import {drawProject} from './draw-project';
import {LANG} from '../../language/language';


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

export const MAX_LAYERS = 16;

interface KlCanvasLayer extends HTMLCanvasElement {
    name: string;
    mixModeStr: IMixMode;
    opacity: number;
    compositeObj?: {
        draw: (ctx: CanvasRenderingContext2D) => void;
    },
    index: number; // certain brushes need to know
}

/**
 * The image/canvas that the user paints on
 * Has layers. layers have names and opacity.
 *
 * Interacts with the history you specify (for undo/redo)
 */
export class KlCanvas {

    // todo changeListener consistent concept
    // todo history interaction, consistent concept - currently have to look at code to know if something pushes on history

    private width: number;
    private height: number;
    private layerCanvasArr: KlCanvasLayer[];
    private pickCanvas: HTMLCanvasElement; // canvas to draw into for color picker
    private history: KlHistoryInterface;
    private changeListenerArr:  (() => void)[]; // subscribers get notified when opacity changes


    private init (w: number, h: number): void {
        if (!w || !h || isNaN(w) || isNaN(h) || w < 1 || h < 1) {
            throw new Error('init - invalid canvas size: ' + w + ', ' + h);
        }
        this.width = w;
        this.height = h;
    }

    private emitChange (): void {
        // some changes don't get captured by the history - e.g. changing opacity as the user drags the slider
        this.changeListenerArr.forEach(item => item());
    }

    private updateIndices (): void {
        this.layerCanvasArr.forEach((item, index) => {
            item.index = index;
        });
    }

    // ---- public ----

    constructor (
        params: {
            projectObj: {
                width: number;
                height: number;
                layers: {
                    name: string;
                    opacity: number;
                    image: HTMLImageElement | HTMLCanvasElement; // already loaded!
                }[];
            }
        } | {
            // creates blank KlCanvas, 0 layers
            width: number;
            height: number;
        } | {
            copy: KlCanvas;
        },
        private layerNrOffset: number = 0,
    ) {
        this.layerCanvasArr = [];
        this.pickCanvas = BB.canvas(1, 1);
        this.history = new DecoyKlHistory();
        if ('copy' in params) {
            this.width = 1;
            this.height = 1;
        } else {
            if ('width' in params && 'height' in params) {
                this.width = params.width;
                this.height = params.height;
            } else {
                this.width = 1;
                this.height = 1;
            }
        }
        this.init(this.width, this.height);

        this.changeListenerArr = [];

        if ('copy' in params) {
            try {
                this.copy(params.copy);
            } catch (e) {
                this.destroy();
                throw e;
            }
        } else if ('projectObj' in params) {
            const origLayers = [].concat(params.projectObj.layers);
            this.init(params.projectObj.width, params.projectObj.height);

            if (!origLayers.length) {
                throw new Error('project.layers needs at least 1 layer');
            }

            for (let i = 0; i < origLayers.length; i++) {
                if (origLayers[i].mixModeStr && !allowedMixModes.includes(origLayers[i].mixModeStr)) {
                    throw new Error('unknown mixModeStr ' + origLayers[i].mixModeStr);
                }

                this.addLayer();
                this.layerOpacity(i, origLayers[i].opacity);
                this.layerCanvasArr[i].name = origLayers[i].name;
                this.layerCanvasArr[i].mixModeStr = origLayers[i].mixModeStr ? origLayers[i].mixModeStr : 'source-over';
                this.layerCanvasArr[i].getContext("2d").drawImage(origLayers[i].image, 0, 0);
            }
        }
        this.updateIndices();
    }

    setHistory (h: KlHistoryInterface): void {
        this.history = h;
    }

    /**
     * Resets canvas -> 1 layer, 100% opacity,
     * unless layers provided.
     * @param p
     */
    reset (
        p: {
            width: number;
            height: number;
            color?: IRGB; // optional - fill color
            image?: HTMLImageElement | HTMLCanvasElement; // image drawn on layer
            layerName?: string; // if via image
            layers?: {
                name: string;
                opacity: number;
                mixModeStr: IMixMode;
                image: HTMLCanvasElement;
            }[];
        }
    ): void | number {
        if (!p.width || !p.height || p.width < 1 || p.height < 1 || isNaN(p.width) || isNaN(p.height) ) {
            throw new Error('invalid canvas size');
        }

        this.history.pause(true);

        this.width = p.width;
        this.height = p.height;

        this.layerCanvasArr.splice(1, Math.max(0, this.layerCanvasArr.length - 1));

        if (p.layers) {
            for (let i = 0; i < p.layers.length; i++) {
                let item = p.layers[i];
                if (!this.layerCanvasArr[i]) {
                    this.addLayer();
                }
                this.layerCanvasArr[i].name = item.name;
                this.layerCanvasArr[i].width = this.width;
                this.layerCanvasArr[i].height = this.height;
                this.layerCanvasArr[i].mixModeStr = item.mixModeStr ? item.mixModeStr : 'source-over';
                this.layerCanvasArr[i].getContext("2d").drawImage(item.image, 0, 0);
                this.layerOpacity(i, item.opacity);
            }
        } else {
            this.layerCanvasArr[0].name = p.layerName ? p.layerName : LANG('layers-layer') + " 1";
            this.layerCanvasArr[0].width = this.width;
            this.layerCanvasArr[0].height = this.height;
            this.layerCanvasArr[0].mixModeStr = 'source-over';
            this.layerOpacity(0, 1);
            if (p.color) {
                this.layerFill(0, p.color);
            } else if (p.image) {
                this.layerCanvasArr[0].getContext("2d").drawImage(p.image, 0, 0);
            }
        }
        this.updateIndices();

        this.history.pause(false);

        this.history.push({
            tool: ["canvas"],
            action: "reset",
            params: [p] // dont screw with p
        });

        return this.layerCanvasArr.length - 1;
    }

    isLayerLimitReached (): boolean {
        return this.layerCanvasArr.length >= MAX_LAYERS;
    }

    getWidth (): number {
        return this.width;
    }

    getHeight (): number {
        return this.height;
    }

    copy (toCopyCanvas: KlCanvas): void {
        if (
            toCopyCanvas.getWidth() < 1 ||
            toCopyCanvas.getHeight() < 1 ||
            isNaN(toCopyCanvas.getWidth()) ||
            isNaN(toCopyCanvas.getHeight())
        ) {
            throw new Error('invalid canvas size');
        }

        // keep existing canvases

        let origLayers = toCopyCanvas.getLayers();

        while (this.layerCanvasArr.length > origLayers.length) {
            this.removeLayer(this.layerCanvasArr.length - 1);
        }

        if (toCopyCanvas.getWidth() != this.width || toCopyCanvas.getHeight() != this.height) {
            this.init(toCopyCanvas.getWidth(), toCopyCanvas.getHeight());
        }
        for (let i = 0; i < origLayers.length; i++) {
            if (i >= this.layerCanvasArr.length) {
                this.addLayer();
            } else {
                this.layerCanvasArr[i].width = this.width;
                this.layerCanvasArr[i].height = this.height;
            }
            this.layerOpacity(i, origLayers[i].opacity);
            this.layerCanvasArr[i].name = origLayers[i].name;
            this.layerCanvasArr[i].mixModeStr = origLayers[i].mixModeStr;
            this.layerCanvasArr[i].getContext("2d").drawImage(origLayers[i].context.canvas, 0, 0);
        }
        this.updateIndices();
    }

    getLayerCount (): number {
        return this.layerCanvasArr.length;
    }

    resize (w: number, h: number, algorithm: 'smooth' | 'pixelated' = 'smooth'): boolean {
        if (!w || !h || (w === this.width && h === this.height) || isNaN(w) || isNaN(h) || w < 1 || h < 1) {
            return false;
        }
        w = Math.max(w, 1);
        h = Math.max(h, 1);

        let tmp1, tmp2;

        if (algorithm === 'pixelated') {
            tmp1 = BB.canvas(w, h);
            let tmp1Ctx = tmp1.getContext('2d');
            tmp1Ctx.imageSmoothingEnabled = false;
            for (let i = 0; i < this.layerCanvasArr.length; i++) {
                if (i > 0) {
                    tmp1Ctx.clearRect(0, 0, w, h);
                }
                let layerCanvas = this.layerCanvasArr[i];
                tmp1Ctx.drawImage(layerCanvas, 0, 0, w, h);
                layerCanvas.width = w;
                layerCanvas.height = h;
                let layerContext = layerCanvas.getContext('2d');
                layerContext.drawImage(tmp1, 0, 0);
            }

        } else if (algorithm === 'smooth') {
            tmp1 = BB.canvas();
            tmp2 = BB.canvas();
            for (let i = 0; i < this.layerCanvasArr.length; i++) {
                BB.resizeCanvas(this.layerCanvasArr[i], w, h, tmp1, tmp2);
            }
        } else {
            throw new Error('unknown resize algorithm');
        }

        this.width = w;
        this.height = h;
        return true;
    }

    /**
     * crop / extend
     * @param p
     */
    resizeCanvas (p: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        fillColor?: IRGB
    }): void {

        const newW = Math.round(p.left) + this.width + Math.round(p.right);
        const newH = Math.round(p.top) + this.height + Math.round(p.bottom);
        const offX = Math.round(p.left);
        const offY = Math.round(p.top);

        if (isNaN(newW) || isNaN(newH) || newW < 1 || newH < 1) {
            throw new Error('KlCanvas.resizeCanvas - invalid canvas size');
        }

        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            const ctemp = BB.canvas(this.width, this.height);
            let layerCanvas = this.layerCanvasArr[i];
            let layerCtx = this.layerCanvasArr[i].getContext("2d");
            ctemp.getContext("2d").drawImage(layerCanvas, 0, 0);

            this.layerCanvasArr[i].width = newW;
            this.layerCanvasArr[i].height = newH;

            layerCtx.save();
            if (i === 0 && p.fillColor) {
                layerCtx.fillStyle = BB.ColorConverter.toRgbStr(p.fillColor);
                layerCtx.fillRect(0, 0, newW, newH);
                layerCtx.clearRect(offX, offY, this.width, this.height);
            }
            layerCtx.drawImage(ctemp, offX, offY);
            layerCtx.restore();
        }
        this.width = newW;
        this.height = newH;
    }

    /**
     * will be inserted on top of selected
     * @param selected
     */
    addLayer (selected?: number): false | number {
        if (this.isLayerLimitReached()) {
            return false;
        }
        let canvas = BB.canvas(this.width, this.height);
        if (!canvas.getContext('2d')) {
            throw new Error('kl-create-canvas-error');
        }

        (canvas as any).mixModeStr = 'source-over';

        if (selected === undefined) {
            this.layerCanvasArr[this.layerCanvasArr.length] = canvas as any;
            selected = Math.max(0, this.layerCanvasArr.length - 1);
        } else {
            this.layerCanvasArr.splice(selected + 1, 0, canvas as any);
            selected++;
        }

        (canvas as any).name = LANG('layers-layer') + " " + (this.layerCanvasArr.length + this.layerNrOffset);
        this.history.pause(true);
        this.layerOpacity(selected, 1);
        this.history.pause(false);
        this.updateIndices();
        this.history.push({
            tool: ["canvas"],
            action: "addLayer",
            params: [selected - 1]
        });
        return selected;
    }

    duplicateLayer (i: number): false | number {
        if (!this.layerCanvasArr[i] || this.isLayerLimitReached()) {
            return false;
        }
        let canvas = BB.canvas(this.width, this.height);
        this.layerCanvasArr.splice(i + 1, 0, canvas as any);

        (canvas as any).name = this.layerCanvasArr[i].name + " " + LANG('layers-copy');
        (canvas as any).mixModeStr = this.layerCanvasArr[i].mixModeStr;
        canvas.getContext("2d").drawImage(this.layerCanvasArr[i], 0, 0);
        this.history.pause(true);
        this.layerOpacity(i + 1, this.layerCanvasArr[i].opacity);
        this.history.pause(false);

        this.updateIndices();

        this.history.push({
            tool: ["canvas"],
            action: "duplicateLayer",
            params: [i]
        });
        return i + 1;
    }

    getLayerContext (i: number, doReturnNull?: boolean): CanvasRenderingContext2D | null {
        if (this.layerCanvasArr[i]) {
            return this.layerCanvasArr[i].getContext("2d");
        }
        if (doReturnNull) {
            return null;
        }
        throw new Error("layer of index " + i + " not found (in " + this.layerCanvasArr.length + " layers)");
    }

    removeLayer (i: number): false | number {
        if (this.layerCanvasArr[i]) {
            this.layerCanvasArr.splice(i, 1);
            this.updateIndices();
        } else {
            return false;
        }
        this.history.push({
            tool: ["canvas"],
            action: "removeLayer",
            params: [i]
        });

        return Math.max(0, i - 1);
    }

    renameLayer (i: number, name: string): boolean {
        if (this.layerCanvasArr[i]) {
            this.layerCanvasArr[i].name = name;
        } else {
            return false;
        }

        this.history.push({
            tool: ["canvas"],
            action: "renameLayer",
            params: [i, name]
        });

        return true;
    }

    layerOpacity (i: number, o: number): void {
        if (!this.layerCanvasArr[i]) {
            return;
        }
        o = Math.max(0, Math.min(1, o));
        this.layerCanvasArr[i].opacity = o;

        this.history.push({
            tool: ["canvas"],
            action: "layerOpacity",
            params: [i, o]
        });

        this.emitChange();
    }

    moveLayer (i: number, d: number): void | number {
        if (d === 0) {
            return;
        }
        if (this.layerCanvasArr[i]) {
            const temp = this.layerCanvasArr[i];
            this.layerCanvasArr.splice(i, 1);
            const targetIndex = Math.max(0, Math.min(i + d, this.layerCanvasArr.length));
            this.layerCanvasArr.splice(targetIndex, 0, temp);
            this.updateIndices();
            this.history.push({
                tool: ["canvas"],
                action: "moveLayer",
                params: [i, d]
            });
            return targetIndex;
        }
    }

    mergeLayers (layerBottomIndex: number, layerTopIndex: number, mixModeStr: IMixMode | 'as-alpha'): void | number {
        if (
            !this.layerCanvasArr[layerBottomIndex] ||
            !this.layerCanvasArr[layerTopIndex] ||
            layerBottomIndex === layerTopIndex
        ) {
            return;
        }
        //order messed up
        if (layerBottomIndex > layerTopIndex) {
            let temp = layerBottomIndex;
            layerBottomIndex = layerTopIndex;
            layerTopIndex = temp;
        }

        let topOpacity = this.layerCanvasArr[layerTopIndex].opacity;
        if (topOpacity !== 0 && topOpacity) {
            let ctx = this.layerCanvasArr[layerBottomIndex].getContext("2d");
            ctx.save();

            if (mixModeStr === 'as-alpha') { // todo remove this?

                BB.convertToAlphaChannelCanvas(this.layerCanvasArr[layerTopIndex]);
                ctx.globalCompositeOperation = 'destination-in';
                ctx.globalAlpha = topOpacity;
                this.layerCanvasArr[layerBottomIndex].getContext("2d").drawImage(this.layerCanvasArr[layerTopIndex], 0, 0);

            } else {

                if (mixModeStr) {
                    ctx.globalCompositeOperation = mixModeStr;
                }
                ctx.globalAlpha = topOpacity;
                this.layerCanvasArr[layerBottomIndex].getContext("2d").drawImage(this.layerCanvasArr[layerTopIndex], 0, 0);

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
        this.updateIndices();
        this.history.pause(true);
        this.removeLayer(layerTopIndex);
        this.history.pause(false);
        this.history.push({
            tool: ["canvas"],
            action: "mergeLayers",
            params: [layerBottomIndex, layerTopIndex, mixModeStr]
        });

        return layerBottomIndex;
    }

    rotate (deg: number): void {
        while (deg < 0) {
            deg += 360;
        }
        deg %= 360;
        if (deg % 90 != 0 || deg === 0)
            return;
        let temp = BB.canvas();
        if (deg === 0 || deg === 180) {
            temp.width = this.width;
            temp.height = this.height;
        } else if (deg === 90 || deg === 270) {
            temp.width = this.height;
            temp.height = this.width;
        }
        let ctx = temp.getContext("2d");
        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            ctx.clearRect(0, 0, temp.width, temp.height);
            ctx.save();
            ctx.translate(temp.width / 2, temp.height / 2);
            ctx.rotate(deg * Math.PI / 180);
            if (deg === 180) {
                ctx.drawImage(this.layerCanvasArr[i], -temp.width / 2, -temp.height / 2);
            } else if (deg === 90 || deg === 270) {
                ctx.drawImage(this.layerCanvasArr[i], -temp.height / 2, -temp.width / 2);
            }
            this.layerCanvasArr[i].width = temp.width;
            this.layerCanvasArr[i].height = temp.height;
            this.layerCanvasArr[i].getContext("2d").clearRect(0, 0, this.layerCanvasArr[i].width, this.layerCanvasArr[i].height);
            this.layerCanvasArr[i].getContext("2d").drawImage(temp, 0, 0);
            ctx.restore();
        }
        this.width = temp.width;
        this.height = temp.height;
    }

    flip (isHorizontal: boolean, isVertical: boolean, layerIndex: number): void {
        if (!isHorizontal && !isVertical) {
            return;
        }

        let temp = BB.canvas(this.width, this.height);
        temp.width = this.width;
        temp.height = this.height;
        let tempCtx = temp.getContext("2d");

        for (let i = 0; i < this.layerCanvasArr.length; i++) {

            if ( (layerIndex || layerIndex === 0) && i !== layerIndex) {
                continue;
            }

            tempCtx.save();
            tempCtx.clearRect(0, 0, temp.width, temp.height);
            tempCtx.translate(temp.width / 2, temp.height / 2);
            tempCtx.scale((isHorizontal ? -1 : 1), (isVertical ? -1 : 1));
            tempCtx.drawImage(this.layerCanvasArr[i], -temp.width / 2, -temp.height / 2);
            tempCtx.restore();

            this.layerCanvasArr[i].getContext("2d").clearRect(0, 0, this.layerCanvasArr[i].width, this.layerCanvasArr[i].height);
            this.layerCanvasArr[i].getContext("2d").drawImage(temp, 0, 0);
        }
    }

    layerFill (layerIndex: number, colorObj: IRGB, compositeOperation?: string): void {
        let ctx = this.layerCanvasArr[layerIndex].getContext("2d");
        ctx.save();
        if (compositeOperation) {
            ctx.globalCompositeOperation = compositeOperation as GlobalCompositeOperation;
        }
        ctx.fillStyle = "rgba(" + colorObj.r + "," + colorObj.g + "," + colorObj.b + ",1)";
        ctx.fillRect(0, 0, this.layerCanvasArr[layerIndex].width, this.layerCanvasArr[layerIndex].height);
        ctx.restore();

        // workaround for chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=1281185
        // TODO remove if chrome updated
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.01)";
        ctx.fillRect(-0.9999999, -0.9999999, 1, 1);
        ctx.restore();

        /*if (!document.getElementById('testocanvas')) {
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
        if (!document.getElementById('testocanvas')) {
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

        this.history.push({
            tool: ["canvas"],
            action: "layerFill",
            params: [layerIndex, colorObj, compositeOperation]
        });
    }

    floodFill (
        layerIndex: number, // index of layer to be filled
        x: number, // starting point
        y: number,
        rgb: IRGB, // fill color
        opacity: number,
        tolerance: number,
        sampleStr: 'current' | 'all' | 'above',
        grow: number, // int >= 0 - radius around filled area that is to be filled too
        isContiguous: boolean,
    ): void {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height || opacity === 0) {
            return;
        }
        tolerance = Math.round(tolerance);

        if (!(['above', 'current', 'all'].includes(sampleStr))) {
            throw new Error('invalid sampleStr');
        }

        let result;

        let srcCtx;
        let srcImageData;
        let srcData;

        let targetCtx;
        let targetImageData;
        let targetData;


        if (sampleStr === 'all') {

            let srcCanvas = this.layerCanvasArr.length === 1 ? this.layerCanvasArr[0] : this.getCompleteCanvas(1);
            srcCtx = srcCanvas.getContext('2d');
            srcImageData = srcCtx.getImageData(0, 0, this.width, this.height);
            srcData = srcImageData.data;
            result = floodFillBits(srcData, this.width, this.height, x, y, tolerance, Math.round(grow), isContiguous);

            srcCanvas = null;
            srcCtx = null;
            srcImageData = null;
            srcData = null;

            targetCtx = this.layerCanvasArr[layerIndex].getContext('2d');
            targetImageData = targetCtx.getImageData(0, 0, this.width, this.height);

        } else {
            let srcIndex = sampleStr === 'above' ? layerIndex + 1 : layerIndex;

            if (srcIndex >= this.layerCanvasArr.length) {
                return;
            }

            srcCtx = this.layerCanvasArr[srcIndex].getContext('2d');
            srcImageData = srcCtx.getImageData(0, 0, this.width, this.height);
            srcData = srcImageData.data;
            result = floodFillBits(srcData, this.width, this.height, x, y, tolerance, Math.round(grow), isContiguous);

            if (layerIndex !== srcIndex) {
                srcCtx = null;
                srcImageData = null;
                srcData = null;
            }

            targetCtx = layerIndex === srcIndex ? srcCtx : this.layerCanvasArr[layerIndex].getContext('2d');
            targetImageData = layerIndex === srcIndex ? srcImageData : targetCtx.getImageData(0, 0, this.width, this.height);

        }

        targetData = targetImageData.data;
        if (opacity === 1) {
            for (let i = 0; i < this.width * this.height; i++) {
                if (result.data[i] === 255) {
                    targetData[i * 4] = rgb.r;
                    targetData[i * 4 + 1] = rgb.g;
                    targetData[i * 4 + 2] = rgb.b;
                    targetData[i * 4 + 3] = 255;
                }
            }
        } else {
            for (let i = 0; i < this.width * this.height; i++) {
                if (result.data[i] === 255) {
                    targetData[i * 4] = BB.mix(targetData[i * 4], rgb.r, opacity);
                    targetData[i * 4 + 1] = BB.mix(targetData[i * 4 + 1], rgb.g, opacity);
                    targetData[i * 4 + 2] = BB.mix(targetData[i * 4 + 2], rgb.b, opacity);
                    targetData[i * 4 + 3] = BB.mix(targetData[i * 4 + 3], 255, opacity);
                }
            }
        }
        targetCtx.putImageData(targetImageData, 0, 0);


        this.history.push({
            tool: ["canvas"],
            action: "replaceLayer",
            params: [layerIndex, targetImageData]
        });
    }

    /**
     * draw shape via BB.drawShape
     * @param layerIndex
     * @param shapeObj
     */
    drawShape (layerIndex: number, shapeObj: IShapeToolObject): void {
        drawShape(this.layerCanvasArr[layerIndex].getContext("2d"), shapeObj);
        this.history.push({
            tool: ["canvas"],
            action: "drawShape",
            params: [layerIndex, BB.copyObj(shapeObj)],
        });
    }

    text (layerIndex: number, p: IRenderTextParam): void {
        renderText(this.layerCanvasArr[layerIndex], BB.copyObj(p));
        this.history.push({
            tool: ["canvas"],
            action: "text",
            params: [layerIndex, BB.copyObj(p)],
        });
    }

    replaceLayer (layerIndex: number, imageData: ImageData): void {
        let ctx = this.layerCanvasArr[layerIndex].getContext("2d");
        ctx.putImageData(imageData, 0, 0);
        this.history.push({
            tool: ["canvas"],
            action: "replaceLayer",
            params: [layerIndex, imageData],
        });
    }

    clearLayer (layerIndex: number): void {
        let ctx = this.layerCanvasArr[layerIndex].getContext("2d");
        ctx.save();
        ctx.clearRect(0, 0, this.layerCanvasArr[layerIndex].width, this.layerCanvasArr[layerIndex].height);
        ctx.restore();

        this.history.push({
            tool: ["canvas"],
            action: "clearLayer",
            params: [layerIndex]
        });
    }

    getLayers (): {
        context: CanvasRenderingContext2D;
        opacity: number;
        name: string;
        mixModeStr: IMixMode;
    }[] {
        return this.layerCanvasArr.map(item => {
            return {
                context: item.getContext("2d"),
                opacity: item.opacity,
                name: item.name,
                mixModeStr: item.mixModeStr,
            };
        });
    }

    getLayersFast (): {
        canvas: KlCanvasLayer;
        opacity: number;
        name: string;
        mixModeStr: IMixMode;
    }[] {
        return this.layerCanvasArr.map(item => {
            return {
                canvas: item,
                opacity: item.opacity,
                name: item.name,
                mixModeStr: item.mixModeStr,
            };
        });
    }

    getLayerIndex (canvasObj: HTMLCanvasElement, doReturnNull?: boolean): null | number {
        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            if (this.layerCanvasArr[i] === canvasObj) {
                return i;
            }
        }
        if (!doReturnNull) {
            throw new Error("layer not found (in " + this.layerCanvasArr.length + " layers)");
        }
        return null;
    }

    getLayer (index: number, doReturnNull?: boolean): null | {
        context: CanvasRenderingContext2D;
        opacity: number;
        name: string;
        id: number;
    } {
        if (this.layerCanvasArr[index]) {
            return {
                context: this.layerCanvasArr[index].getContext("2d"),
                opacity: this.layerCanvasArr[index].opacity,
                name: this.layerCanvasArr[index].name,
                id: index,
            };
        }
        if (!doReturnNull) {
            throw new Error("layer of index " + index + " not found (in " + this.layerCanvasArr.length + " layers)");
        }
        return null;
    }

    getColorAt (x: number, y: number): IRGB {
        x = Math.floor(x);
        y = Math.floor(y);
        let ctx = this.pickCanvas.getContext("2d");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 1, 1);
        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            ctx.globalAlpha = this.layerCanvasArr[i].opacity;
            ctx.globalCompositeOperation = this.layerCanvasArr[i].mixModeStr;
            ctx.drawImage(this.layerCanvasArr[i], -x, -y);
        }
        ctx.restore();
        let imData = ctx.getImageData(0, 0, 1, 1);
        return new BB.RGB(imData.data[0], imData.data[1], imData.data[2]);
    }

    getCompleteCanvas (factor: number): HTMLCanvasElement {
        return drawProject(this.getProject(), factor);
    }

    getProject (): IKlProject {
        return {
            width: this.width,
            height: this.height,
            layers: this.layerCanvasArr.map(layer => {
                return {
                    name: layer.name,
                    opacity: layer.opacity,
                    mixModeStr: layer.mixModeStr,
                    image: layer,
                };
            }),
        };
    }

    addChangeListener (func: () => void): void {
        if (this.changeListenerArr.includes(func)) {
            return;
        }
        this.changeListenerArr.push(func);
    }

    removeChangeListener (func: () => void): void {
        for (let i = 0; i < this.changeListenerArr.length; i++) {
            if (this.changeListenerArr[i] === func) {
                this.changeListenerArr.splice(i, 1);
                return;
            }
        }
    }

    setMixMode (layerIndex: number, mixModeStr: IMixMode): void {
        if (!this.layerCanvasArr[layerIndex]) {
            throw new Error('invalid layer');
        }
        this.layerCanvasArr[layerIndex].mixModeStr = mixModeStr;

        this.history.push({
            tool: ["canvas"],
            action: "setMixMode",
            params: [layerIndex, '' + mixModeStr],
        });
    }

    /**
     * Set composite drawing step for KlCanvasWorkspace.
     * To apply temporary manipulations to a layer.
     *
     * @param layerIndex
     * @param compositeObj
     */
    setComposite (
        layerIndex: number,
        compositeObj: null | {
            draw: (ctx: CanvasRenderingContext2D) => void;
        }
    ): void {
        if (!this.layerCanvasArr[layerIndex]) {
            throw new Error('invalid layer');
        }
        this.layerCanvasArr[layerIndex].compositeObj = compositeObj;
    }

    destroy (): void {
        if (this.layerCanvasArr === null) {
            return;
        }
        this.layerCanvasArr.forEach(canvas => {
            BB.freeCanvas(canvas);
        });
        this.layerCanvasArr = null;
    }

}
