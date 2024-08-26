import { KL } from '../kl';
import { IHistoryBroadcast, IHistoryEntry, KlHistory } from './kl-history';
import { IFilter, IFilterApply, TOldestProjectState } from '../kl-types';
import { KlCanvas, KlCanvasContext } from '../canvas/kl-canvas';
import { throwIfNull } from '../../bb/base/base';
import { TBrush } from '../brushes/brushes';
import { KlTempHistory } from './kl-temp-history';

function execHistoryEntry(
    historyEntry: IHistoryEntry,
    layerIndex: number,
    klCanvas: KlCanvas,
    brushes: TBrush[],
    setCurrentLayerCtx: (ctx: CanvasRenderingContext2D) => void,
    getCurrentLayerCtx: () => CanvasRenderingContext2D,
): number {
    if (historyEntry.tool[0] === 'brush') {
        const b = brushes[historyEntry.tool[1] as any];
        historyEntry.actions!.forEach((action) => {
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
        const p = [
            {
                context: getCurrentLayerCtx(),
                klCanvas,
                input: historyEntry.params![0].input,
            } as IFilterApply,
        ];
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

export type TKlHistoryExecutorParams = {
    history: KlHistory;
    tempHistory: KlTempHistory;
    brushUiMap: any; // todo
    getOldestProjectState: () => TOldestProjectState;
    klCanvas: KlCanvas;
    getCurrentLayerCtx: () => CanvasRenderingContext2D;
    setCurrentLayerCtx: (ctx: CanvasRenderingContext2D) => void;
    onExecuted: (
        dimensionChanged: boolean,
        type: 'undo' | 'redo' | 'tempUndo' | 'tempRedo',
    ) => void;
    onCanUndoRedoChange: (canUndo: boolean, canRedo: boolean) => void;
};

export class KlHistoryExecutor {
    // from params
    private readonly history: KlHistory;
    private readonly tempHistory: KlTempHistory;
    private readonly brushUiMap: any; // todo
    private readonly getOldestProjectState: () => TOldestProjectState;
    private readonly klCanvas: KlCanvas;
    private readonly getCurrentLayerCtx: () => CanvasRenderingContext2D;
    private readonly setCurrentLayerCtx: (ctx: CanvasRenderingContext2D) => void;
    private readonly onExecuted: (
        dimensionChanged: boolean,
        type: 'undo' | 'redo' | 'tempUndo' | 'tempRedo',
    ) => void;
    private readonly onCanUndoRedoChange: (canUndo: boolean, canRedo: boolean) => void;

    private doIgnore = false;
    private lastCanUndo = false;
    private lastCanRedo = false;

    /**
     * Prevent multiple undo / redo getting triggered at once if UI is frozen.
     * true -> ignore, don't undo / redo
     */
    private shouldIgnoreTest(): boolean {
        if (this.doIgnore) {
            return true;
        }
        this.doIgnore = true;
        setTimeout(() => {
            this.doIgnore = false;
        }, 0);
        return false;
    }

    private emitOnUndoRedoChange(): void {
        const canUndo = this.canUndo();
        const canRedo = this.canRedo();
        if (this.lastCanUndo === canUndo && this.lastCanRedo === canRedo) {
            return;
        }
        this.lastCanUndo = canUndo;
        this.lastCanRedo = canRedo;
        this.onCanUndoRedoChange(canUndo, canRedo);
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TKlHistoryExecutorParams) {
        this.history = p.history;
        this.tempHistory = p.tempHistory;
        this.brushUiMap = p.brushUiMap;
        this.getOldestProjectState = p.getOldestProjectState;
        this.klCanvas = p.klCanvas;
        this.getCurrentLayerCtx = p.getCurrentLayerCtx;
        this.setCurrentLayerCtx = p.setCurrentLayerCtx;
        this.onExecuted = p.onExecuted;
        this.onCanUndoRedoChange = p.onCanUndoRedoChange;

        this.history.addListener((p) => {
            this.updateOldestAppState(p);
            this.emitOnUndoRedoChange();
        });
        this.tempHistory.addListener(() => {
            this.emitOnUndoRedoChange();
        });
    }

    undo(): boolean {
        if (this.shouldIgnoreTest()) {
            return false;
        }
        if (this.tempHistory.getIsActive() && this.tempHistory.canDecreaseIndex()) {
            this.tempHistory.decreaseIndex();
            this.onExecuted(false, 'tempUndo');
            this.emitOnUndoRedoChange();
            return true;
        }
        if (!this.history.canUndo()) {
            return false;
        }
        const entries: IHistoryEntry[] = this.history.decreaseCurrentIndex();

        this.history.pause(true);
        const oldestProjectState: TOldestProjectState = this.getOldestProjectState();
        const oldSize = { w: this.klCanvas.getWidth(), h: this.klCanvas.getHeight() };
        this.klCanvas.copy(oldestProjectState.canvas);
        let layerIndex = oldestProjectState.focus;
        this.setCurrentLayerCtx(throwIfNull(this.klCanvas.getLayerContext(layerIndex)));
        const brushes: any = {};
        Object.entries(KL.brushes).forEach(([b, brush]) => {
            brushes[b] = new brush();
            brushes[b].setContext(this.getCurrentLayerCtx());
        });
        brushes.SketchyBrush.setSeed(oldestProjectState.brushes.SketchyBrush.getSeed());
        entries.forEach((entry) => {
            layerIndex = execHistoryEntry(
                entry,
                layerIndex,
                this.klCanvas,
                brushes,
                (ctx) => this.setCurrentLayerCtx(ctx),
                () => this.getCurrentLayerCtx(),
            );
        });
        this.brushUiMap.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.history.pause(false);
        this.onExecuted(
            oldSize.w !== this.klCanvas.getWidth() || oldSize.h !== this.klCanvas.getHeight(),
            'undo',
        );

        return true;
    }

    redo(): boolean {
        if (this.shouldIgnoreTest()) {
            return false;
        }
        if (this.tempHistory.getIsActive() && this.tempHistory.canIncreaseIndex()) {
            this.tempHistory.increaseIndex();
            this.emitOnUndoRedoChange();
            this.onExecuted(false, 'tempRedo');
            return true;
        }
        if (!this.history.canRedo()) {
            return false;
        }
        const entries = this.history.increaseCurrentIndex();
        if (entries.length === 0) {
            setTimeout(() => {
                throw new Error('redo failed. redo entry undefined');
            });
            return false;
        }
        this.history.pause(true);
        const oldSize = { w: this.klCanvas.getWidth(), h: this.klCanvas.getHeight() };
        const brushes: any = {};
        Object.entries(KL.brushes).forEach(([b, brush]) => {
            brushes[b] = new brush();
            brushes[b].setContext(this.getCurrentLayerCtx());
        });
        brushes.SketchyBrush.setSeed(this.brushUiMap.sketchyBrush.getSeed());
        entries.forEach((entry) => {
            execHistoryEntry(
                entry,
                0, // doesn't matter, because result not used
                this.klCanvas,
                brushes,
                (ctx) => this.setCurrentLayerCtx(ctx),
                () => this.getCurrentLayerCtx(),
            );
        });
        this.brushUiMap.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.history.pause(false);
        this.onExecuted(
            oldSize.w !== this.klCanvas.getWidth() || oldSize.h !== this.klCanvas.getHeight(),
            'redo',
        );

        return true;
    }

    updateOldestAppState(broadcastMsg: IHistoryBroadcast | null): void {
        // const start = performance.now();
        // play catch up (the version that is a few steps behind)

        if (!broadcastMsg || !broadcastMsg.bufferUpdate) {
            return;
        }

        const oldestProjectState: TOldestProjectState = this.getOldestProjectState();
        let localCurrentLayerCtx = throwIfNull(
            oldestProjectState.canvas.getLayerContext(oldestProjectState.focus),
        );

        oldestProjectState.focus = execHistoryEntry(
            broadcastMsg.bufferUpdate,
            oldestProjectState.focus,
            oldestProjectState.canvas,
            oldestProjectState.brushes,
            (ctx) => {
                localCurrentLayerCtx = ctx;
            },
            () => localCurrentLayerCtx,
        );

        // console.log('catchup', performance.now() - start);
    }

    canUndo(): boolean {
        return (
            (this.tempHistory.getIsActive() && this.tempHistory.canDecreaseIndex()) ||
            this.history.canUndo()
        );
    }

    canRedo(): boolean {
        if (this.tempHistory.getIsActive()) {
            return this.tempHistory.canIncreaseIndex();
        }
        return this.history.canRedo();
    }
}
