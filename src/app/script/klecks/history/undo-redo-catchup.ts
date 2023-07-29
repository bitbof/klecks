import {KL} from '../kl';
import {IHistoryBroadcast, IHistoryEntry, klHistory} from './kl-history';
import {KlCanvasWorkspace} from '../canvas-ui/kl-canvas-workspace';
import {IFilter, IFilterApply, IInitState} from '../kl-types';
import {KlCanvas, KlCanvasContext} from '../canvas/kl-canvas';
import {LayerManager} from '../ui/tool-tabs/layer-manager/layer-manager';
import {LayerPreview} from '../ui/components/layer-preview';
import {HandUi} from '../ui/tool-tabs/hand-ui';
import {throwIfNull} from '../../bb/base/base';
import {TBrush} from '../brushes/brushes';

function execHistoryEntry (
    historyEntry: IHistoryEntry,
    layerIndex: number,
    klCanvas: KlCanvas,
    brushes: TBrush[],
    setCurrentLayerCtx: (ctx: CanvasRenderingContext2D) => void,
    getCurrentLayerCtx: () => CanvasRenderingContext2D,
): number {
    if (historyEntry.tool[0] === 'brush') {
        const b = brushes[historyEntry.tool[1] as any];
        historyEntry.actions!.forEach(action => {
            (b[action.action as keyof TBrush] as any)(...action.params);
        });

    } else if (historyEntry.tool[0] === 'canvas') {
        const p = historyEntry.params!;
        const id = (klCanvas[historyEntry.action as keyof KlCanvas] as any)(...p);
        if (typeof id === 'number') {
            layerIndex = id;
            const ctx = throwIfNull(klCanvas.getLayerContext(layerIndex)) as KlCanvasContext;
            setCurrentLayerCtx(ctx);
            Object.entries(brushes).forEach(([, brush]) => brush.setContext(ctx));
        }

    } else if (historyEntry.tool[0] === 'filter') {
        const p = [{
            context: getCurrentLayerCtx(),
            klCanvas,
            input: historyEntry.params![0].input,
            history: new KL.DecoyKlHistory(),
        } as IFilterApply];
        (KL.filterLib[historyEntry.tool[1]][historyEntry.action! as keyof IFilter] as any)(...p);

    } else if (historyEntry.tool[0] === 'misc' && historyEntry.action === 'focusLayer') {
        layerIndex = historyEntry.params![0];
        const ctx = throwIfNull(klCanvas.getLayerContext(layerIndex)) as KlCanvasContext;
        setCurrentLayerCtx(ctx);
        Object.entries(brushes).forEach(([, brush]) => brush.setContext(ctx));

    } else if (historyEntry.tool[0] === 'misc' && historyEntry.action === 'importImage') {
        const id = klCanvas.addLayer();
        if (typeof id === 'number') {
            layerIndex = id;
            if (historyEntry.params![1]) {
                klCanvas.renameLayer(layerIndex, historyEntry.params![1]);
            }
            const ctx = throwIfNull(klCanvas.getLayerContext(layerIndex)) as KlCanvasContext;
            setCurrentLayerCtx(ctx);
            Object.entries(brushes).forEach(([, brush]) => brush.setContext(ctx));
        }
        getCurrentLayerCtx().drawImage(historyEntry.params![0], 0, 0);
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
        private getCurrentBrush: () => TBrush,
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
        this.setCurrentLayerCtx(throwIfNull(klCanvas.getLayerContext(layerIndex)));
        const brushes: any = {};
        Object.entries(KL.brushes).forEach(([b, brush]) => {
            brushes[b] = new brush();
            brushes[b].setContext(this.getCurrentLayerCtx());
        });
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
            this.klCanvasWorkspace.resetOrFitView();
            this.handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
        }
        this.layerManager.update(layerIndex);
        this.layerPreview.setLayer(throwIfNull(klCanvas.getLayer(layerIndex)));
        this.brushUiMap.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.getCurrentBrush().setContext(this.getCurrentLayerCtx()! as KlCanvasContext);
        this.klCanvasWorkspace.setLastDrawEvent();

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
        Object.entries(KL.brushes).forEach(([b, brush]) => {
            brushes[b] = new brush();
            brushes[b].setContext(this.getCurrentLayerCtx());
        });
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
            this.klCanvasWorkspace.resetOrFitView();
            this.handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
        }
        const currentLayerIndex = throwIfNull(klCanvas.getLayerIndex(this.getCurrentLayerCtx()!.canvas));
        this.layerManager.update(currentLayerIndex);
        this.layerPreview.setLayer(klCanvas.getLayer(currentLayerIndex)!);
        this.brushUiMap.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.getCurrentBrush().setContext(this.getCurrentLayerCtx()! as KlCanvasContext);
        this.klCanvasWorkspace.setLastDrawEvent();
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