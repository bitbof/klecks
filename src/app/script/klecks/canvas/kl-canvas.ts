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
    TLayerFromKlCanvas,
    TMixMode,
} from '../kl-types';
import { drawProject } from './draw-project';
import { LANG } from '../../language/language';
import { drawGradient } from '../image-operations/gradient-tool';
import { IBounds, IRect } from '../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { compose, identity, Matrix, translate, fromObject, rotate } from 'transformation-matrix';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { intBoundsWithinArea, integerBounds } from '../../bb/math/math';
import { canvasBounds } from '../../bb/base/canvas';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';
import { getEraseColor } from '../brushes/erase-color';
import { KlHistory } from '../history/kl-history';
import { getNextLayerId } from '../history/get-next-layer-id';
import {
    THistoryEntryDataComposed,
    THistoryEntryLayerComposed,
    TLayerId,
} from '../history/history.types';
import { createFillColorTiles } from '../history/create-fill-color-tiles';
import { updateLayersViaComposed } from './update-layers-via-composed';
import { isHistoryEntryOpacityChange } from '../history/push-helpers/is-history-entry-opacity-change';
import { isHistoryEntryVisibilityChange } from '../history/push-helpers/is-history-entry-visibility-change';
import { transformBounds } from '../../bb/transform/transform-bounds';
import { getSelectionSampleBounds } from './get-selection-sample-bounds';
import { createLayerMap } from '../history/push-helpers/create-layer-map';
import { Eyedropper } from './eyedropper';

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

export type TKlCanvasLayer = {
    id: TLayerId;
    index: number; // certain brushes need to know
    name: string;
    mixModeStr: TMixMode;
    isVisible: boolean;
    opacity: number;
    compositeObj?: TLayerComposite;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
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
 * Interacts with klHistory
 */
export class KlCanvas {
    private isDestroyed = false;
    private width: number;
    private height: number;
    private layers: TKlCanvasLayer[];
    private eyedropper: Eyedropper;
    private selection: undefined | MultiPolygon = undefined;
    private klHistory: KlHistory = {
        pause: (b: boolean) => {},
        isPaused: () => true,
    } as KlHistory;
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

    private updateIndices(): void {
        this.layers.forEach((item, index) => {
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

        const srcLayer = this.layers[layerIndex];
        const sampleCanvas = BB.canvas(sampleBounds.width, sampleBounds.height);
        const sampleCtx = BB.ctx(sampleCanvas);
        sampleCtx.save();
        sampleCtx.translate(-sampleBounds.x, -sampleBounds.y);
        sampleCtx.drawImage(srcLayer.canvas, 0, 0);
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

        const targetLayer = this.layers[layerIndex];
        const targetCtx = BB.ctx(targetLayer.canvas);

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
        this.layers = [];
        this.eyedropper = new Eyedropper();
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
                this.setOpacity(i, inLayers[i].opacity);
                this.layers[i].name = inLayers[i].name;
                this.layers[i].isVisible = inLayers[i].isVisible;
                this.layers[i].mixModeStr = mixModeStr || 'source-over';
                BB.ctx(this.layers[i].canvas).drawImage(inLayers[i].image, 0, 0);
            }
        }
        this.updateIndices();
    }

    setHistory(h: KlHistory): void {
        this.klHistory = h;
    }

    /*
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
            id: TLayerId;
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

        this.klHistory.pause(true);

        this.width = p.width;
        this.height = p.height;
        this.selection = undefined;
        this.clearSelectionSample();

        this.layers.splice(1, Math.max(0, this.layers.length - 1));

        if (p.layers) {
            for (let i = 0; i < p.layers.length; i++) {
                const pItem = p.layers[i];
                if (!this.layers[i]) {
                    this.addLayer();
                }
                const layer = this.layers[i];
                layer.id = pItem.id;
                layer.name = pItem.name;
                layer.isVisible = pItem.isVisible;
                layer.mixModeStr = pItem.mixModeStr ? pItem.mixModeStr : 'source-over';
                layer.canvas.width = this.width;
                layer.canvas.height = this.height;
                layer.context.drawImage(pItem.image, 0, 0);
                this.setOpacity(i, pItem.opacity);
            }
        } else {
            const layer = this.layers[0];
            layer.name = p.layerName ? p.layerName : LANG('layers-layer') + ' 1';
            layer.isVisible = true;
            layer.canvas.width = this.width;
            layer.canvas.height = this.height;
            layer.mixModeStr = 'source-over';
            this.setOpacity(0, 1);
            if (p.color) {
                this.layerFill(0, p.color);
            } else if (p.image) {
                layer.context.drawImage(p.image, 0, 0);
            }
        }
        this.updateIndices();

        this.klHistory.pause(false);

        if (!this.klHistory.isPaused()) {
            const historyEntryData: THistoryEntryDataComposed = {
                size: {
                    width: this.width,
                    height: this.height,
                },
                selection: { value: this.selection },
                activeLayerId: this.layers[this.layers.length - 1].id,
                layerMap: createLayerMap(this.layers, {
                    attributes: 'all',
                }) as Record<TLayerId, THistoryEntryLayerComposed>,
            };
            this.klHistory.push(historyEntryData);
        }

        return this.layers.length - 1;
    }

    isLayerLimitReached(): boolean {
        return this.layers.length >= MAX_LAYERS;
    }

    getWidth(): number {
        return this.width;
    }

    getHeight(): number {
        return this.height;
    }

    /**
     * without resizing
     */
    setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
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

        this.klHistory.pause(true);

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

        while (this.layers.length > origLayers.length) {
            this.removeLayer(this.layers.length - 1);
        }

        if (toCopyCanvas.getWidth() != this.width || toCopyCanvas.getHeight() != this.height) {
            this.init(toCopyCanvas.getWidth(), toCopyCanvas.getHeight());
        }
        for (let i = 0; i < origLayers.length; i++) {
            if (i >= this.layers.length) {
                this.addLayer();
            } else {
                this.layers[i].canvas.width = this.width;
                this.layers[i].canvas.height = this.height;
            }
            this.setOpacity(i, origLayers[i].opacity);
            this.layers[i].name = origLayers[i].name;
            this.layers[i].isVisible = origLayers[i].isVisible;
            this.layers[i].mixModeStr = origLayers[i].mixModeStr;
            this.layers[i].context.drawImage(origLayers[i].context.canvas, 0, 0);
        }
        this.updateIndices();

        this.klHistory.pause(false);
    }

    getLayerCount(): number {
        return this.layers.length;
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
            for (let i = 0; i < this.layers.length; i++) {
                if (i > 0) {
                    tmp1Ctx.clearRect(0, 0, w, h);
                }
                const layer = this.layers[i];
                tmp1Ctx.drawImage(layer.canvas, 0, 0, w, h);
                layer.canvas.width = w;
                layer.canvas.height = h;
                layer.context.drawImage(tmp1, 0, 0);
            }
        } else if (algorithm === 'smooth') {
            tmp1 = BB.canvas();
            tmp2 = BB.canvas();
            for (let i = 0; i < this.layers.length; i++) {
                BB.resizeCanvas(this.layers[i].canvas, w, h, tmp1, tmp2);
            }
        } else {
            throw new Error('unknown resize algorithm');
        }

        this.width = w;
        this.height = h;

        this.klHistory.push({
            size: {
                width: this.width,
                height: this.height,
            },
            layerMap: createLayerMap(this.layers, { attributes: ['tiles'] }),
        });

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

        for (let i = 0; i < this.layers.length; i++) {
            const ctemp = BB.canvas(this.width, this.height);
            const layer = this.layers[i];
            BB.ctx(ctemp).drawImage(layer.canvas, 0, 0);

            layer.canvas.width = newW;
            layer.canvas.height = newH;

            layer.context.save();
            if (i === 0 && p.fillColor) {
                layer.context.fillStyle = BB.ColorConverter.toRgbStr(p.fillColor);
                layer.context.fillRect(0, 0, newW, newH);
                layer.context.clearRect(offX, offY, this.width, this.height);
            }
            layer.context.drawImage(ctemp, offX, offY);
            layer.context.restore();
        }
        this.width = newW;
        this.height = newH;

        this.klHistory.push({
            size: {
                width: this.width,
                height: this.height,
            },
            layerMap: createLayerMap(this.layers, { attributes: ['tiles'] }),
        });
    }

    /**
     * will be inserted above of selected
     */
    addLayer(
        selectedIndex?: number,
        data?: {
            name?: string;
            mixModeStr?: TMixMode;
            isVisible: boolean;
            opacity: number;
            image: HTMLCanvasElement | HTMLImageElement | ((ctx: CanvasRenderingContext2D) => void);
        },
    ): false | number {
        if (this.isLayerLimitReached()) {
            return false;
        }
        const index = selectedIndex === undefined ? this.layers.length : selectedIndex + 1;

        const canvas = BB.canvas(this.width, this.height);
        const context = BB.ctx(canvas);
        if (data) {
            if (typeof data.image === 'function') {
                data.image(context);
            } else {
                context.drawImage(data.image, 0, 0);
            }
        }

        const layerId = getNextLayerId();
        const layer: TKlCanvasLayer = {
            id: layerId,
            index,
            name:
                data && data.name !== undefined
                    ? data.name
                    : LANG('layers-layer') + ' ' + (this.layers.length + this.layerNrOffset),
            mixModeStr: data ? (data.mixModeStr ?? 'source-over') : 'source-over',
            isVisible: data ? data.isVisible : true,
            opacity: data ? data.opacity : 1,
            canvas,
            context,
        };

        this.layers.splice(index, 0, layer);

        this.klHistory.pause(true);
        this.setOpacity(index, 1);
        this.klHistory.pause(false);
        this.updateIndices();

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                activeLayerId: layerId,
                layerMap: createLayerMap(
                    this.layers,
                    { attributes: ['index'] },
                    {
                        layerId,
                        attributes: 'all',
                        tiles: data
                            ? undefined
                            : createFillColorTiles(this.width, this.height, 'transparent'),
                    },
                ),
            });
        }

        return index;
    }

    duplicateLayer(srcIndex: number): false | number {
        if (!this.layers[srcIndex] || this.isLayerLimitReached()) {
            return false;
        }
        const srcLayer = this.layers[srcIndex];
        const index = srcIndex + 1;

        const canvas = BB.canvas(this.width, this.height);
        const layerId = getNextLayerId();
        const newLayer: TKlCanvasLayer = {
            id: layerId,
            index,
            name: srcLayer.name + ' ' + LANG('layers-copy'),
            mixModeStr: srcLayer.mixModeStr,
            isVisible: srcLayer.isVisible,
            opacity: srcLayer.opacity,
            canvas,
            context: BB.ctx(canvas),
        };

        this.layers.splice(index, 0, newLayer);

        // 2023-04-30 workaround for https://bugs.webkit.org/show_bug.cgi?id=256151
        // todo replace with simple drawImage eventually when fixed
        newLayer.context.putImageData(
            this.layers[srcIndex].context.getImageData(0, 0, this.width, this.height),
            0,
            0,
        );
        this.updateIndices();

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                activeLayerId: layerId,
                layerMap: createLayerMap(
                    this.layers,
                    { attributes: ['index'] },
                    { layerId, attributes: 'all' },
                ),
            });
        }
        return srcIndex + 1;
    }

    getLayerContext(index: number, doReturnNull?: boolean): CanvasRenderingContext2D | null {
        if (this.layers[index]) {
            return this.layers[index].context;
        }
        if (doReturnNull) {
            return null;
        }
        throw new Error(
            'layer of index ' + index + ' not found (in ' + this.layers.length + ' layers)',
        );
    }

    removeLayer(index: number): false | number {
        const toDeleteLayer = this.layers[index];
        if (!toDeleteLayer) {
            return false;
        }
        BB.freeCanvas(toDeleteLayer.canvas);
        this.layers.splice(index, 1);
        this.updateIndices();
        const activeLayerIndex = Math.max(0, index - 1);
        const activeLayerId = this.layers[activeLayerIndex].id;

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                activeLayerId,
                layerMap: createLayerMap(this.layers, { attributes: ['index'] }),
            });
        }
        return activeLayerIndex;
    }

    renameLayer(index: number, name: string): boolean {
        const targetLayer = this.layers[index];
        if (targetLayer) {
            targetLayer.name = name;
        } else {
            return false;
        }

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['name'],
                }),
            });
        }

        return true;
    }

    setOpacity(layerIndex: number, opacity: number): void {
        if (!this.layers[layerIndex]) {
            return;
        }
        opacity = Math.max(0, Math.min(1, opacity));
        this.layers[layerIndex].opacity = opacity;

        if (!this.klHistory.isPaused()) {
            const layerId = this.layers[layerIndex].id;
            const topEntry = this.klHistory.getEntries().at(-1)!.data;
            const replaceTop = isHistoryEntryOpacityChange(topEntry, layerId);
            this.klHistory.push(
                {
                    layerMap: createLayerMap(this.layers, {
                        layerId,
                        attributes: ['opacity'],
                    }),
                },
                replaceTop,
            );
        }
    }

    setLayerIsVisible(layerIndex: number, isVisible: boolean): void {
        if (this.layers[layerIndex]) {
            this.layers[layerIndex].isVisible = isVisible;
        } else {
            throw new Error(`layer ${layerIndex} undefined`);
        }

        if (!this.klHistory.isPaused()) {
            const layerId = this.layers[layerIndex].id;
            const topEntry = this.klHistory.getEntries().at(-1)!.data;
            const replaceTop = isHistoryEntryVisibilityChange(topEntry, layerId);
            this.klHistory.push(
                {
                    layerMap: createLayerMap(this.layers, {
                        layerId,
                        attributes: ['isVisible'],
                    }),
                },
                replaceTop,
            );
        }
    }

    moveLayer(index: number, delta: number): void | number {
        if (delta === 0) {
            return;
        }
        if (!this.layers[index]) {
            return;
        }
        const temp = this.layers[index];
        this.layers.splice(index, 1);
        const targetIndex = Math.max(0, Math.min(index + delta, this.layers.length));
        this.layers.splice(targetIndex, 0, temp);
        this.updateIndices();

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                activeLayerId: this.layers[targetIndex].id,
                layerMap: createLayerMap(this.layers, { attributes: ['index'] }),
            });
        }

        return targetIndex;
    }

    mergeLayers(
        layerBottomIndex: number,
        layerTopIndex: number,
        mixModeStr: TMixMode | 'as-alpha',
    ): void | number {
        if (
            !this.layers[layerBottomIndex] ||
            !this.layers[layerTopIndex] ||
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

        const topLayer = this.layers[layerTopIndex];
        const bottomLayer = this.layers[layerBottomIndex];

        const topOpacity = this.layers[layerTopIndex].opacity;
        const mergedPixelData = topLayer.opacity > 0;
        if (mergedPixelData) {
            const bottomCtx = bottomLayer.context;
            bottomCtx.save();

            if (mixModeStr === 'as-alpha') {
                // todo remove this?

                BB.convertToAlphaChannelCanvas(topLayer.canvas);
                bottomCtx.globalCompositeOperation = 'destination-in';
                bottomCtx.globalAlpha = topOpacity;
                bottomCtx.drawImage(topLayer.canvas, 0, 0);
            } else {
                if (mixModeStr) {
                    bottomCtx.globalCompositeOperation = mixModeStr;
                }
                bottomCtx.globalAlpha = topOpacity;
                bottomCtx.drawImage(topLayer.canvas, 0, 0);
            }

            bottomCtx.restore();

            mixModeStr && workaroundForChromium1281185(bottomCtx);
        }
        this.klHistory.pause(true);
        this.removeLayer(layerTopIndex);
        this.klHistory.pause(false);

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                activeLayerId: bottomLayer.id,
                layerMap: createLayerMap(
                    this.layers,
                    { attributes: ['index'] },
                    mergedPixelData ? { layerId: bottomLayer.id, attributes: 'all' } : undefined,
                ),
            });
        }

        return layerBottomIndex;
    }

    mergeAll(): number | false {
        if (this.layers.length === 1) {
            return false;
        }

        // draw all on bottom layer
        const bottomLayer = this.layers[0];
        bottomLayer.name = LANG('layers-layer') + ' 1';
        const bottomCtx = bottomLayer.context;
        for (let i = 1; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (!layer.isVisible || layer.opacity === 0) {
                continue;
            }
            bottomCtx.save();
            bottomCtx.globalCompositeOperation = layer.mixModeStr;
            bottomCtx.globalAlpha = layer.opacity;
            bottomCtx.drawImage(layer.canvas, 0, 0);
            bottomCtx.restore();
        }

        this.klHistory.pause(true);

        // remove upper layers
        for (let i = this.layers.length - 1; i > 0; i--) {
            this.removeLayer(i);
        }

        this.klHistory.pause(false);

        if (!this.klHistory.isPaused()) {
            const activeLayerId = bottomLayer.id;
            this.klHistory.push({
                activeLayerId,
                layerMap: createLayerMap(this.layers, { attributes: ['tiles'] }),
            });
        }

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
        for (let i = 0; i < this.layers.length; i++) {
            ctx.clearRect(0, 0, temp.width, temp.height);
            ctx.save();
            ctx.translate(temp.width / 2, temp.height / 2);
            ctx.rotate((deg * Math.PI) / 180);
            if (deg === 180) {
                ctx.drawImage(this.layers[i].canvas, -temp.width / 2, -temp.height / 2);
            } else if (deg === 90 || deg === 270) {
                ctx.drawImage(this.layers[i].canvas, -temp.height / 2, -temp.width / 2);
            }
            this.layers[i].canvas.width = temp.width;
            this.layers[i].canvas.height = temp.height;
            this.layers[i].context.clearRect(
                0,
                0,
                this.layers[i].canvas.width,
                this.layers[i].canvas.height,
            );
            this.layers[i].context.drawImage(temp, 0, 0);
            ctx.restore();
        }
        this.width = temp.width;
        this.height = temp.height;

        this.klHistory.push({
            size: {
                width: this.width,
                height: this.height,
            },
            layerMap: createLayerMap(this.layers, { attributes: ['tiles'] }),
        });
    }

    flip(isHorizontal: boolean, isVertical: boolean, layerIndex?: number): void {
        if (!isHorizontal && !isVertical) {
            return;
        }

        const temp = BB.canvas(this.width, this.height);
        temp.width = this.width;
        temp.height = this.height;
        const tempCtx = BB.ctx(temp);

        for (let i = 0; i < this.layers.length; i++) {
            if ((layerIndex || layerIndex === 0) && i !== layerIndex) {
                continue;
            }

            tempCtx.save();
            tempCtx.clearRect(0, 0, temp.width, temp.height);
            tempCtx.translate(temp.width / 2, temp.height / 2);
            tempCtx.scale(isHorizontal ? -1 : 1, isVertical ? -1 : 1);
            tempCtx.drawImage(this.layers[i].canvas, -temp.width / 2, -temp.height / 2);
            tempCtx.restore();

            this.layers[i].context.clearRect(
                0,
                0,
                this.layers[i].canvas.width,
                this.layers[i].canvas.height,
            );
            this.layers[i].context.drawImage(temp, 0, 0);
        }

        const targetLayer = layerIndex === undefined ? undefined : this.layers[layerIndex];
        this.klHistory.push({
            layerMap: createLayerMap(
                this.layers,
                targetLayer
                    ? { layerId: targetLayer.id, attributes: ['tiles'] }
                    : { attributes: ['tiles'] },
            ),
        });
    }

    layerFill(
        layerIndex: number,
        colorObj: IRGB,
        compositeOperation?: string,
        doClipSelection?: boolean,
    ): void {
        const ctx = this.layers[layerIndex].context;
        ctx.save();
        const isUniformFill =
            !(doClipSelection && this.selection) && compositeOperation === undefined;
        if (compositeOperation) {
            ctx.globalCompositeOperation = compositeOperation as GlobalCompositeOperation;
        }

        let bounds: IBounds | undefined;
        if (doClipSelection && this.selection) {
            const selectionPath = getSelectionPath2d(this.selection);
            ctx.clip(selectionPath);
            bounds = integerBounds(getMultiPolyBounds(this.selection));
        }

        const fill = 'rgba(' + colorObj.r + ',' + colorObj.g + ',' + colorObj.b + ',1)';
        ctx.fillStyle = fill;
        ctx.fillRect(
            0,
            0,
            this.layers[layerIndex].canvas.width,
            this.layers[layerIndex].canvas.height,
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

        if (!this.klHistory.isPaused()) {
            const targetLayer = this.layers[layerIndex];
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                    tiles: isUniformFill
                        ? createFillColorTiles(this.width, this.height, fill)
                        : undefined,
                    bounds,
                }),
            });
        }
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

        const targetLayer = this.layers[layerIndex];
        let result: ReturnType<typeof floodFillBits>;
        let targetCtx;
        let targetImageData;

        if (sampleStr === 'all') {
            const srcCanvas =
                this.layers.length === 1 ? this.layers[0].canvas : this.getCompleteCanvas(1);
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

            targetCtx = targetLayer.context;
            targetImageData = targetCtx.getImageData(0, 0, this.width, this.height);
        } else {
            const srcIndex = sampleStr === 'above' ? layerIndex + 1 : layerIndex;

            if (srcIndex >= this.layers.length) {
                return;
            }

            const srcCtx = this.layers[srcIndex].context;
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

            targetCtx = layerIndex === srcIndex ? srcCtx : targetLayer.context;
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

        // const ctx = this.layers[layerIndex].context;
        // ctx.save();
        // ctx.fillStyle = 'rgba(255,0,0,0.2)';
        // ctx.fillRect(
        //     result.bounds.x1,
        //     result.bounds.y1,
        //     result.bounds.x2 - result.bounds.x1,
        //     result.bounds.y2 - result.bounds.y1,
        // );
        // ctx.restore();

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                    bounds: result.bounds,
                }),
            });
        }
    }

    /**
     * draw geometric shape (circle, line, rect)
     * @param layerIndex
     * @param shapeObj
     */
    drawShape(layerIndex: number, shapeObj: IShapeToolObject): void {
        if (shapeObj.x1 === shapeObj.x2 && shapeObj.y1 === shapeObj.y2) {
            return;
        }
        const targetLayer = this.layers[layerIndex];
        const bounds = integerBounds(drawShape(targetLayer.context, shapeObj));

        // const ctx = this.layers[layerIndex].context;
        // ctx.save();
        // ctx.fillStyle = 'rgba(255,0,0,0.2)';
        // ctx.fillRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
        // ctx.restore();

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                    bounds,
                }),
            });
        }
    }

    drawGradient(layerIndex: number, gradientObj: IGradient): void {
        const targetLayer = this.layers[layerIndex];
        drawGradient(targetLayer.context, gradientObj);
        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                }),
            });
        }
    }

    text(layerIndex: number, p: TRenderTextParam): void {
        const targetLayer = this.layers[layerIndex];
        const rect = renderText(targetLayer.canvas, BB.copyObj(p));

        // add 2, because rect not entirely accurate
        const padding = 2 + (p.stroke ? p.stroke.lineWidth / 2 : 0);
        let changedBounds = transformBounds(
            {
                x1: rect.x,
                y1: rect.y,
                x2: rect.x + rect.width,
                y2: rect.y + rect.height,
            },
            compose(translate(p.x, p.y), rotate(-p.angleRad)),
        );
        changedBounds = integerBounds({
            x1: changedBounds.x1 - padding,
            y1: changedBounds.y1 - padding,
            x2: changedBounds.x2 + padding,
            y2: changedBounds.y2 + padding,
        });

        // const ctx = this.layers[layerIndex].context;
        // ctx.save();
        // ctx.fillStyle = 'rgba(255,0,0,0.2)';
        // ctx.fillRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
        // ctx.restore();

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                    bounds: changedBounds,
                }),
            });
        }
    }

    eraseLayer(p: {
        layerIndex: number;
        useAlphaLock?: boolean; // default false
        useSelection?: boolean; // default false
    }): void {
        const targetLayer = this.layers[p.layerIndex];
        const ctx = targetLayer.context;
        ctx.save();
        let bounds: IBounds | undefined;
        if (p.useSelection && this.selection) {
            const selectionPath = getSelectionPath2d(this.selection);
            ctx.clip(selectionPath);
            bounds = integerBounds(getMultiPolyBounds(this.selection));
        }
        if (p.useAlphaLock) {
            ctx.globalCompositeOperation = 'source-in';
        } else {
            ctx.globalCompositeOperation = 'destination-out';
        }
        ctx.fillStyle = BB.ColorConverter.toRgbStr(getEraseColor());
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();

        const isUniformFill = !p.useAlphaLock && !(p.useSelection && this.selection);
        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                    tiles: isUniformFill
                        ? createFillColorTiles(this.width, this.height, 'transparent')
                        : undefined,
                    bounds,
                }),
            });
        }
    }

    getLayers(): {
        id: string;
        canvas: HTMLCanvasElement;
        context: CanvasRenderingContext2D;
        isVisible: boolean;
        opacity: number;
        name: string;
        mixModeStr: TMixMode;
    }[] {
        return this.layers.map((layer) => {
            return {
                id: layer.id,
                canvas: layer.canvas,
                context: layer.context,
                isVisible: layer.isVisible,
                opacity: layer.opacity,
                name: layer.name,
                mixModeStr: layer.mixModeStr,
            };
        });
    }

    getLayersFast(): {
        canvas: HTMLCanvasElement;
        isVisible: boolean;
        opacity: number;
        name: string;
        mixModeStr: TMixMode;
        compositeObj?: TLayerComposite;
    }[] {
        return this.layers.map((item) => {
            return {
                canvas: item.canvas,
                isVisible: item.isVisible,
                opacity: item.opacity,
                name: item.name,
                mixModeStr: item.mixModeStr,
                ...(item.compositeObj ? { compositeObj: item.compositeObj } : {}),
            };
        });
    }

    getLayerIndex(canvasObj: HTMLCanvasElement, doReturnNull?: boolean): null | number {
        for (let i = 0; i < this.layers.length; i++) {
            if (this.layers[i].canvas === canvasObj) {
                return i;
            }
        }
        if (!doReturnNull) {
            throw new Error('layer not found (in ' + this.layers.length + ' layers)');
        }
        return null;
    }

    getLayerOld(index: number, doReturnNull?: boolean): null | TLayerFromKlCanvas {
        if (this.layers[index]) {
            return {
                context: this.layers[index].context,
                isVisible: this.layers[index].isVisible,
                opacity: this.layers[index].opacity,
                name: this.layers[index].name,
                id: index,
            };
        }
        if (!doReturnNull) {
            throw new Error(
                'layer of index ' + index + ' not found (in ' + this.layers.length + ' layers)',
            );
        }
        return null;
    }

    getLayer(index: number): TKlCanvasLayer {
        return this.layers[index];
    }

    getColorAt(x: number, y: number): IRGB {
        return this.eyedropper.getColorAt(x, y, this.layers);
    }

    getCompleteCanvas(factor: number): HTMLCanvasElement {
        return drawProject(this.getProject(), factor);
    }

    getProject(): IKlProject {
        return {
            width: this.width,
            height: this.height,
            layers: this.layers.map((layer) => {
                return {
                    name: layer.name,
                    isVisible: layer.isVisible,
                    opacity: layer.opacity,
                    mixModeStr: layer.mixModeStr,
                    image: layer.canvas,
                };
            }),
        };
    }

    setMixMode(layerIndex: number, mixModeStr: TMixMode): void {
        const targetLayer = this.layers[layerIndex];
        targetLayer.mixModeStr = mixModeStr;

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['mixModeStr'],
                }),
            });
        }
    }

    /**
     * Set composite drawing step for KlCanvasWorkspace.
     * To apply temporary manipulations to a layer.
     *
     * @param layerIndex
     * @param compositeObj
     */
    setComposite(layerIndex: number, compositeObj: undefined | TLayerComposite): void {
        if (!this.layers[layerIndex]) {
            throw new Error('invalid layer');
        }
        this.layers[layerIndex].compositeObj = compositeObj;
    }

    setSelection(selection?: MultiPolygon): void {
        if (!this.selection && !selection) {
            return;
        }

        this.selection = selection;

        this.klHistory.push({
            selection: {
                value: selection,
            },
        });
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
        this.klHistory.pause(true);
        this.createSelectionSample(p.sourceLayer);
        const srcBounds = getSelectionSampleBounds(this.selectionSample!);
        this.eraseLayer({
            layerIndex: p.sourceLayer,
            useSelection: true,
            useAlphaLock: p.sourceLayer === 0 && !p.backgroundIsTransparent,
        });
        this.transformSelectionAndSample(p.transformation);
        const targetBounds = getSelectionSampleBounds(this.selectionSample!);
        this.drawSelectionSample(p.targetLayer ?? p.sourceLayer, p.isPixelated ?? false);
        this.klHistory.pause(false);

        const srcAndTargetEqual = !p.targetLayer || p.sourceLayer === p.targetLayer;

        // if (srcBounds) {
        //     const layerCtx = this.layers[p.sourceLayer].context;
        //     layerCtx.save();
        //     layerCtx.fillStyle = 'rgba(255,0,0,0.2)';
        //     layerCtx.fillRect(
        //         srcBounds.x1,
        //         srcBounds.y1,
        //         srcBounds.x2 - srcBounds.x1,
        //         srcBounds.y2 - srcBounds.y1,
        //     );
        //     layerCtx.restore();
        // }

        // if (targetBounds) {
        //     const layerCtx = this.layers[p.targetLayer ?? p.sourceLayer].context;
        //     layerCtx.save();
        //     layerCtx.fillStyle = 'rgba(0,0,255,0.2)';
        //     layerCtx.fillRect(
        //         targetBounds.x1,
        //         targetBounds.y1,
        //         targetBounds.x2 - targetBounds.x1,
        //         targetBounds.y2 - targetBounds.y1,
        //     );
        //     layerCtx.restore();
        // }

        if (!this.klHistory.isPaused()) {
            const srcLayer = this.layers[p.sourceLayer];
            const targetLayer =
                p.targetLayer !== undefined && p.targetLayer !== p.sourceLayer
                    ? this.layers[p.targetLayer]
                    : undefined;
            this.klHistory.push({
                selection: {
                    value: this.selection,
                },
                layerMap: createLayerMap(
                    this.layers,
                    {
                        layerId: srcLayer.id,
                        attributes: ['tiles'],
                        bounds: srcAndTargetEqual
                            ? BB.updateBounds(srcBounds, targetBounds)
                            : srcBounds,
                    },
                    targetLayer
                        ? {
                              layerId: targetLayer.id,
                              attributes: ['tiles'],
                              bounds: targetBounds,
                          }
                        : undefined,
                ),
            });
        }
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
        this.klHistory.pause(true);
        if (!this.selectionSample) {
            if (p.sourceLayer === undefined) {
                throw new Error('no source layer');
            }
            this.createSelectionSample(p.sourceLayer);
        }
        this.transformSelectionAndSample(p.transformation);
        this.drawSelectionSample(p.targetLayer, p.isPixelated ?? false);
        const targetBounds = getSelectionSampleBounds(this.selectionSample!);
        this.klHistory.pause(false);

        // if (targetBounds) {
        //     const layerCtx = this.layers[p.targetLayer ?? p.sourceLayer].context;
        //     layerCtx.save();
        //     layerCtx.fillStyle = 'rgba(0,0,255,0.2)';
        //     layerCtx.fillRect(
        //         targetBounds.x1,
        //         targetBounds.y1,
        //         targetBounds.x2 - targetBounds.x1,
        //         targetBounds.y2 - targetBounds.y1,
        //     );
        //     layerCtx.restore();
        // }

        if (!this.klHistory.isPaused() && targetBounds) {
            const targetLayer = this.layers[p.targetLayer];
            this.klHistory.push({
                selection: {
                    value: this.selection,
                },
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                    bounds: targetBounds,
                }),
            });
        }
    }

    // todo remove - requires rewrite of transform via selection, though
    clearSelectionSample(): void {
        if (!this.selectionSample) {
            return;
        }
        this.selectionSample.image && BB.freeCanvas(this.selectionSample.image);
        this.selectionSample = undefined;
    }

    getSelectionArea(layerIndex: number): IRect | undefined {
        const srcLayer = this.layers[layerIndex];

        const selection = this.getSelectionOrFallback();
        const selectionBounds = getMultiPolyBounds(selection);
        // integer bounds that are within the canvas
        const canvasSelectionBounds = intBoundsWithinArea(selectionBounds, this.width, this.height);

        // selection area outside of canvas
        if (!canvasSelectionBounds) {
            return undefined;
        }

        // bounds of where pixels are non-transparent
        return canvasBounds(srcLayer.context, canvasSelectionBounds);
    }

    getSelectionSample(): TSelectionSample | undefined {
        return this.selectionSample;
    }

    /**
     * called after undo/redo, to apply the changes to the klCanvas.
     * before - before undo/redo was called - equivalent to current state of klCanvas.
     * after - after undo/redo was called.
     */
    updateViaComposed(before: THistoryEntryDataComposed, after: THistoryEntryDataComposed): void {
        this.width = after.size.width;
        this.height = after.size.height;
        this.selection = after.selection.value;
        this.layers = updateLayersViaComposed(this.layers, before, after);
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.layers.forEach((layer) => {
            BB.freeCanvas(layer.canvas);
            layer.canvas = {} as HTMLCanvasElement;
            layer.context = {} as CanvasRenderingContext2D;
        });
        this.layers = [];
        this.isDestroyed = true;
    }
}
