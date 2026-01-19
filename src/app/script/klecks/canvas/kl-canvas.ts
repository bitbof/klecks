import { BB } from '../../bb/bb';
import { floodFillBits } from '../image-operations/flood-fill';
import { drawShape } from '../image-operations/shape-tool';
import { renderText, TRenderTextParam } from '../image-operations/render-text';
import {
    isLayerFill,
    TFillSampling,
    TGradient,
    TInterpolationAlgorithm,
    TKlProject,
    TLayerFromKlCanvas,
    TMixMode,
    TRgb,
    TShapeToolObject,
} from '../kl-types';
import { drawProject } from './draw-project';
import { LANG } from '../../language/language';
import { drawGradient } from '../image-operations/gradient-tool';
import { TBounds, TRect } from '../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { compose, identity, Matrix, rotate, scale, translate } from 'transformation-matrix';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { integerBounds } from '../../bb/math/math';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';
import { getEraseColor } from '../brushes/erase-color';
import { HISTORY_TILE_SIZE, KlHistory } from '../history/kl-history';
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
import { createLayerMap } from '../history/push-helpers/create-layer-map';
import { Eyedropper } from './eyedropper';
import { copyImageDataTile } from '../history/image-data-tile';
import { randomUuid } from '../../bb/base/base';
import { getSelectionBounds } from '../select-tool/get-selection-bounds';
import { translateMultiPolygon } from '../../bb/multi-polygon/translate-multi-polygon';
import { getBinaryMask } from '../select-tool/get-binary-mask';

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

export type TLayerComposite = {
    draw: (ctx: CanvasRenderingContext2D) => void;
};

const KL_CANVAS_DEBUGGING = false;

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
    private readonly klHistory: KlHistory;

    private updateIndices(): void {
        this.layers.forEach((item, index) => {
            item.index = index;
        });
    }

    // ----------------------------------- public -----------------------------------

    constructor(
        history: KlHistory,
        private layerNrOffset: number = 0,
    ) {
        this.klHistory = history;
        this.layers = [];
        if (KL_CANVAS_DEBUGGING) {
            (window as any).getCanvasLayers = () => this.layers;
        }
        this.eyedropper = new Eyedropper();
        this.width = 0;
        this.height = 0;
        this.updateViaComposed(
            {
                projectId: { value: randomUuid() },
                size: { width: 0, height: 0 },
                activeLayerId: '',
                selection: { value: [] },
                layerMap: {},
            },
            this.klHistory.getComposed(),
        );
    }

    getSelectionOrFallback(): MultiPolygon {
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

    /*
     * Resets canvas -> 1 layer, 100% opacity,
     * unless layers provided.
     * @param p
     */
    reset(p: {
        projectId?: string; // uuid
        width: number;
        height: number;
        color?: TRgb; // optional - fill color
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
                projectId: {
                    value: p.projectId ?? randomUuid(),
                },
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
    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    getLayerCount(): number {
        return this.layers.length;
    }

    resize(w: number, h: number, algorithm: TInterpolationAlgorithm = 'smooth'): boolean {
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

        if (this.selection) {
            this.selection = transformMultiPolygon(
                this.selection,
                scale(w / this.width, h / this.height),
            );
        }
        this.width = w;
        this.height = h;

        this.klHistory.push({
            size: {
                width: this.width,
                height: this.height,
            },
            layerMap: createLayerMap(this.layers, { attributes: ['tiles'] }),
            ...(this.selection ? { selection: { value: this.selection } } : {}),
        });

        return true;
    }

    /**
     * crop / extend
     */
    resizeCanvas(p: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        fillColor?: TRgb;
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

        if (this.selection) {
            this.selection = translateMultiPolygon(this.selection, offX, offY);
        }
        this.klHistory.push({
            size: {
                width: this.width,
                height: this.height,
            },
            layerMap: createLayerMap(this.layers, { attributes: ['tiles'] }),
            ...(this.selection ? { selection: { value: this.selection } } : {}),
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
        const newIndex = srcIndex + 1;

        const composed = this.klHistory.getComposed();
        const srcComposed = composed.layerMap[srcLayer.id];

        const canvas = BB.canvas(this.width, this.height);
        const ctx = BB.ctx(canvas);
        const layerId = getNextLayerId();
        const newLayer: TKlCanvasLayer = {
            id: layerId,
            index: newIndex,
            name: srcLayer.name + ' ' + LANG('layers-copy'),
            mixModeStr: srcLayer.mixModeStr,
            isVisible: srcLayer.isVisible,
            opacity: srcLayer.opacity,
            canvas,
            context: ctx,
        };

        this.layers.splice(newIndex, 0, newLayer);

        {
            // draw into new layer from old
            const tilesPerX = Math.ceil(this.width / HISTORY_TILE_SIZE);
            srcComposed.tiles.forEach((tile, index) => {
                const x = index % tilesPerX;
                const y = Math.floor(index / tilesPerX);
                ctx.save();
                if (isLayerFill(tile)) {
                    ctx.fillStyle = tile.fill;
                    ctx.fillRect(
                        x * HISTORY_TILE_SIZE,
                        y * HISTORY_TILE_SIZE,
                        HISTORY_TILE_SIZE,
                        HISTORY_TILE_SIZE,
                    );
                } else {
                    ctx.putImageData(tile.data, x * HISTORY_TILE_SIZE, y * HISTORY_TILE_SIZE);
                }
                ctx.restore();
            });
        }

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
                        tiles: srcComposed.tiles.map((tile) => {
                            if (isLayerFill(tile)) {
                                return { ...tile };
                            }
                            return copyImageDataTile(tile);
                        }),
                    },
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
        mixModeStr?: TMixMode | 'as-alpha',
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
        if (mixModeStr === undefined) {
            mixModeStr = topLayer.mixModeStr;
        }

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

    // rotates the canvas with all layers. either by 90, 180, or 270 degrees
    rotate(deg: number): void {
        while (deg < 0) {
            deg += 360;
        }
        deg %= 360;
        if (deg !== 90 && deg !== 180 && deg !== 270) {
            return;
        }
        const temp = BB.canvas();
        if (deg === 180) {
            temp.width = this.width;
            temp.height = this.height;
        } else if (deg === 90 || deg === 270) {
            temp.width = this.height;
            temp.height = this.width;
        }
        let matrix: Matrix = identity();
        if (deg === 90) {
            matrix = compose(translate(this.height, 0), rotate(Math.PI / 2));
        } else if (deg === 180) {
            matrix = compose(translate(this.width, this.height), rotate(Math.PI));
        } else if (deg === 270) {
            matrix = compose(translate(0, this.width), rotate((3 * Math.PI) / 2));
        }
        const ctx = BB.ctx(temp);
        for (let i = 0; i < this.layers.length; i++) {
            ctx.clearRect(0, 0, temp.width, temp.height);
            ctx.save();
            ctx.setTransform(...matrixToTuple(matrix));
            ctx.drawImage(this.layers[i].canvas, 0, 0);
            ctx.restore();
            this.layers[i].canvas.width = temp.width;
            this.layers[i].canvas.height = temp.height;
            this.layers[i].context.drawImage(temp, 0, 0);
        }
        this.width = temp.width;
        this.height = temp.height;

        if (this.selection) {
            this.selection = transformMultiPolygon(this.selection, matrix);
        }

        this.klHistory.push({
            size: {
                width: this.width,
                height: this.height,
            },
            layerMap: createLayerMap(this.layers, { attributes: ['tiles'] }),
            ...(this.selection ? { selection: { value: this.selection } } : {}),
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

        const matrix = compose(
            translate(temp.width / 2, temp.height / 2),
            scale(isHorizontal ? -1 : 1, isVertical ? -1 : 1),
            translate(-temp.width / 2, -temp.height / 2),
        );

        for (let i = 0; i < this.layers.length; i++) {
            if ((layerIndex || layerIndex === 0) && i !== layerIndex) {
                continue;
            }

            tempCtx.save();
            tempCtx.clearRect(0, 0, temp.width, temp.height);
            tempCtx.setTransform(...matrixToTuple(matrix));
            tempCtx.drawImage(this.layers[i].canvas, 0, 0);
            tempCtx.restore();

            this.layers[i].context.clearRect(
                0,
                0,
                this.layers[i].canvas.width,
                this.layers[i].canvas.height,
            );
            this.layers[i].context.drawImage(temp, 0, 0);
        }

        if (this.selection) {
            this.selection = transformMultiPolygon(this.selection, matrix);
        }

        const targetLayer = layerIndex === undefined ? undefined : this.layers[layerIndex];
        this.klHistory.push({
            layerMap: createLayerMap(
                this.layers,
                targetLayer
                    ? { layerId: targetLayer.id, attributes: ['tiles'] }
                    : { attributes: ['tiles'] },
            ),
            ...(this.selection ? { selection: { value: this.selection } } : {}),
        });
    }

    // arbitrary drawing operation & focus layer
    drawOperation(layerIndex: number, operation: (ctx: CanvasRenderingContext2D) => void): void {
        const targetLayer = this.layers[layerIndex];
        const ctx = targetLayer.context;
        operation(ctx);

        if (!this.klHistory.isPaused()) {
            this.klHistory.push({
                activeLayerId: targetLayer.id,
                layerMap: createLayerMap(this.layers, {
                    layerId: targetLayer.id,
                    attributes: ['tiles'],
                }),
            });
        }
    }

    layerFill(
        layerIndex: number,
        colorObj: TRgb,
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

        let bounds: TBounds | undefined;
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
        rgb: TRgb | null, // fill color, if null -> erase
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
        x = Math.round(x);
        y = Math.round(y);

        if (!['above', 'current', 'all'].includes(sampleStr)) {
            throw new Error('invalid sampleStr');
        }
        const selectionMask = this.selection
            ? getBinaryMask(this.selection, this.width, this.height)
            : undefined;
        if (selectionMask && selectionMask[y * this.width + x] === 0) {
            // don't fill if outside of selection
            return;
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
                selectionMask,
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
                selectionMask,
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
    drawShape(layerIndex: number, shapeObj: TShapeToolObject): void {
        if (shapeObj.x1 === shapeObj.x2 && shapeObj.y1 === shapeObj.y2) {
            return;
        }
        const targetLayer = this.layers[layerIndex];
        const selectionPath = this.selection
            ? new Path2D(getSelectionPath2d(this.selection))
            : undefined;
        const bounds = integerBounds(drawShape(targetLayer.context, shapeObj, selectionPath));

        // debug
        /*const ctx = this.layers[layerIndex].context;
        ctx.save();
        ctx.fillStyle = 'rgba(255,0,0,0.2)';
        ctx.fillRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
        ctx.restore();*/

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

    drawGradient(layerIndex: number, gradientObj: TGradient): void {
        const targetLayer = this.layers[layerIndex];
        const selectionPath = this.selection
            ? new Path2D(getSelectionPath2d(this.selection))
            : undefined;
        drawGradient(targetLayer.context, gradientObj, selectionPath);
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
        const rect = renderText(
            targetLayer.canvas,
            BB.copyObj(p),
            this.selection ? new Path2D(getSelectionPath2d(this.selection)) : undefined,
        );

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
        let bounds: TBounds | undefined;
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

    getKlHistory(): KlHistory {
        return this.klHistory;
    }

    getLayersRaw(): TKlCanvasLayer[] {
        return this.layers;
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

    getColorAt(x: number, y: number): TRgb {
        return this.eyedropper.getColorAt(x, y, this.klHistory.getComposed());
    }

    getCompleteCanvas(factor: number, maskSelection?: boolean): HTMLCanvasElement {
        return drawProject(this.getProject(), factor, maskSelection ? this.selection : undefined);
    }

    getProject(): TKlProject {
        return {
            projectId: this.klHistory.getComposed().projectId.value,
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

    getSelectionArea(layerIndex: number): TRect | undefined {
        const srcLayer = this.layers[layerIndex];
        const selection = this.getSelectionOrFallback();
        return getSelectionBounds(selection, srcLayer.context);
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
