import {KL} from '../kl';
import {klHistory} from './kl-history';

export class UndoRedoCatchup {

    private doIgnore = false;

    constructor(
        private brushUiObj,
        private layerPreview,
        private layerManager,
        private handUi,
        private klCanvasWorkspace,
        private getInitState,
        private getKlCanvas,
        private getCurrentLayerCtx,
        private setCurrentLayerCtx,
        private getCurrentBrush,
    ) { }

    /**
     * Prevent multiple undo / redo getting triggered at once.
     * Might be confusing if main thread is choking.
     */
    ignoreTest() {
        if (this.doIgnore) {
            return false;
        }
        this.doIgnore = true;
        setTimeout(() => {
            this.doIgnore = false;
        }, 0);
        return true;
    }

    undo(): boolean {
        const _this = this;
        if (!this.ignoreTest()) {
            return false;
        }

        if (!klHistory.canUndo()) { // || workspace.isPainting()) {
            return false;
        }
        let startTime = performance.now();
        let actions = klHistory.undo();
        klHistory.pause();
        let oldSize = {w: _this.getKlCanvas().getWidth(), h: _this.getKlCanvas().getHeight()};
        _this.getKlCanvas().copy(_this.getInitState().canvas);
        let layerIndex = _this.getInitState().focus;
        _this.setCurrentLayerCtx(_this.getKlCanvas().getLayerContext(layerIndex));
        let brushes: any = {};
        for (let b in KL.brushes) {
            if (KL.brushes.hasOwnProperty(b)) {
                brushes[b] = new KL.brushes[b]();
                brushes[b].setContext(_this.getCurrentLayerCtx());
                brushes[b].setDebug('is_undo');
            }
        }
        brushes.sketchy.setSeed(_this.getInitState().brushes.sketchy.getSeed());
        brushes.smoothBrush.setRequestCanvas(function () {
            return _this.getKlCanvas();
        });
        for (let i = 0; i < actions.length; i++) {
            (function (i) {
                if (actions[i].tool[0] === "brush") {
                    let b = brushes[actions[i].tool[1]];
                    if (actions[i].actions) {
                        for (let e = 0; e < actions[i].actions.length; e++) {
                            let p = actions[i].actions[e].params;
                            b[actions[i].actions[e].action].apply(b, p);
                        }
                    } else {
                        let p = actions[i].params;
                        b[actions[i].action].apply(b, p);
                    }
                } else if (actions[i].tool[0] === "canvas") {
                    let p = actions[i].params;
                    let id = _this.getKlCanvas()[actions[i].action].apply(_this.getKlCanvas(), p);
                    if (typeof id === typeof 123) {
                        layerIndex = id;
                        _this.setCurrentLayerCtx(_this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(_this.getCurrentLayerCtx());
                            }
                        }
                    }
                } else if (actions[i].tool[0] === "filter") {
                    let p = [{
                        context: _this.getCurrentLayerCtx(),
                        canvas: _this.getKlCanvas(),
                        input: actions[i].params[0].input,
                        history: {
                            add: function () {
                            }, pause: function () {
                            }
                        }
                    }];
                    KL.filterLib[actions[i].tool[1]][actions[i].action].apply(null, p);
                } else if (actions[i].tool[0] === "misc" && actions[i].action === "focusLayer") {
                    layerIndex = actions[i].params[0];
                    _this.setCurrentLayerCtx(_this.getKlCanvas().getLayerContext(actions[i].params[0]));
                    for (let b in brushes) {
                        if (brushes.hasOwnProperty(b)) {
                            brushes[b].setContext(_this.getCurrentLayerCtx());
                        }
                    }
                } else if (actions[i].tool[0] === "misc" && actions[i].action === "importImage") {
                    let id = _this.getKlCanvas().addLayer();
                    if (typeof id === typeof 123) {
                        layerIndex = id;
                        if (actions[i].params[1]) {
                            _this.getKlCanvas().renameLayer(layerIndex, actions[i].params[1]);
                        }
                        _this.setCurrentLayerCtx(_this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(_this.getCurrentLayerCtx());
                            }
                        }
                    }
                    _this.getCurrentLayerCtx().drawImage(actions[i].params[0], 0, 0);
                }
            })(i);
        }
        if (oldSize.w !== _this.getKlCanvas().getWidth() || oldSize.h !== _this.getKlCanvas().getHeight()) {
            _this.klCanvasWorkspace.resetView();
            _this.handUi.update(_this.klCanvasWorkspace.getScale(), _this.klCanvasWorkspace.getAngleDeg());
        }
        _this.layerManager.update(layerIndex);
        _this.layerPreview.setLayer(_this.getKlCanvas().getLayer(layerIndex));
        _this.brushUiObj.sketchy.setSeed(brushes.sketchy.getSeed());
        _this.getCurrentBrush().setContext(_this.getCurrentLayerCtx());
        _this.klCanvasWorkspace.setLastDrawEvent(null);

        klHistory.pause(false);
        return true;
    }

    redo(): boolean {
        const _this = this;
        if (!this.ignoreTest()) {
            return false;
        }

        if (!klHistory.canRedo()) { // || workspace.isPainting()) {
            return false;
        }
        let actions = klHistory.redo();
        klHistory.pause();
        let oldSize = {w: _this.getKlCanvas().getWidth(), h: _this.getKlCanvas().getHeight()};
        let layerIndex;
        let brushes: any = {};
        for (let b in KL.brushes) {
            if (KL.brushes.hasOwnProperty(b)) {
                brushes[b] = new KL.brushes[b]();
                brushes[b].setContext(_this.getCurrentLayerCtx());
            }
        }
        brushes.smoothBrush.setRequestCanvas(function () {
            return _this.getKlCanvas();
        });
        brushes.sketchy.setSeed(_this.brushUiObj.sketchy.getSeed());
        for (let i = 0; i < actions.length; i++) {
            (function (i) {
                if (actions[i].tool[0] === "brush") {
                    let b = brushes[actions[i].tool[1]];
                    if (actions[i].actions) {
                        for (let e = 0; e < actions[i].actions.length; e++) {
                            let p = actions[i].actions[e].params;
                            b[actions[i].actions[e].action].apply(b, p);
                        }
                    } else {
                        let p = actions[i].params;
                        b[actions[i].action].apply(b, p);
                    }
                } else if (actions[i].tool[0] === "canvas") {
                    let p = actions[i].params;
                    let id = _this.getKlCanvas()[actions[i].action].apply(_this.getKlCanvas(), p);
                    if (typeof id === typeof 123) {
                        layerIndex = id;
                        _this.setCurrentLayerCtx(_this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(_this.getCurrentLayerCtx());
                            }
                        }
                    }
                } else if (actions[i].tool[0] === "filter") {
                    let p = [{
                        context: _this.getCurrentLayerCtx(),
                        canvas: _this.getKlCanvas(),
                        input: actions[i].params[0].input,
                        history: {
                            add: function () {
                            }, pause: function () {
                            }
                        }
                    }];
                    KL.filterLib[actions[i].tool[1]][actions[i].action].apply(null, p);
                } else if (actions[i].tool[0] === "misc" && actions[i].action === "focusLayer") {
                    layerIndex = actions[i].params[0];
                    _this.setCurrentLayerCtx(_this.getKlCanvas().getLayerContext(actions[i].params[0]));
                    for (let b in brushes) {
                        if (brushes.hasOwnProperty(b)) {
                            brushes[b].setContext(_this.getCurrentLayerCtx());
                        }
                    }
                } else if (actions[i].tool[0] === "misc" && actions[i].action === "importImage") {
                    let id = _this.getKlCanvas().addLayer();
                    if (typeof id === typeof 123) {
                        layerIndex = id;
                        if (actions[i].params[1]) {
                            _this.getKlCanvas().renameLayer(layerIndex, actions[i].params[1]);
                        }
                        _this.setCurrentLayerCtx(_this.getKlCanvas().getLayerContext(layerIndex));
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(_this.getCurrentLayerCtx());
                            }
                        }
                    }
                    _this.getCurrentLayerCtx().drawImage(actions[i].params[0], 0, 0);
                }
            })(i);
        }

        if (oldSize.w !== _this.getKlCanvas().getWidth() || oldSize.h !== _this.getKlCanvas().getHeight()) {
            _this.klCanvasWorkspace.resetView();
            _this.handUi.update(_this.klCanvasWorkspace.getScale(), _this.klCanvasWorkspace.getAngleDeg());
        }
        let currentLayerIndex = _this.getKlCanvas().getLayerIndex(_this.getCurrentLayerCtx().canvas);
        _this.layerManager.update(currentLayerIndex);
        _this.layerPreview.setLayer(_this.getKlCanvas().getLayer(currentLayerIndex));
        _this.brushUiObj.sketchy.setSeed(brushes.sketchy.getSeed());
        _this.getCurrentBrush().setContext(_this.getCurrentLayerCtx());
        _this.klCanvasWorkspace.setLastDrawEvent(null);
        klHistory.pause(false);

        return true;
    }

    catchup (logParam) {
        const _this = this;
        //play catch up (the version that is a few steps behind)
        if (logParam && logParam.bufferUpdate) {
            let brushes = _this.getInitState().brushes;
            let actions = [logParam.bufferUpdate];
            let localCurrentLayerCtx = _this.getInitState().canvas.getLayerContext(_this.getInitState().focus);
            let canvas = _this.getInitState().canvas;
            let layerIndex = _this.getInitState().focus;
            (function (i) {
                if (actions[i].tool[0] === "brush") {
                    let b = brushes[actions[i].tool[1]];
                    if (actions[i].actions) {
                        for (let e = 0; e < actions[i].actions.length; e++) {
                            let p = actions[i].actions[e].params;
                            b[actions[i].actions[e].action].apply(b, p);
                        }
                    } else {
                        let p = actions[i].params;
                        b[actions[i].action].apply(b, p);
                    }
                } else if (actions[i].tool[0] === "canvas") {
                    let p = actions[i].params;
                    let id = canvas[actions[i].action].apply(canvas, p);
                    if (typeof id === typeof 123) {
                        layerIndex = id;
                        localCurrentLayerCtx = canvas.getLayerContext(layerIndex);
                        for (let b in brushes) {
                            if (brushes.hasOwnProperty(b)) {
                                brushes[b].setContext(localCurrentLayerCtx);
                            }
                        }
                    }
                } else if (actions[i].tool[0] === "filter") {
                    let p = [{
                        context: localCurrentLayerCtx,
                        canvas: canvas,
                        input: actions[i].params[0].input,
                        history: {
                            add: function () {
                            }, pause: function () {
                            }
                        }
                    }];
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
                    let id = canvas.addLayer();
                    if (typeof id === typeof 123) {
                        layerIndex = id;
                        if (actions[i].params[1]) {
                            _this.getKlCanvas().renameLayer(layerIndex, actions[i].params[1]);
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
            _this.getInitState().focus = layerIndex;
        }
    }


}