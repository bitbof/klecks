import { BB } from '../../bb/bb';
import { floodFillBits } from '../image-operations/flood-fill';
import { drawShape } from '../image-operations/shape-tool';
import { TRenderTextParam, renderText } from '../image-operations/render-text';
import {
    IGradient,
    IKlProject,
    IRGB,
    IShapeToolObject,
    TFillSampling,
    TKlCanvasLayer,
    TMixMode,
} from '../kl-types';
import { IHistoryEntry, KlHistory, THistoryActions } from '../history/kl-history';
import { drawProject } from './draw-project';
import { LANG } from '../../language/language';
import { drawGradient } from '../image-operations/gradient-tool';
import { IRect, IVector2D } from '../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { compose, identity, Matrix, translate, fromObject } from 'transformation-matrix';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { intBoundsWithinArea } from '../../bb/math/math';
import { canvasBounds } from '../../bb/base/canvas';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';
import { getEraseColor } from '../brushes/erase-color';

// TODO remove in 2026
// workaround for chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=1281185
// reported 2021-13 (v96), fixed 2022-02 (v99)
// affects: source-in, source-out, destination-in, destination-atop
function workaroundForChromium1281185(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fillRect(-0.9999999, -0.9999999, 1, 1);
    ctx.restore();
}

export type TKlCanvasHistoryEntry = THistoryActions<'canvas', KlCanvas>;

export function isKlCanvasHistoryEntry(entry: IHistoryEntry): entry is TKlCanvasHistoryEntry {
    return entry.tool[0] === 'canvas';
}

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
] as const;

export const MAX_LAYERS = 16;

export interface KlCanvasLayer extends HTMLCanvasElement {
    name: string;
    mixModeStr: TMixMode;
    isVisible: boolean;
    opacity: number;
    compositeObj?: TLayerComposite;
    index: number; // certain brushes need to know
}

export type KlCanvasContext = CanvasRenderingContext2D & {
    canvas: KlCanvasLayer;
};

export type TSelectionSample = {
    image: HTMLCanvasElement | undefined; // undefined if all pixels transparent
    transformation: Matrix;
};

export type TLayerComposite = {
    draw: (ctx: CanvasRenderingContext2D) => void;
};

/**
 * The image/canvas that the user paints on
 * Has layers. layers have names and opacity.
 *
 * Interacts with the history you specify (for undo/redo)
 */
export class KlCanvas {
    // todo changeListener consistent concept
    // todo history interaction, consistent concept - currently have to look at code to know if something pushes on history

    private isDestroyed = false;
    private width: number;
    private height: number;
    private layerCanvasArr: KlCanvasLayer[];
    private pickCanvas: HTMLCanvasElement; // canvas to draw into for color picker
    private selection: undefined | MultiPolygon = undefined;
    private history: KlHistory | undefined;
    private changeListenerArr: (() => void)[]; // subscribers get notified when opacity changes
    /**
     * Transforming via selection creates a selection sample, which is the area of a layer which got selected.
     * This way consecutive transformations don't resample each time.
     * The selection is not yet applied in the sample, so it can be sharp when drawing it. (e.g. when upscaling)
     */
    private selectionSample: undefined | TSelectionSample = undefined;

    private init(w: number, h: number): void {
        if (!w || !h || isNaN(w) || isNaN(h) || w < 1 || h < 1) {
            throw new Error('init - invalid canvas size: ' + w + ', ' + h);
        }
        this.width = w;
        this.height = h;
    }

    private emitChange(): void {
        // some changes don't get captured by the history - e.g. changing opacity as the user drags the slider
        this.changeListenerArr.forEach((item) => item());
    }

    private updateIndices(): void {
        this.layerCanvasArr.forEach((item, index) => {
            item.index = index;
        });
    }

    private getSelectionOrFallback(): MultiPolygon {
        return (
            this.selection ?? [
                [
                    [
                        [0, 0],
                        [this.width, 0],
                        [this.width, this.height],
                        [0, this.height],
                        [0, 0],
                    ],
                ],
            ]
        );
    }

    /**
     * Create selection sample from the current selection. If none, will create of entire layer.
     */
    private createSelectionSample(layerIndex: number): void {
        const sampleBounds = this.getSelectionArea(layerIndex);

        // empty
        if (!sampleBounds) {
            this.selectionSample = {
                image: undefined,
                transformation: identity(),
            };
            return;
        }

        const srcLayerCanvas = this.layerCanvasArr[layerIndex];
        const sampleCanvas = BB.canvas(sampleBounds.width, sampleBounds.height);
        const sampleCtx = BB.ctx(sampleCanvas);
        sampleCtx.save();
        sampleCtx.translate(-sampleBounds.x, -sampleBounds.y);
        sampleCtx.drawImage(srcLayerCanvas, 0, 0);
        sampleCtx.restore();

        this.selectionSample = {
            image: sampleCanvas,
            transformation: translate(sampleBounds.x, sampleBounds.y),
        };
    }

    /**
     * transforms selection and selectionSample
     */
    private transformSelectionAndSample(transformation: Matrix): void {
        if (!this.selectionSample) {
            throw new Error('no selection sample');
        }
        if (this.selection) {
            this.selection = transformMultiPolygon(this.selection, transformation);
        }
        this.selectionSample.transformation = compose([
            transformation,
            this.selectionSample.transformation,
        ]);
    }

    private drawSelectionSample(layerIndex: number, isPixelated: boolean): void {
        if (!this.selectionSample) {
            throw new Error('no selection sample');
        }

        if (!this.selectionSample.image) {
            // selection sample, but it's empty. noop
            return;
        }

        const targetLayerCanvas = this.layerCanvasArr[layerIndex];
        const targetCtx = BB.ctx(targetLayerCanvas);

        const selection = this.getSelectionOrFallback();
        const selectionPath = getSelectionPath2d(selection);

        targetCtx.save();
        targetCtx.clip(selectionPath);
        targetCtx.setTransform(...matrixToTuple(this.selectionSample.transformation));
        if (isPixelated) {
            targetCtx.imageSmoothingEnabled = false;
        }
        targetCtx.drawImage(this.selectionSample.image, 0, 0);
        targetCtx.restore();
    }

    // ----------------------------------- public -----------------------------------

    constructor(
        params:
            | {
                  projectObj: IKlProject;
              }
            | {
                  // creates blank KlCanvas, 0 layers
                  width: number;
                  height: number;
              }
            | {
                  copy: KlCanvas;
              },
        private layerNrOffset: number = 0,
    ) {
        this.layerCanvasArr = [];
        this.pickCanvas = BB.canvas(1, 1);
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
            const inLayers = [...params.projectObj.layers];
            this.init(params.projectObj.width, params.projectObj.height);

            if (!inLayers.length) {
                throw new Error('project.layers needs at least 1 layer');
            }

            for (let i = 0; i < inLayers.length; i++) {
                const mixModeStr = inLayers[i].mixModeStr;
                if (mixModeStr && !allowedMixModes.includes(mixModeStr)) {
                    throw new Error('unknown mixModeStr ' + inLayers[i].mixModeStr);
                }

                this.addLayer();
                this.layerOpacity(i, inLayers[i].opacity);
                this.layerCanvasArr[i].name = inLayers[i].name;
                this.layerCanvasArr[i].isVisible = inLayers[i].isVisible;
                this.layerCanvasArr[i].mixModeStr = mixModeStr || 'source-over';
                BB.ctx(this.layerCanvasArr[i]).drawImage(inLayers[i].image, 0, 0);
            }
        }
        this.updateIndices();
    }

    setHistory(h: KlHistory): void {
        this.history = h;
    }

    /**
     * Resets canvas -> 1 layer, 100% opacity,
     * unless layers provided.
     * @param p
     */
    reset(p: {
        width: number;
        height: number;
        color?: IRGB; // optional - fill color
        image?: HTMLImageElement | HTMLCanvasElement; // image drawn on layer
        layerName?: string; // if via image
        layers?: {
            name: string;
            isVisible: boolean;
            opacity: number;
            mixModeStr: TMixMode;
            image: HTMLCanvasElement;
        }[];
    }): number {
        if (
            !p.width ||
            !p.height ||
            p.width < 1 ||
            p.height < 1 ||
            isNaN(p.width) ||
            isNaN(p.height)
        ) {
            throw new Error('invalid canvas size');
        }

        this.history?.pause(true);

        this.width = p.width;
        this.height = p.height;
        this.selection = undefined;
        this.clearSelectionSample();

        this.layerCanvasArr.splice(1, Math.max(0, this.layerCanvasArr.length - 1));

        if (p.layers) {
            for (let i = 0; i < p.layers.length; i++) {
                const item = p.layers[i];
                if (!this.layerCanvasArr[i]) {
                    this.addLayer();
                }
                this.layerCanvasArr[i].name = item.name;
                this.layerCanvasArr[i].isVisible = item.isVisible;
                this.layerCanvasArr[i].width = this.width;
                this.layerCanvasArr[i].height = this.height;
                this.layerCanvasArr[i].mixModeStr = item.mixModeStr
                    ? item.mixModeStr
                    : 'source-over';
                BB.ctx(this.layerCanvasArr[i]).drawImage(item.image, 0, 0);
                this.layerOpacity(i, item.opacity);
            }
        } else {
            this.layerCanvasArr[0].name = p.layerName ? p.layerName : LANG('layers-layer') + ' 1';
            this.layerCanvasArr[0].isVisible = true;
            this.layerCanvasArr[0].width = this.width;
            this.layerCanvasArr[0].height = this.height;
            this.layerCanvasArr[0].mixModeStr = 'source-over';
            this.layerOpacity(0, 1);
            if (p.color) {
                this.layerFill(0, p.color);
            } else if (p.image) {
                BB.ctx(this.layerCanvasArr[0]).drawImage(p.image, 0, 0);
            }
        }
        this.updateIndices();

        this.history?.pause(false);

        this.history?.push({
            tool: ['canvas'],
            action: 'reset',
            params: [p], // don't modify with p
        } as TKlCanvasHistoryEntry);

        return this.layerCanvasArr.length - 1;
    }

    isLayerLimitReached(): boolean {
        return this.layerCanvasArr.length >= MAX_LAYERS;
    }

    getWidth(): number {
        return this.width;
    }

    getHeight(): number {
        return this.height;
    }

    copy(toCopyCanvas: KlCanvas): void {
        if (
            toCopyCanvas.getWidth() < 1 ||
            toCopyCanvas.getHeight() < 1 ||
            isNaN(toCopyCanvas.getWidth()) ||
            isNaN(toCopyCanvas.getHeight())
        ) {
            throw new Error('invalid canvas size');
        }

        this.history?.pause(true);

        this.selection = toCopyCanvas.getSelection();
        this.clearSelectionSample();
        if (toCopyCanvas.selectionSample) {
            this.selectionSample = {
                image: toCopyCanvas.selectionSample.image
                    ? BB.copyCanvas(toCopyCanvas.selectionSample.image)
                    : undefined,
                transformation: fromObject(toCopyCanvas.selectionSample.transformation),
            };
        }

        // keep existing canvases
        const origLayers = toCopyCanvas.getLayers();

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
            this.layerCanvasArr[i].isVisible = origLayers[i].isVisible;
            this.layerCanvasArr[i].mixModeStr = origLayers[i].mixModeStr;
            BB.ctx(this.layerCanvasArr[i]).drawImage(origLayers[i].context.canvas, 0, 0);
        }
        this.updateIndices();

        this.history?.pause(false);
    }

    getLayerCount(): number {
        return this.layerCanvasArr.length;
    }

    resize(w: number, h: number, algorithm: 'smooth' | 'pixelated' = 'smooth'): boolean {
        if (
            !w ||
            !h ||
            (w === this.width && h === this.height) ||
            isNaN(w) ||
            isNaN(h) ||
            w < 1 ||
            h < 1
        ) {
            return false;
        }
        w = Math.max(w, 1);
        h = Math.max(h, 1);

        let tmp1, tmp2;

        if (algorithm === 'pixelated') {
            tmp1 = BB.canvas(w, h);
            const tmp1Ctx = BB.ctx(tmp1);
            tmp1Ctx.imageSmoothingEnabled = false;
            for (let i = 0; i < this.layerCanvasArr.length; i++) {
                if (i > 0) {
                    tmp1Ctx.clearRect(0, 0, w, h);
                }
                const layerCanvas = this.layerCanvasArr[i];
                tmp1Ctx.drawImage(layerCanvas, 0, 0, w, h);
                layerCanvas.width = w;
                layerCanvas.height = h;
                const layerContext = BB.ctx(layerCanvas);
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
    resizeCanvas(p: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        fillColor?: IRGB;
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
            const layerCanvas = this.layerCanvasArr[i];
            const layerCtx = BB.ctx(this.layerCanvasArr[i]);
            BB.ctx(ctemp).drawImage(layerCanvas, 0, 0);

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
    addLayer(selected?: number): false | number {
        if (this.isLayerLimitReached()) {
            return false;
        }
        const canvas = BB.canvas(this.width, this.height) as KlCanvasLayer;
        if (!canvas.getContext('2d')) {
            throw new Error('kl-create-canvas-error');
        }

        canvas.isVisible = true;
        canvas.mixModeStr = 'source-over';

        if (selected === undefined) {
            this.layerCanvasArr[this.layerCanvasArr.length] = canvas;
            selected = Math.max(0, this.layerCanvasArr.length - 1);
        } else {
            this.layerCanvasArr.splice(selected + 1, 0, canvas);
            selected++;
        }

        canvas.name =
            LANG('layers-layer') + ' ' + (this.layerCanvasArr.length + this.layerNrOffset);
        this.history?.pause(true);
        this.layerOpacity(selected, 1);
        this.history?.pause(false);
        this.updateIndices();
        this.history?.push({
            tool: ['canvas'],
            action: 'addLayer',
            params: [selected - 1],
        } as TKlCanvasHistoryEntry);
        return selected;
    }

    duplicateLayer(i: number): false | number {
        if (!this.layerCanvasArr[i] || this.isLayerLimitReached()) {
            return false;
        }
        const canvas = BB.canvas(this.width, this.height) as KlCanvasLayer;
        this.layerCanvasArr.splice(i + 1, 0, canvas);

        canvas.name = this.layerCanvasArr[i].name + ' ' + LANG('layers-copy');
        canvas.isVisible = this.layerCanvasArr[i].isVisible;
        canvas.mixModeStr = this.layerCanvasArr[i].mixModeStr;
        // 2023-04-30 workaround for https://bugs.webkit.org/show_bug.cgi?id=256151
        // todo replace with simple drawImage eventually when fixed
        BB.ctx(canvas).putImageData(
            BB.ctx(this.layerCanvasArr[i]).getImageData(0, 0, this.width, this.height),
            0,
            0,
        );
        this.history?.pause(true);
        this.layerOpacity(i + 1, this.layerCanvasArr[i].opacity);
        this.history?.pause(false);

        this.updateIndices();

        this.history?.push({
            tool: ['canvas'],
            action: 'duplicateLayer',
            params: [i],
        } as TKlCanvasHistoryEntry);
        return i + 1;
    }

    getLayerContext(i: number, doReturnNull?: boolean): CanvasRenderingContext2D | null {
        if (this.layerCanvasArr[i]) {
            return BB.ctx(this.layerCanvasArr[i]);
        }
        if (doReturnNull) {
            return null;
        }
        throw new Error(
            'layer of index ' + i + ' not found (in ' + this.layerCanvasArr.length + ' layers)',
        );
    }

    removeLayer(i: number): false | number {
        if (this.layerCanvasArr[i]) {
            BB.freeCanvas(this.layerCanvasArr[i]);
            this.layerCanvasArr.splice(i, 1);
            this.updateIndices();
        } else {
            return false;
        }
        this.history?.push({
            tool: ['canvas'],
            action: 'removeLayer',
            params: [i],
        } as TKlCanvasHistoryEntry);

        return Math.max(0, i - 1);
    }

    renameLayer(i: number, name: string): boolean {
        if (this.layerCanvasArr[i]) {
            this.layerCanvasArr[i].name = name;
        } else {
            return false;
        }

        this.history?.push({
            tool: ['canvas'],
            action: 'renameLayer',
            params: [i, name],
        } as TKlCanvasHistoryEntry);

        return true;
    }

    layerOpacity(layerIndex: number, opacity: number): void {
        if (!this.layerCanvasArr[layerIndex]) {
            return;
        }
        opacity = Math.max(0, Math.min(1, opacity));
        this.layerCanvasArr[layerIndex].opacity = opacity;

        this.history?.push({
            tool: ['canvas'],
            action: 'layerOpacity',
            params: [layerIndex, opacity],
        } as TKlCanvasHistoryEntry);

        this.emitChange();
    }

    setLayerIsVisible(layerIndex: number, isVisible: boolean): void {
        if (this.layerCanvasArr[layerIndex]) {
            this.layerCanvasArr[layerIndex].isVisible = isVisible;
        } else {
            throw new Error(`layer ${layerIndex} undefined`);
        }

        this.history?.push({
            tool: ['canvas'],
            action: 'setLayerIsVisible',
            params: [layerIndex, isVisible],
        } as TKlCanvasHistoryEntry);
    }

    moveLayer(i: number, d: number): void | number {
        if (d === 0) {
            return;
        }
        if (this.layerCanvasArr[i]) {
            const temp = this.layerCanvasArr[i];
            this.layerCanvasArr.splice(i, 1);
            const targetIndex = Math.max(0, Math.min(i + d, this.layerCanvasArr.length));
            this.layerCanvasArr.splice(targetIndex, 0, temp);
            this.updateIndices();
            this.history?.push({
                tool: ['canvas'],
                action: 'moveLayer',
                params: [i, d],
            } as TKlCanvasHistoryEntry);
            return targetIndex;
        }
    }

    mergeLayers(
        layerBottomIndex: number,
        layerTopIndex: number,
        mixModeStr: TMixMode | 'as-alpha',
    ): void | number {
        if (
            !this.layerCanvasArr[layerBottomIndex] ||
            !this.layerCanvasArr[layerTopIndex] ||
            layerBottomIndex === layerTopIndex
        ) {
            return;
        }
        //order messed up
        if (layerBottomIndex > layerTopIndex) {
            const temp = layerBottomIndex;
            layerBottomIndex = layerTopIndex;
            layerTopIndex = temp;
        }

        const topOpacity = this.layerCanvasArr[layerTopIndex].opacity;
        if (topOpacity !== 0 && topOpacity) {
            const ctx = BB.ctx(this.layerCanvasArr[layerBottomIndex]);
            ctx.save();

            if (mixModeStr === 'as-alpha') {
                // todo remove this?

                BB.convertToAlphaChannelCanvas(this.layerCanvasArr[layerTopIndex]);
                ctx.globalCompositeOperation = 'destination-in';
                ctx.globalAlpha = topOpacity;
                BB.ctx(this.layerCanvasArr[layerBottomIndex]).drawImage(
                    this.layerCanvasArr[layerTopIndex],
                    0,
                    0,
                );
            } else {
                if (mixModeStr) {
                    ctx.globalCompositeOperation = mixModeStr;
                }
                ctx.globalAlpha = topOpacity;
                BB.ctx(this.layerCanvasArr[layerBottomIndex]).drawImage(
                    this.layerCanvasArr[layerTopIndex],
                    0,
                    0,
                );
            }

            ctx.restore();

            mixModeStr && workaroundForChromium1281185(ctx);
        }
        this.updateIndices();
        this.history?.pause(true);
        this.removeLayer(layerTopIndex);
        this.history?.pause(false);
        this.history?.push({
            tool: ['canvas'],
            action: 'mergeLayers',
            params: [layerBottomIndex, layerTopIndex, mixModeStr],
        } as TKlCanvasHistoryEntry);

        return layerBottomIndex;
    }

    mergeAll(): number | false {
        if (this.layerCanvasArr.length === 1) {
            return false;
        }

        // draw all on bottom layer
        const ctx = BB.ctx(this.layerCanvasArr[0]);
        for (let i = 1; i < this.layerCanvasArr.length; i++) {
            const current = this.layerCanvasArr[i];
            if (!current.isVisible || current.opacity === 0) {
                continue;
            }

            ctx.save();
            ctx.globalCompositeOperation = current.mixModeStr;
            ctx.globalAlpha = current.opacity;
            ctx.drawImage(current, 0, 0);
            ctx.restore();
        }

        this.history?.pause(true);

        // remove upper layers
        for (let i = this.layerCanvasArr.length - 1; i > 0; i--) {
            this.removeLayer(i);
        }

        // rename first layer to "layer 1"
        this.renameLayer(0, LANG('layers-layer') + ' 1');

        this.history?.pause(false);

        this.history?.push({
            tool: ['canvas'],
            action: 'mergeAll',
            params: [],
        } as TKlCanvasHistoryEntry);

        return 0;
    }

    rotate(deg: number): void {
        while (deg < 0) {
            deg += 360;
        }
        deg %= 360;
        if (deg % 90 != 0 || deg === 0) {
            return;
        }
        const temp = BB.canvas();
        if (deg === 0 || deg === 180) {
            temp.width = this.width;
            temp.height = this.height;
        } else if (deg === 90 || deg === 270) {
            temp.width = this.height;
            temp.height = this.width;
        }
        const ctx = BB.ctx(temp);
        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            ctx.clearRect(0, 0, temp.width, temp.height);
            ctx.save();
            ctx.translate(temp.width / 2, temp.height / 2);
            ctx.rotate((deg * Math.PI) / 180);
            if (deg === 180) {
                ctx.drawImage(this.layerCanvasArr[i], -temp.width / 2, -temp.height / 2);
            } else if (deg === 90 || deg === 270) {
                ctx.drawImage(this.layerCanvasArr[i], -temp.height / 2, -temp.width / 2);
            }
            this.layerCanvasArr[i].width = temp.width;
            this.layerCanvasArr[i].height = temp.height;
            BB.ctx(this.layerCanvasArr[i]).clearRect(
                0,
                0,
                this.layerCanvasArr[i].width,
                this.layerCanvasArr[i].height,
            );
            BB.ctx(this.layerCanvasArr[i]).drawImage(temp, 0, 0);
            ctx.restore();
        }
        this.width = temp.width;
        this.height = temp.height;
    }

    flip(isHorizontal: boolean, isVertical: boolean, layerIndex?: number): void {
        if (!isHorizontal && !isVertical) {
            return;
        }

        const temp = BB.canvas(this.width, this.height);
        temp.width = this.width;
        temp.height = this.height;
        const tempCtx = BB.ctx(temp);

        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            if ((layerIndex || layerIndex === 0) && i !== layerIndex) {
                continue;
            }

            tempCtx.save();
            tempCtx.clearRect(0, 0, temp.width, temp.height);
            tempCtx.translate(temp.width / 2, temp.height / 2);
            tempCtx.scale(isHorizontal ? -1 : 1, isVertical ? -1 : 1);
            tempCtx.drawImage(this.layerCanvasArr[i], -temp.width / 2, -temp.height / 2);
            tempCtx.restore();

            BB.ctx(this.layerCanvasArr[i]).clearRect(
                0,
                0,
                this.layerCanvasArr[i].width,
                this.layerCanvasArr[i].height,
            );
            BB.ctx(this.layerCanvasArr[i]).drawImage(temp, 0, 0);
        }
    }

    layerFill(
        layerIndex: number,
        colorObj: IRGB,
        compositeOperation?: string,
        doClipSelection?: boolean,
    ): void {
        const ctx = BB.ctx(this.layerCanvasArr[layerIndex]);
        ctx.save();
        if (compositeOperation) {
            ctx.globalCompositeOperation = compositeOperation as GlobalCompositeOperation;
        }

        if (doClipSelection && this.selection) {
            const selectionPath = getSelectionPath2d(this.selection);
            ctx.clip(selectionPath);
        }

        ctx.fillStyle = 'rgba(' + colorObj.r + ',' + colorObj.g + ',' + colorObj.b + ',1)';
        ctx.fillRect(
            0,
            0,
            this.layerCanvasArr[layerIndex].width,
            this.layerCanvasArr[layerIndex].height,
        );
        ctx.restore();

        // workaround for chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=1281185
        // TODO remove if chrome updated
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fillRect(-0.9999999, -0.9999999, 1, 1);
        ctx.restore();

        /*if (!document.getElementById('testocanvas')) {
            layerCanvasArr[layerIndex].id = 'testocanvas';
            document.body.append(layerCanvasArr[layerIndex]);
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
            document.body.append(c);
            BB.css(c, {
                position: 'fixed',
                left: '0',
                top: '0',
                zIndex: '1111111',
                transform: 'scale(0.2)',
                border: '10px solid red',
            });
        }*/

        this.history?.push({
            tool: ['canvas'],
            action: 'layerFill',
            params: [layerIndex, colorObj, compositeOperation, doClipSelection],
        } as TKlCanvasHistoryEntry);
    }

    floodFill(
        layerIndex: number, // index of layer to be filled
        x: number, // starting point
        y: number,
        rgb: IRGB | null, // fill color, if null -> erase
        opacity: number,
        tolerance: number,
        sampleStr: TFillSampling,
        grow: number, // int >= 0 - radius around filled area that is to be filled too
        isContiguous: boolean,
    ): void {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height || opacity === 0) {
            return;
        }
        tolerance = Math.round(tolerance);

        if (!['above', 'current', 'all'].includes(sampleStr)) {
            throw new Error('invalid sampleStr');
        }

        let result;
        let targetCtx;
        let targetImageData;

        if (sampleStr === 'all') {
            const srcCanvas =
                this.layerCanvasArr.length === 1
                    ? this.layerCanvasArr[0]
                    : this.getCompleteCanvas(1);
            const srcCtx = BB.ctx(srcCanvas);
            const srcImageData = srcCtx.getImageData(0, 0, this.width, this.height);
            const srcData = srcImageData.data;
            result = floodFillBits(
                srcData,
                this.width,
                this.height,
                x,
                y,
                tolerance,
                Math.round(grow),
                isContiguous,
            );

            targetCtx = BB.ctx(this.layerCanvasArr[layerIndex]);
            targetImageData = targetCtx.getImageData(0, 0, this.width, this.height);
        } else {
            const srcIndex = sampleStr === 'above' ? layerIndex + 1 : layerIndex;

            if (srcIndex >= this.layerCanvasArr.length) {
                return;
            }

            const srcCtx = BB.ctx(this.layerCanvasArr[srcIndex]);
            const srcImageData = srcCtx.getImageData(0, 0, this.width, this.height);
            const srcData = srcImageData.data;
            result = floodFillBits(
                srcData,
                this.width,
                this.height,
                x,
                y,
                tolerance,
                Math.round(grow),
                isContiguous,
            );

            targetCtx = layerIndex === srcIndex ? srcCtx : BB.ctx(this.layerCanvasArr[layerIndex]);
            targetImageData =
                layerIndex === srcIndex
                    ? srcImageData
                    : targetCtx.getImageData(0, 0, this.width, this.height);
        }

        const targetData = targetImageData.data;
        if (rgb) {
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
        } else {
            // erase
            if (opacity === 1) {
                for (let i = 0; i < this.width * this.height; i++) {
                    if (result.data[i] === 255) {
                        targetData[i * 4 + 3] = 0;
                    }
                }
            } else {
                for (let i = 0; i < this.width * this.height; i++) {
                    if (result.data[i] === 255) {
                        targetData[i * 4 + 3] = BB.mix(targetData[i * 4 + 3], 0, opacity);
                    }
                }
            }
        }
        targetCtx.putImageData(targetImageData, 0, 0);

        this.history?.push({
            tool: ['canvas'],
            action: 'replaceLayer',
            params: [layerIndex, targetImageData],
        } as TKlCanvasHistoryEntry);
    }

    /**
     * draw shape via BB.drawShape
     * @param layerIndex
     * @param shapeObj
     */
    drawShape(layerIndex: number, shapeObj: IShapeToolObject): void {
        if (shapeObj.x1 === shapeObj.x2 && shapeObj.y1 === shapeObj.y2) {
            return;
        }
        drawShape(BB.ctx(this.layerCanvasArr[layerIndex]), shapeObj);
        this.history?.push({
            tool: ['canvas'],
            action: 'drawShape',
            params: [layerIndex, BB.copyObj(shapeObj)],
        } as TKlCanvasHistoryEntry);
    }

    drawGradient(layerIndex: number, gradientObj: IGradient): void {
        drawGradient(BB.ctx(this.layerCanvasArr[layerIndex]), gradientObj);
        this.history?.push({
            tool: ['canvas'],
            action: 'drawGradient',
            params: [layerIndex, BB.copyObj(gradientObj)],
        } as TKlCanvasHistoryEntry);
    }

    text(layerIndex: number, p: TRenderTextParam): void {
        renderText(this.layerCanvasArr[layerIndex], BB.copyObj(p));
        this.history?.push({
            tool: ['canvas'],
            action: 'text',
            params: [layerIndex, BB.copyObj(p)],
        } as TKlCanvasHistoryEntry);
    }

    replaceLayer(layerIndex: number, imageData: ImageData): void {
        const ctx = BB.ctx(this.layerCanvasArr[layerIndex]);
        ctx.putImageData(imageData, 0, 0);
        this.history?.push({
            tool: ['canvas'],
            action: 'replaceLayer',
            params: [layerIndex, imageData],
        } as TKlCanvasHistoryEntry);
    }

    eraseLayer(p: {
        layerIndex: number;
        useAlphaLock?: boolean; // default false
        useSelection?: boolean; // default false
    }): void {
        const ctx = BB.ctx(this.layerCanvasArr[p.layerIndex]);
        ctx.save();
        if (p.useSelection && this.selection) {
            const selectionPath = getSelectionPath2d(this.selection);
            ctx.clip(selectionPath);
        }
        if (p.useAlphaLock) {
            ctx.globalCompositeOperation = 'source-in';
        } else {
            ctx.globalCompositeOperation = 'destination-out';
        }
        ctx.fillStyle = BB.ColorConverter.toRgbStr(getEraseColor());
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();

        this.history?.push({
            tool: ['canvas'],
            action: 'eraseLayer',
            params: [p],
        } as TKlCanvasHistoryEntry);
    }

    moveRect(
        layerIndex: number,
        targetRect: IRect,
        movement: IVector2D,
        doClone: boolean = false,
    ): void {
        const ctx = BB.ctx(this.layerCanvasArr[layerIndex]);
        ctx.save();

        const rect = {
            x: targetRect.width > 0 ? targetRect.x : targetRect.x + targetRect.width,
            y: targetRect.height > 0 ? targetRect.y : targetRect.y + targetRect.height,
            width: Math.abs(-targetRect.width),
            height: Math.abs(-targetRect.height),
        };

        if (doClone) {
            ctx.drawImage(
                ctx.canvas,
                rect.x,
                rect.y,
                rect.width,
                rect.height,
                rect.x + movement.x,
                rect.y + movement.y,
                rect.width,
                rect.height,
            );
        } else {
            const tempCanvas = BB.canvas(rect.width, rect.height);
            tempCanvas.getContext('2d')!.drawImage(ctx.canvas, -rect.x, -rect.y);
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
            ctx.drawImage(tempCanvas, rect.x + movement.x, rect.y + movement.y);
            BB.freeCanvas(tempCanvas);
        }
        ctx.restore();

        this.history?.push({
            tool: ['canvas'],
            action: 'moveRect',
            params: [layerIndex, { ...rect }, { ...movement }, doClone],
        } as TKlCanvasHistoryEntry);
    }

    getLayers(): {
        context: CanvasRenderingContext2D;
        isVisible: boolean;
        opacity: number;
        name: string;
        mixModeStr: TMixMode;
    }[] {
        return this.layerCanvasArr.map((item) => {
            return {
                context: BB.ctx(item),
                isVisible: item.isVisible,
                opacity: item.opacity,
                name: item.name,
                mixModeStr: item.mixModeStr,
            };
        });
    }

    getLayersFast(): {
        canvas: KlCanvasLayer;
        isVisible: boolean;
        opacity: number;
        name: string;
        mixModeStr: TMixMode;
    }[] {
        return this.layerCanvasArr.map((item) => {
            return {
                canvas: item,
                isVisible: item.isVisible,
                opacity: item.opacity,
                name: item.name,
                mixModeStr: item.mixModeStr,
            };
        });
    }

    getLayerIndex(canvasObj: HTMLCanvasElement, doReturnNull?: boolean): null | number {
        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            if (this.layerCanvasArr[i] === canvasObj) {
                return i;
            }
        }
        if (!doReturnNull) {
            throw new Error('layer not found (in ' + this.layerCanvasArr.length + ' layers)');
        }
        return null;
    }

    getLayer(index: number, doReturnNull?: boolean): null | TKlCanvasLayer {
        if (this.layerCanvasArr[index]) {
            return {
                context: BB.ctx(this.layerCanvasArr[index]),
                isVisible: this.layerCanvasArr[index].isVisible,
                opacity: this.layerCanvasArr[index].opacity,
                name: this.layerCanvasArr[index].name,
                id: index,
            };
        }
        if (!doReturnNull) {
            throw new Error(
                'layer of index ' +
                    index +
                    ' not found (in ' +
                    this.layerCanvasArr.length +
                    ' layers)',
            );
        }
        return null;
    }

    getColorAt(x: number, y: number): IRGB {
        x = Math.floor(x);
        y = Math.floor(y);
        const ctx = BB.ctx(this.pickCanvas);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 1, 1);
        for (let i = 0; i < this.layerCanvasArr.length; i++) {
            const layer = this.layerCanvasArr[i];
            if (!layer.isVisible || layer.opacity === 0) {
                continue;
            }
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.mixModeStr;
            ctx.drawImage(layer, -x, -y);
        }
        ctx.restore();
        const imData = ctx.getImageData(0, 0, 1, 1);
        return new BB.RGB(imData.data[0], imData.data[1], imData.data[2]);
    }

    getCompleteCanvas(factor: number): HTMLCanvasElement {
        return drawProject(this.getProject(), factor);
    }

    getProject(): IKlProject {
        return {
            width: this.width,
            height: this.height,
            layers: this.layerCanvasArr.map((layer) => {
                return {
                    name: layer.name,
                    isVisible: layer.isVisible,
                    opacity: layer.opacity,
                    mixModeStr: layer.mixModeStr,
                    image: layer,
                };
            }),
        };
    }

    addChangeListener(func: () => void): void {
        if (this.changeListenerArr.includes(func)) {
            return;
        }
        this.changeListenerArr.push(func);
    }

    removeChangeListener(func: () => void): void {
        for (let i = 0; i < this.changeListenerArr.length; i++) {
            if (this.changeListenerArr[i] === func) {
                this.changeListenerArr.splice(i, 1);
                return;
            }
        }
    }

    setMixMode(layerIndex: number, mixModeStr: TMixMode): void {
        if (!this.layerCanvasArr[layerIndex]) {
            throw new Error('invalid layer');
        }
        this.layerCanvasArr[layerIndex].mixModeStr = mixModeStr;

        this.history?.push({
            tool: ['canvas'],
            action: 'setMixMode',
            params: [layerIndex, '' + mixModeStr],
        } as TKlCanvasHistoryEntry);
    }

    /**
     * Set composite drawing step for KlCanvasWorkspace.
     * To apply temporary manipulations to a layer.
     *
     * @param layerIndex
     * @param compositeObj
     */
    setComposite(layerIndex: number, compositeObj: undefined | TLayerComposite): void {
        if (!this.layerCanvasArr[layerIndex]) {
            throw new Error('invalid layer');
        }
        this.layerCanvasArr[layerIndex].compositeObj = compositeObj;
    }

    setSelection(selection?: MultiPolygon): void {
        if (!this.selection && !selection) {
            return;
        }

        this.selection = selection;

        this.history?.push({
            tool: ['canvas'],
            action: 'setSelection',
            params: [selection],
            isFree: true,
        } as TKlCanvasHistoryEntry);
    }

    getSelection(): KlCanvas['selection'] {
        return this.selection;
    }

    /**
     * Transforms (move, not clone) the selected region (or the entire canvas if no selection).
     * Also transforms the selection, unless there is no selection.
     * Creates a new selection sample.
     */
    transformViaSelection(p: {
        sourceLayer: number;
        targetLayer?: number;
        transformation: Matrix; // relative to (0,0) of canvas
        isPixelated?: boolean; // default false
        backgroundIsTransparent?: boolean;
    }): void {
        this.history?.pause(true);
        this.createSelectionSample(p.sourceLayer);
        this.eraseLayer({
            layerIndex: p.sourceLayer,
            useSelection: true,
            useAlphaLock: p.sourceLayer === 0 && !p.backgroundIsTransparent,
        });
        this.transformSelectionAndSample(p.transformation);
        this.drawSelectionSample(p.targetLayer ?? p.sourceLayer, p.isPixelated ?? false);
        this.history?.pause(false);
        this.history?.push({
            tool: ['canvas'],
            action: 'transformViaSelection',
            params: [p],
        } as TKlCanvasHistoryEntry);
    }

    /**
     * Transforms the selection sample (creates one if there's none, same way as in transformViaSelection)
     * and draws a clone on target layer.
     * Also transforms the selection, unless there is no selection.
     */
    transformCloneViaSelection(p: {
        sourceLayer?: number;
        targetLayer: number;
        transformation: Matrix; // relative to (0,0) of canvas
        isPixelated?: boolean; // default false
    }): void {
        this.history?.pause(true);
        if (!this.selectionSample) {
            if (p.sourceLayer === undefined) {
                throw new Error('no source layer');
            }
            this.createSelectionSample(p.sourceLayer);
        }
        this.transformSelectionAndSample(p.transformation);
        this.drawSelectionSample(p.targetLayer, p.isPixelated ?? false);
        this.history?.pause(false);
        this.history?.push({
            tool: ['canvas'],
            action: 'transformCloneViaSelection',
            params: [p],
        } as TKlCanvasHistoryEntry);
    }

    clearSelectionSample(): void {
        if (!this.selectionSample) {
            return;
        }
        this.selectionSample.image && BB.freeCanvas(this.selectionSample.image);
        this.selectionSample = undefined;
        this.history?.push({
            tool: ['canvas'],
            action: 'clearSelectionSample',
            isHidden: true,
            params: [],
        });
    }

    getSelectionArea(layerIndex: number): IRect | undefined {
        const srcLayerCanvas = this.layerCanvasArr[layerIndex];
        const srcCtx = BB.ctx(srcLayerCanvas);

        const selection = this.getSelectionOrFallback();
        const selectionBounds = getMultiPolyBounds(selection);
        // integer bounds that are within the canvas
        const canvasSelectionBounds = intBoundsWithinArea(selectionBounds, this.width, this.height);

        // selection area outside of canvas
        if (!canvasSelectionBounds) {
            return undefined;
        }

        // bounds of where pixels are non-transparent
        return canvasBounds(srcCtx, canvasSelectionBounds);
    }

    getSelectionSample(): TSelectionSample | undefined {
        return this.selectionSample;
    }

    getHistory(): KlHistory | undefined {
        return this.history;
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.layerCanvasArr.forEach((canvas) => {
            BB.freeCanvas(canvas);
        });
        this.layerCanvasArr = [];
        this.isDestroyed = true;
    }
}
