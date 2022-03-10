import {KL} from '../kl';
import {IHistoryBroadcast, IHistoryEntry, klHistory} from './kl-history';
import {KlCanvasWorkspace} from '../canvas-ui/kl-canvas-workspace';
import {IFilterApply, IInitState} from '../kl.types';
import {KlCanvas} from '../canvas/kl-canvas';

export class UndoRedoCatchup {

    private doIgnore = false;

    /**
     * Prevent multiple undo / redo getting triggered at once.
     * Might be confusing if main thread is choking.
     */
    private ignoreTest (): boolean {
        if (this.doIgnore) {
            return false;
        }
        this.doIgnore = true;
        setTimeout(() => {
            this.doIgnore = false;
        }, 0);
        return true;
    }

    // ---- public ----

    constructor (
        private brushUiObj,
        private layerPreview,
        private layerManager,
        private handUi,
        private klCanvasWorkspace: KlCanvasWorkspace,
        private getInitState: () => IInitState,
        private getKlCanvas: () => KlCanvas,
        private getCurrentLayerCtx,
        private setCurrentLayerCtx,
        private getCurrentBrush,
    ) { }

    undo (): boolean {
        if (!this.ignoreTest()) {
            return false;
        }

        if (!klHistory.canUndo()) { // || workspace.isPainting()) {
            return false;
        }
        const actions: IHistoryEntry[] = klHistory.undo();
        klHistory.pause(true);
        const initState: IInitState = this.getInitState();
        const oldSize = {w: this.getKlCanvas().getWidth(), h: this.getKlCanvas().getHeight()};
        this.getKlCanvas().copy(initState.canvas);
        let layerIndex = initState.focus;
        this.setCurrentLayerCtx(this.getKlCanvas().getLayerContext(layerIndex));
        const brushes: any = {};
        for (let b in KL.brushes) {
            if (KL.brushes.hasOwnProperty(b)) {
                brushes[b] = new KL.brushes[b]();
                brushes[b].setContext(this.getCurrentLayerCtx());
            }
        }
        brushes.SketchyBrush.setSeed(initState.brushes.SketchyBrush.getSeed());
        for (let i = 0; i < actions.length; i++) {
            ((i) => {
                if (actions[i].tool[0] === "brush") {
                    const b = brushes[actions[i].tool[1]];
                    if (actions[i].actions) {
                        for (let e = 0; e < actions[i].actions.length; e++) {
                            const p = actions[i].actions[e].params;
                            b[actions[i].actions[e].action].apply(b, p);
                        }
                    } else {
                        const p = actions[i].params;
                        b[actions[i].action].apply(b, p);
                    }
                } else if (actions[i].tool[0] === "canvas") {
                    const p = actions[i].params;
                    const id = this.getKlCanvas()[actions[i].action].apply(this.getKlCanvas(), p);
                    if (typeof id === 'number') {
                        layerIndex = id;
                        this.setCurrentLayerCtx(this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(this.getCurrentLayerCtx());
                            }
                        }
                    }
                } else if (actions[i].tool[0] === "filter") {
                    const p = [{
                        context: this.getCurrentLayerCtx(),
                        canvas: this.getKlCanvas(),
                        input: actions[i].params[0].input,
                        history: new KL.DecoyKlHistory(),
                    } as IFilterApply];
                    KL.filterLib[actions[i].tool[1]][actions[i].action].apply(null, p);

                } else if (actions[i].tool[0] === "misc" && actions[i].action === "focusLayer") {
                    layerIndex = actions[i].params[0];
                    this.setCurrentLayerCtx(this.getKlCanvas().getLayerContext(actions[i].params[0]));
                    for (let b in brushes) {
                        if (brushes.hasOwnProperty(b)) {
                            brushes[b].setContext(this.getCurrentLayerCtx());
                        }
                    }
                } else if (actions[i].tool[0] === "misc" && actions[i].action === "importImage") {
                    const id = this.getKlCanvas().addLayer();
                    if (typeof id === 'number') {
                        layerIndex = id;
                        if (actions[i].params[1]) {
                            this.getKlCanvas().renameLayer(layerIndex, actions[i].params[1]);
                        }
                        this.setCurrentLayerCtx(this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(this.getCurrentLayerCtx());
                            }
                        }
                    }
                    this.getCurrentLayerCtx().drawImage(actions[i].params[0], 0, 0);
                }
            })(i);
        }
        if (oldSize.w !== this.getKlCanvas().getWidth() || oldSize.h !== this.getKlCanvas().getHeight()) {
            this.klCanvasWorkspace.resetView();
            this.handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
        }
        this.layerManager.update(layerIndex);
        this.layerPreview.setLayer(this.getKlCanvas().getLayer(layerIndex));
        this.brushUiObj.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.getCurrentBrush().setContext(this.getCurrentLayerCtx());
        this.klCanvasWorkspace.setLastDrawEvent(null);

        klHistory.pause(false);
        return true;
    }

    redo (): boolean {
        if (!this.ignoreTest()) {
            return false;
        }

        if (!klHistory.canRedo()) {
            return false;
        }
        const actions = klHistory.redo();
        klHistory.pause(true);
        const oldSize = {w: this.getKlCanvas().getWidth(), h: this.getKlCanvas().getHeight()};
        let layerIndex;
        const brushes: any = {};
        for (let b in KL.brushes) {
            if (KL.brushes.hasOwnProperty(b)) {
                brushes[b] = new KL.brushes[b]();
                brushes[b].setContext(this.getCurrentLayerCtx());
            }
        }
        brushes.SketchyBrush.setSeed(this.brushUiObj.sketchyBrush.getSeed());
        for (let i = 0; i < actions.length; i++) {
            ((i) => {
                if (actions[i].tool[0] === "brush") {
                    const b = brushes[actions[i].tool[1]];
                    if (actions[i].actions) {
                        for (let e = 0; e < actions[i].actions.length; e++) {
                            const p = actions[i].actions[e].params;
                            b[actions[i].actions[e].action].apply(b, p);
                        }
                    } else {
                        const p = actions[i].params;
                        b[actions[i].action].apply(b, p);
                    }
                } else if (actions[i].tool[0] === "canvas") {
                    const p = actions[i].params;
                    const id = this.getKlCanvas()[actions[i].action].apply(this.getKlCanvas(), p);
                    if (typeof id === 'number') {
                        layerIndex = id;
                        this.setCurrentLayerCtx(this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(this.getCurrentLayerCtx());
                            }
                        }
                    }
                } else if (actions[i].tool[0] === "filter") {
                    const p = [{
                        context: this.getCurrentLayerCtx(),
                        canvas: this.getKlCanvas(),
                        input: actions[i].params[0].input,
                        history: new KL.DecoyKlHistory(),
                    } as IFilterApply];
                    KL.filterLib[actions[i].tool[1]][actions[i].action].apply(null, p);

                } else if (actions[i].tool[0] === "misc" && actions[i].action === "focusLayer") {
                    layerIndex = actions[i].params[0];
                    this.setCurrentLayerCtx(this.getKlCanvas().getLayerContext(actions[i].params[0]));
                    for (let b in brushes) {
                        if (brushes.hasOwnProperty(b)) {
                            brushes[b].setContext(this.getCurrentLayerCtx());
                        }
                    }
                } else if (actions[i].tool[0] === "misc" && actions[i].action === "importImage") {
                    const id = this.getKlCanvas().addLayer();
                    if (typeof id === 'number') {
                        layerIndex = id;
                        if (actions[i].params[1]) {
                            this.getKlCanvas().renameLayer(layerIndex, actions[i].params[1]);
                        }
                        this.setCurrentLayerCtx(this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(this.getCurrentLayerCtx());
                            }
                        }
                    }
                    this.getCurrentLayerCtx().drawImage(actions[i].params[0], 0, 0);
                }
            })(i);
        }

        if (oldSize.w !== this.getKlCanvas().getWidth() || oldSize.h !== this.getKlCanvas().getHeight()) {
            this.klCanvasWorkspace.resetView();
            this.handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
        }
        const currentLayerIndex = this.getKlCanvas().getLayerIndex(this.getCurrentLayerCtx().canvas);
        this.layerManager.update(currentLayerIndex);
        this.layerPreview.setLayer(this.getKlCanvas().getLayer(currentLayerIndex));
        this.brushUiObj.sketchyBrush.setSeed(brushes.SketchyBrush.getSeed());
        this.getCurrentBrush().setContext(this.getCurrentLayerCtx());
        this.klCanvasWorkspace.setLastDrawEvent(null);
        klHistory.pause(false);

        return true;
    }

    catchup (logParam: IHistoryBroadcast | null): void {
        // const start = performance.now();
        //play catch up (the version that is a few steps behind)
        if (logParam && logParam.bufferUpdate) {
            const initState: IInitState = this.getInitState();

            const brushes = initState.brushes;
            const actions = [logParam.bufferUpdate];
            let localCurrentLayerCtx = initState.canvas.getLayerContext(initState.focus);
            const canvas = initState.canvas;
            let layerIndex = initState.focus;
            ((i) => {
                if (actions[i].tool[0] === "brush") {
                    let b = brushes[actions[i].tool[1]];
                    if (actions[i].actions) {
                        for (let e = 0; e < actions[i].actions.length; e++) {
                            const p = actions[i].actions[e].params;
                            b[actions[i].actions[e].action].apply(b, p);
                        }
                    } else {
                        const p = actions[i].params;
                        b[actions[i].action].apply(b, p);
                    }
                } else if (actions[i].tool[0] === "canvas") {
                    const p = actions[i].params;
                    const id = canvas[actions[i].action].apply(canvas, p);
                    if (typeof id === 'number') {
                        layerIndex = id;
                        localCurrentLayerCtx = canvas.getLayerContext(layerIndex);
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(localCurrentLayerCtx);
                            }
                        }
                    }
                } else if (actions[i].tool[0] === "filter") {
                    const p = [{
                        context: localCurrentLayerCtx,
                        canvas: canvas,
                        input: actions[i].params[0].input,
                        history: new KL.DecoyKlHistory(),
                    } as IFilterApply];
                    KL.filterLib[actions[i].tool[1]][actions[i].action].apply(null, p);

                } else if (actions[i].tool[0] === "misc" && actions[i].action === "focusLayer") {
                    layerIndex = actions[i].params[0];
                    localCurrentLayerCtx = canvas.getLayerContext(actions[i].params[0]);
                    for (let b in brushes) {
                        if (brushes.hasOwnProperty(b)) {
                            brushes[b].setContext(localCurrentLayerCtx);
                        }
                    }
                } else if (actions[i].tool[0] === "misc" && actions[i].action === "importImage") {
                    const id = canvas.addLayer();
                    if (typeof id === 'number') {
                        layerIndex = id;
                        if (actions[i].params[1]) {
                            this.getKlCanvas().renameLayer(layerIndex, actions[i].params[1]);
                        }
                        localCurrentLayerCtx = canvas.getLayerContext(layerIndex);
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(localCurrentLayerCtx);
                            }
                        }
                    }
                    localCurrentLayerCtx.drawImage(actions[i].params[0], 0, 0);
                }
            })(0);
            initState.focus = layerIndex;
        }
        // console.log('catchup', performance.now() - start);
    }


}