import {KL} from '../kl';
import {IHistoryBroadcast, IHistoryEntry, klHistory} from './kl-history';
import {KlCanvasWorkspace} from '../canvas-ui/kl-canvas-workspace';
import {IFilterApply, IInitState} from '../kl-types';
import {KlCanvas} from '../canvas/kl-canvas';
import {LayerManager} from '../ui/tool-tabs/layer-manager/layer-manager';
import {LayerPreview} from '../ui/components/layer-preview';
import {HandUi} from '../ui/tool-tabs/hand-ui';
import {throwIfNull} from '../../bb/base/base';

function execHistoryEntry (
    historyEntry: IHistoryEntry,
    layerIndex: number,
    klCanvas: KlCanvas,
    brushes: any, // todo
    setCurrentLayerCtx: (ctx: CanvasRenderingContext2D) => void,
    getCurrentLayerCtx: () => CanvasRenderingContext2D,
): number {
    if (historyEntry.tool[0] === 'brush') {
        const b = brushes[historyEntry.tool[1]];
        historyEntry.actions.forEach(action => {
            b[action.action].apply(b, action.params);
        });

    } else if (historyEntry.tool[0] === 'canvas') {
        const p = historyEntry.params;
        const id = klCanvas[historyEntry.action].apply(klCanvas, p);
        if (typeof id === 'number') {
            layerIndex = id;
            const ctx = throwIfNull(klCanvas.getLayerContext(layerIndex));
            setCurrentLayerCtx(ctx);
            Object.entries(brushes).forEach(([, brush]) => brush.setContext(ctx));
        }

    } else if (historyEntry.tool[0] === 'filter') {
        const p = [{
            context: getCurrentLayerCtx(),
            klCanvas,
            input: historyEntry.params[0].input,
            history: new KL.DecoyKlHistory(),
        } as IFilterApply];
        KL.filterLib[historyEntry.tool[1]][historyEntry.action].apply(null, p);

    } else if (historyEntry.tool[0] === 'misc' && historyEntry.action === 'focusLayer') {
        layerIndex = historyEntry.params[0];
        const ctx = throwIfNull(klCanvas.getLayerContext(layerIndex));
        setCurrentLayerCtx(ctx);
        Object.entries(brushes).forEach(([, brush]) => brush.setContext(ctx));

    } else if (historyEntry.tool[0] === 'misc' && historyEntry.action === 'importImage') {
        const id = klCanvas.addLayer();
        if (typeof id === 'number') {
            layerIndex = id;
            if (historyEntry.params[1]) {
                klCanvas.renameLayer(layerIndex, historyEntry.params[1]);
            }
            const ctx = throwIfNull(klCanvas.getLayerContext(layerIndex));
            setCurrentLayerCtx(ctx);
            Object.entries(brushes).forEach(([, brush]) => brush.setContext(ctx));
        }
        getCurrentLayerCtx().drawImage(historyEntry.params[0], 0, 0);
    }
    return layerIndex;
}

export class UndoRedoCatchup {

    private doIgnore = false;

    /**
     * Prevent multiple undo / redo getting triggered at once if UI is frozen.
     * true -> ignore, don't undo / redo
     */
    private shouldIgnoreTest (): boolean {
        if (this.doIgnore) {
            return true;
        }
        this.doIgnore = true;
        setTimeout(() => {
            this.doIgnore = false;
        }, 0);
        return false;
    }
    

    // ---- public ----

    constructor (
        private brushUiMap: any, // todo
        private layerPreview: LayerPreview,
        private layerManager: LayerManager,
        private handUi: HandUi,
        private klCanvasWorkspace: KlCanvasWorkspace,
        private getInitState: () => IInitState,
        private getKlCanvas: () => KlCanvas,
        private getCurrentLayerCtx: () => CanvasRenderingContext2D | null,
        private setCurrentLayerCtx: (ctx: CanvasRenderingContext2D) => void,
        private getCurrentBrush: () => any, // todo
    ) { }

    undo (): boolean {
        if (this.shouldIgnoreTest() || !klHistory.canUndo()) {
            return false;
        }
        const entries: IHistoryEntry[] = klHistory.undo();
        const klCanvas = this.getKlCanvas();
        klHistory.pause(true);
        const initState: IInitState = this.getInitState();
        const oldSize = {w: klCanvas.getWidth(), h: klCanvas.getHeight()};
        klCanvas.copy(initState.canvas);
        let layerIndex = initState.focus;
        this.setCurrentLayerCtx(klCanvas.getLayerContext(layerIndex));
        const brushes: any = {};
        for (const b in KL.brushes) {
            if (KL.brushes.hasOwnProperty(b)) {
                brushes[b] = new KL.brushes[b]();
                brushes[b].setContext(this.getCurrentLayerCtx());
            }
        }
        brushes.SketchyBrush.setSeed(initState.brushes.SketchyBrush.getSeed());
        entries.forEach(entry => {
            layerIndex = execHistoryEntry(
                entry,
                layerIndex,
                klCanvas,
                brushes,
                (ctx) => this.setCurrentLayerCtx(ctx),
                () => throwIfNull(this.getCurrentLayerCtx()),
            );
        });
        if (oldSize.w !== klCanvas.getWidth() || oldSize.h !== klCanvas.getHeight()) {
            this.klCanvasWorkspace.resetView();
            this.handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
        }
        this.layerManager.update(layerIndex);
        this.layerPreview.setLayer(klCanvas.getLayer(layerIndex));
        this.brushUiMap.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.getCurrentBrush().setContext(this.getCurrentLayerCtx());
        this.klCanvasWorkspace.setLastDrawEvent(null);

        klHistory.pause(false);
        return true;
    }

    redo (): boolean {
        if (this.shouldIgnoreTest() || !klHistory.canRedo()) {
            return false;
        }
        const entry = klHistory.redo();
        if (!entry) {
            setTimeout(() => {
                throw new Error('redo failed. redo entry undefined');
            });
            return false;
        }
        const klCanvas = this.getKlCanvas();
        klHistory.pause(true);
        const oldSize = {w: klCanvas.getWidth(), h: klCanvas.getHeight()};
        const brushes: any = {};
        for (const b in KL.brushes) {
            if (KL.brushes.hasOwnProperty(b)) {
                brushes[b] = new KL.brushes[b]();
                brushes[b].setContext(this.getCurrentLayerCtx());
            }
        }
        brushes.SketchyBrush.setSeed(this.brushUiMap.sketchyBrush.getSeed());
        execHistoryEntry(
            entry,
            0, // doesn't matter, because result not used
            klCanvas,
            brushes,
            (ctx) => this.setCurrentLayerCtx(ctx),
            () => throwIfNull(this.getCurrentLayerCtx()),
        );

        if (oldSize.w !== klCanvas.getWidth() || oldSize.h !== klCanvas.getHeight()) {
            this.klCanvasWorkspace.resetView();
            this.handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
        }
        const currentLayerIndex = klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas);
        this.layerManager.update(currentLayerIndex);
        this.layerPreview.setLayer(klCanvas.getLayer(currentLayerIndex));
        this.brushUiMap.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.getCurrentBrush().setContext(this.getCurrentLayerCtx());
        this.klCanvasWorkspace.setLastDrawEvent(null);
        klHistory.pause(false);

        return true;
    }

    catchup (logParam: IHistoryBroadcast | null): void {
        // const start = performance.now();
        //play catch up (the version that is a few steps behind)

        if (!logParam || !logParam.bufferUpdate) {
            return;
        }

        const initState: IInitState = this.getInitState();
        let localCurrentLayerCtx = initState.canvas.getLayerContext(initState.focus);

        initState.focus = execHistoryEntry(
            logParam.bufferUpdate,
            initState.focus,
            initState.canvas,
            initState.brushes,
            (ctx) => {
                localCurrentLayerCtx = ctx;
            },
            () => throwIfNull(localCurrentLayerCtx),
        );

        // console.log('catchup', performance.now() - start);
    }


}