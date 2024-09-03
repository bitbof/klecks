import { SelectUi, TSelectToolMode } from '../klecks/ui/tool-tabs/select-ui';
import { EaselSelect } from '../klecks/ui/easel/tools/easel-select';
import { isKlCanvasHistoryEntry, KlCanvas } from '../klecks/canvas/kl-canvas';
import { KlHistory } from '../klecks/history/kl-history';
import { throwIfNull } from '../bb/base/base';
import { SelectTool } from '../klecks/select-tool/select-tool';
import { SelectTransformTool } from '../klecks/select-tool/select-transform-tool';
import { KlTempHistory, TTempHistoryEntry } from '../klecks/history/kl-temp-history';
import { identity, Matrix } from 'transformation-matrix';
import { StatusOverlay } from '../klecks/ui/components/status-overlay';
import { showModal } from '../klecks/ui/modals/base/showModal';
import { LANG } from '../language/language';

export type TSelectTransformTempEntry = {
    type: 'select-transform';
    data: {
        transform: Matrix;
        doClone: boolean;
        targetLayerIndex: number;
        backgroundIsTransparent: boolean;
    };
};

function isSelectTransformTempEntry(entry: TTempHistoryEntry): entry is TSelectTransformTempEntry {
    return entry.type === 'select-transform' && !!entry.data;
}

export type TKlAppSelectParams = {
    klCanvas: KlCanvas;
    getCurrentLayerCtx: () => CanvasRenderingContext2D;
    klHistory: KlHistory;
    tempHistory: KlTempHistory;
    statusOverlay: StatusOverlay;

    onUpdateProject: () => void; // update easelProjectUpdater
    onFill: () => void;
    onErase: () => void;
};

/**
 * Coordinates everything related to selection.
 */
export class KlAppSelect {
    // from params
    private readonly klCanvas: KlCanvas;
    private readonly getCurrentLayerCtx: () => CanvasRenderingContext2D;
    private readonly klHistory: KlHistory;
    private readonly tempHistory: KlTempHistory;
    private readonly statusOverlay: StatusOverlay;
    private readonly onUpdateProject: () => void;
    private readonly onFill: () => void;
    private readonly onErase: () => void;

    private readonly selectUi: SelectUi;
    private readonly easelSelect: EaselSelect; // easel tool
    private readonly selectTool: SelectTool;
    private readonly transformTool: SelectTransformTool;

    // state
    private selectMode: TSelectToolMode = 'select';

    // transform state
    private targetLayerIndex: number = 0;
    private initialTransform: TSelectTransformTempEntry['data'] = {
        // when you begin transforming (for undo, and comparing change)
        transform: identity(),
        doClone: false,
        targetLayerIndex: 0,
        backgroundIsTransparent: false,
    };
    private backgroundIsTransparent: boolean = false;

    private isSourceLayerBackgroundTransparent(): boolean {
        const srcLayerCtx = this.getCurrentLayerCtx();
        const srcLayerIndex = throwIfNull(this.klCanvas.getLayerIndex(srcLayerCtx.canvas));
        if (srcLayerIndex > 0) {
            // not background layer
            return true;
        }
        return this.backgroundIsTransparent;
    }

    /** reset KlCanvas layer composites **/
    private resetComposites(): void {
        const srcLayerCtx = this.getCurrentLayerCtx();
        const srcLayerIndex = throwIfNull(this.klCanvas.getLayerIndex(srcLayerCtx.canvas));
        this.klCanvas.setComposite(srcLayerIndex, undefined);
        if (this.targetLayerIndex !== srcLayerIndex) {
            this.klCanvas.setComposite(this.targetLayerIndex, undefined);
        }
    }

    private updateComposites(): void {
        const srcLayerCanvas = this.getCurrentLayerCtx().canvas;
        const srcLayerIndex = throwIfNull(this.klCanvas.getLayerIndex(srcLayerCanvas));

        if (srcLayerIndex === this.targetLayerIndex) {
            this.klCanvas.setComposite(
                srcLayerIndex,
                this.transformTool.createComposite(srcLayerCanvas),
            );
        } else {
            this.klCanvas.setComposite(
                srcLayerIndex,
                this.transformTool.createSourceComposite(srcLayerCanvas),
            );
            this.klCanvas.setComposite(
                this.targetLayerIndex,
                this.transformTool.createTargetComposite(srcLayerCanvas),
            );
        }
    }

    private updateUiLayerList(): void {
        this.selectUi.setLayers(
            this.klCanvas.getLayers().map((layer) => {
                return layer.name;
            }),
        );
    }

    private resetSelection(): void {
        this.selectTool.reset();
        const selection = this.selectTool.getSelection();
        this.klCanvas.setSelection(selection);
        this.selectUi.setHasSelection(!!selection);
    }

    private tempHistoryReplaceTop(): void {
        this.tempHistory.replaceTop({
            type: 'select-transform',
            data: {
                transform: this.transformTool.getTransform(),
                doClone: this.transformTool.getDoClone(),
                targetLayerIndex: this.targetLayerIndex,
                backgroundIsTransparent: this.backgroundIsTransparent,
            },
        } satisfies TSelectTransformTempEntry);
    }

    // propagate from transformTool to everything else
    private propagateTransformationChange(): void {
        const selection = this.transformTool.getTransformedSelection();
        this.easelSelect.setRenderedSelection(selection);
        this.updateComposites();
        this.onUpdateProject();

        this.tempHistoryReplaceTop();
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TKlAppSelectParams) {
        this.klCanvas = p.klCanvas;
        this.onUpdateProject = p.onUpdateProject;
        this.getCurrentLayerCtx = p.getCurrentLayerCtx;
        this.klHistory = p.klHistory;
        this.tempHistory = p.tempHistory;
        this.statusOverlay = p.statusOverlay;
        this.onFill = p.onFill;
        this.onErase = p.onErase;

        // keep layer list up-to-date
        this.klHistory.addListener(() => {
            this.selectUi.setHasSelection(!!this.klCanvas.getSelection());
            if (this.selectMode === 'transform') {
                this.updateUiLayerList();
            }
        });

        // KlCanvas' selectionSample needs to be cleared manually.
        // Done by injecting it before any new undo step. It's an "invisible" undo step.
        this.klHistory.addBeforePushListener((entry) => {
            if (this.tempHistory.getIsActive() || !this.klCanvas.getSelectionSample()) {
                return;
            }
            if (
                isKlCanvasHistoryEntry(entry) &&
                (entry.action === 'transformCloneViaSelection' ||
                    entry.action === 'transformViaSelection' ||
                    entry.action === 'clearSelectionSample')
            ) {
                return;
            }
            this.klCanvas.clearSelectionSample();
        });

        this.selectTool = new SelectTool({
            klCanvas: this.klCanvas,
        });
        this.transformTool = new SelectTransformTool();

        this.easelSelect = new EaselSelect({
            selectMode: this.selectMode,
            onStartSelect: (p, operation) => this.selectTool.startSelect(p, operation),
            onGoSelect: (p) => {
                this.selectTool.goSelect(p);
                this.easelSelect.setRenderedSelection(this.selectTool.getSelection());
            },
            onEndSelect: () => {
                this.selectTool.endSelect();
                const selection = this.selectTool.getSelection();
                this.easelSelect.clearRenderedSelection();
                this.klCanvas.setSelection(selection);
                this.selectUi.setHasSelection(!!selection);
            },
            onStartMoveSelect: (p) => {
                this.selectTool.startMoveSelect(p);
            },
            onGoMoveSelect: (p) => {
                this.selectTool.goMoveSelect(p);
                this.easelSelect.setRenderedSelection(this.selectTool.getSelection());
            },
            onEndMoveSelect: () => {
                this.selectTool.endMoveSelect();
                if (!this.selectTool.getDidMove()) {
                    return;
                }
                const selection = this.selectTool.getSelection();
                this.easelSelect.clearRenderedSelection();
                this.klCanvas.setSelection(selection);
                this.selectUi.setHasSelection(!!selection);
            },
            onSelectAddPoly: (p, operation) => {
                this.selectTool.addPoly(p, operation);
                const selection = this.selectTool.getSelection();
                this.klCanvas.setSelection(selection);
                this.selectUi.setHasSelection(!!selection);
            },
            onTranslateTransform: (d) => {
                this.transformTool.translate(d);
                this.propagateTransformationChange();
            },
            onResetSelection: () => this.resetSelection(),
        });

        this.selectUi = new SelectUi({
            onChangeMode: (mode) => {
                this.selectMode = mode;
                if (this.selectMode === 'select') {
                    this.tempHistory.clear();
                    this.tempHistory.setIsActive(false);
                    const layerIndex = throwIfNull(
                        this.klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas),
                    );
                    if (
                        this.transformTool.isTransformationChanged() ||
                        this.transformTool.getDoClone() ||
                        layerIndex !== this.targetLayerIndex
                    ) {
                        // something changed -> apply
                        if (this.transformTool.getDoClone()) {
                            this.klCanvas.transformCloneViaSelection({
                                sourceLayer: layerIndex,
                                targetLayer: this.targetLayerIndex,
                                transformation: this.transformTool.getTransform(),
                            });
                        } else {
                            this.klCanvas.transformViaSelection({
                                sourceLayer: layerIndex,
                                targetLayer: this.targetLayerIndex,
                                transformation: this.transformTool.getTransform(),
                                backgroundIsTransparent: this.backgroundIsTransparent,
                            });
                        }
                        p.statusOverlay.out(LANG('select-transform-applied'), true);
                    }
                    this.klCanvas.setComposite(layerIndex, undefined);
                    this.klCanvas.setComposite(this.targetLayerIndex, undefined);
                    this.easelSelect.clearRenderedSelection(true);
                    const selection = this.klCanvas.getSelection();
                    this.selectTool.setSelection(selection);
                    this.selectUi.setHasSelection(!!selection);
                    this.onUpdateProject();
                } else {
                    // -> transform
                    this.tempHistory.setIsActive(true);
                    let selection = this.selectTool.getSelection() || [];
                    if (selection.length === 0) {
                        const width = this.klCanvas.getWidth();
                        const height = this.klCanvas.getHeight();
                        selection = [
                            [
                                [
                                    [0, 0],
                                    [width, 0],
                                    [width, height],
                                    [0, height],
                                    [0, 0],
                                ],
                            ],
                        ];
                    }

                    this.transformTool.setSelection(selection);
                    this.transformTool.setDoClone(false);
                    this.transformTool.setSelectionSample(this.klCanvas.getSelectionSample());
                    const currentLayerCanvas = this.getCurrentLayerCtx().canvas;
                    const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCanvas));
                    this.initialTransform.targetLayerIndex = layerIndex;
                    this.targetLayerIndex = layerIndex;
                    this.transformTool.setBackgroundIsTransparent(
                        this.isSourceLayerBackgroundTransparent(),
                    );
                    this.updateComposites();
                    const transformedSelection = this.transformTool.getTransformedSelection();
                    this.easelSelect.setRenderedSelection(transformedSelection);
                    this.selectUi.setHasSelection(!!selection);
                    this.updateUiLayerList();
                    this.selectUi.setMoveToLayer(undefined);
                    this.onUpdateProject();
                }
                this.easelSelect.setMode(this.selectMode);
            },
            onChangeBooleanOperation: (operation) => {
                this.easelSelect.setBooleanOperation(operation);
            },
            canTransform: () => {
                const layerIndex = throwIfNull(
                    this.klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas),
                );
                const result = !!this.klCanvas.getSelectionArea(layerIndex);
                if (!result) {
                    setTimeout(() => {
                        showModal({
                            target: document.body,
                            message: LANG('select-transform-empty'),
                            type: 'error',
                        });
                    });
                }
                return result;
            },
            select: {
                shape: this.selectTool.getShape(),
                onChangeShape: (shape) => {
                    this.selectTool.setShape(shape);
                    this.easelSelect.setSelectShape(shape);
                },
                onReset: () => this.resetSelection(),
                onAll: () => {
                    this.selectTool.selectAll();
                    const selection = this.selectTool.getSelection();
                    this.klCanvas.setSelection(selection);
                    this.selectUi.setHasSelection(!!selection);
                },
                onInvert: () => {
                    this.selectTool.invertSelection();
                    const selection = this.selectTool.getSelection();
                    this.klCanvas.setSelection(selection);
                    this.selectUi.setHasSelection(!!selection);
                },
            },
            transform: {
                onFlipY: () => {
                    this.transformTool.flip('y');
                    this.propagateTransformationChange();
                },
                onFlipX: () => {
                    this.transformTool.flip('x');
                    this.propagateTransformationChange();
                },
                onRotateDeg: (deg) => {
                    this.transformTool.rotateDeg(deg);
                    this.propagateTransformationChange();
                },
                onClone: () => {
                    // commit
                    this.tempHistory.clear();
                    const layerIndex = throwIfNull(
                        this.klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas),
                    );
                    // apply
                    // should always apply. user might want to make something more opaque.
                    if (this.transformTool.getDoClone()) {
                        this.klCanvas.transformCloneViaSelection({
                            sourceLayer: layerIndex,
                            targetLayer: this.targetLayerIndex,
                            transformation: this.transformTool.getTransform(),
                        });
                    } else if (this.transformTool.isTransformationChanged()) {
                        this.klCanvas.transformViaSelection({
                            sourceLayer: layerIndex,
                            targetLayer: this.targetLayerIndex,
                            transformation: this.transformTool.getTransform(),
                        });
                    }
                    const oldSelection = this.transformTool.getTransformedSelection();

                    // start another transform
                    const selection = this.klCanvas.getSelection() || oldSelection;
                    this.transformTool.setSelection(selection);
                    this.transformTool.setDoClone(true);
                    this.transformTool.setSelectionSample(this.klCanvas.getSelectionSample());
                    this.updateComposites();
                    this.easelSelect.setRenderedSelection(
                        this.transformTool.getTransformedSelection(),
                    );
                    this.selectUi.setHasSelection(!!selection);
                    this.onUpdateProject();

                    this.statusOverlay.out(LANG('select-transform-clone-applied'), true);
                },
                onMoveToLayer: (index) => {
                    this.resetComposites();

                    this.targetLayerIndex = index;
                    this.updateComposites();
                    this.onUpdateProject();

                    this.tempHistoryReplaceTop();
                },
                onChangeTransparentBackground: (isTransparent) => {
                    this.backgroundIsTransparent = isTransparent;
                    this.transformTool.setBackgroundIsTransparent(
                        this.isSourceLayerBackgroundTransparent(),
                    );
                    this.updateComposites();
                    this.onUpdateProject();

                    this.tempHistoryReplaceTop();
                },
            },
            onErase: () => {
                this.onErase();
            },
            onFill: () => {
                this.onFill();
            },
        });

        this.klHistory.addListener((update) => {
            const selection = this.klCanvas.getSelection();
            if (this.selectMode === 'select') {
                this.selectTool.setSelection(selection);
            }
        });
    }

    getSelectUi(): SelectUi {
        return this.selectUi;
    }

    getEaselSelect(): EaselSelect {
        return this.easelSelect;
    }

    /**
     * If transform changed something, changes are applied. -> return true
     * If no changes applied -> return false
     */
    commitTransform(): boolean {
        let result = false;
        if (this.selectMode === 'transform') {
            this.selectUi.setMode('select'); // this triggers selectUi.onMode
            result = true;
        }
        return result;
    }

    /** if transforming, changes are discarded */
    discardTransform(): boolean {
        if (this.selectMode === 'transform') {
            this.transformTool.reset();
            this.transformTool.setDoClone(false);
            const currentCanvas = this.getCurrentLayerCtx().canvas;
            this.targetLayerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentCanvas));
            this.selectUi.setMode('select'); // this triggers selectUi.onMode
            return true;
        }
        return false;
    }

    setSelectMode(mode: TSelectToolMode): void {}

    /**
     * feed type from KlHistoryExecutor.onExecuted.
     *
     * If regular undo step -> jump back to select tab
     * If temp undo/redo step -> update transformation state
     */
    onHistory(type: 'undo' | 'redo' | 'tempUndo' | 'tempRedo'): void {
        if (type === 'undo') {
            // commit
            this.selectUi.setMode('select'); // this triggers selectUi.onMode
        } else if (type === 'tempUndo' || type === 'tempRedo') {
            this.resetComposites();

            // recreate
            const entries = this.tempHistory.getEntries();
            const top = entries.at(-1);

            let state = {
                ...this.initialTransform,
                doClone: this.transformTool.getDoClone(),
            };
            if (top && isSelectTransformTempEntry(top)) {
                state = top.data;
            }
            this.transformTool.setTransform(state.transform);
            this.transformTool.setDoClone(state.doClone);
            this.targetLayerIndex = state.targetLayerIndex;
            this.backgroundIsTransparent = state.backgroundIsTransparent;
            this.selectUi.setBackgroundIsTransparent(state.backgroundIsTransparent);
            this.transformTool.setBackgroundIsTransparent(
                this.isSourceLayerBackgroundTransparent(),
            );

            const selection = this.transformTool.getTransformedSelection();
            this.easelSelect.setRenderedSelection(selection);
            this.selectUi.setMoveToLayer(
                this.klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas) ===
                    state.targetLayerIndex
                    ? undefined
                    : state.targetLayerIndex,
            );
            this.updateComposites();
            this.onUpdateProject();
        }
    }

    destroy(): void {
        // todo
    }
}
