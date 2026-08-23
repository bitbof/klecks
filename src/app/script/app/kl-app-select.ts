import { SelectUi, TSelectToolMode } from '../klecks/ui/tool-tabs/select-ui';
import { EaselSelect } from '../klecks/ui/easel/tools/easel-select';
import { KlCanvas } from '../klecks/canvas/kl-canvas';
import { throwIfNull } from '../bb/base/base';
import { SelectTool } from '../klecks/select-tool/select-tool';
import { FfdRenderer } from '../klecks/transform/ffd-renderer';
import { KlTempHistory, TTempHistoryEntry } from '../klecks/history/kl-temp-history';
import { StatusOverlay } from '../klecks/ui/components/status-overlay';
import { showModal } from '../klecks/ui/modals/base/show-modal';
import { LANG } from '../language/language';
import { KlHistory } from '../klecks/history/kl-history';
import { boundsToRect, rectToBounds } from '../bb/math/math';
import { TInterpolationAlgorithm } from '../klecks/kl-types';
import { klCanvasTransform } from '../klecks/canvas/kl-canvas-transform';
import { testComposedLayerHasTransparency } from '../klecks/filters/filter-transform';
import { klCanvasFfd } from '../klecks/canvas/kl-canvas-ffd';
import {
    centerTransformation,
    flipTransformation,
    freeTransformToMatrix,
    rectToFreeTransform,
    rotateTransformation,
    scaleTransformation,
    TComposedTransformation,
    transformFfd,
    transformSelection,
} from '../klecks/transform/composed-transformation';
import { MultiPolygon } from 'polygon-clipping';
import { createFfdLattice } from '../klecks/transform/ffd';
import { getSelectionBoundsFromSample } from '../klecks/transform/get-selection-sample-bounds';
import { BB } from '../bb/bb';
import { createTransformationComposite } from '../klecks/transform/create-transformation-composite';
import { THistoryExecutionType } from '../klecks/history/kl-history-executor';
import { createSelectionSample, TSelectionSample } from '../klecks/transform/selection-sample';
import { getFfdBounds } from '../klecks/transform/ffd-utils';

export type TSelectTransformTempEntry = {
    type: 'select-transform';
    data: {
        transform: TComposedTransformation;
        doClone: boolean;
        targetLayerIndex: number;
        backgroundIsTransparent: boolean;
        algorithm: TInterpolationAlgorithm;
    };
};

function isSelectTransformTempEntry(entry: TTempHistoryEntry): entry is TSelectTransformTempEntry {
    return entry.type === 'select-transform' && !!entry.data;
}

type TTransformState = {
    selection?: MultiPolygon;
    selectionSample: TSelectionSample;
    transform: TComposedTransformation;
    algorithm: TInterpolationAlgorithm;
    doClone: boolean;
    isWarping: boolean;
    targetLayerIndex: number;
    backgroundIsTransparent: boolean;
};

function initialiseTransformState(p: {
    selection?: MultiPolygon;
    selectionSample: TSelectionSample;
    algorithm: TInterpolationAlgorithm;
    targetLayerIndex: number;
    backgroundIsTransparent: boolean;
}): TTransformState {
    const selectionSample = p.selectionSample;
    const selectionBounds = getSelectionBoundsFromSample(p.selectionSample);
    const transform: TComposedTransformation = {
        // no ffd initially
        type: 'free',
        freeTransform: rectToFreeTransform(boundsToRect(selectionBounds)),
    };

    return {
        selection: p.selection,
        selectionSample,
        transform,
        algorithm: p.algorithm,
        doClone: false,
        isWarping: false,
        targetLayerIndex: p.targetLayerIndex,
        backgroundIsTransparent: p.backgroundIsTransparent,
    };
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
    private readonly ffdRenderer: FfdRenderer;
    private readonly onVisibilityChange: () => void;

    // state
    private selectMode: TSelectToolMode = 'select';
    private transformState: undefined | TTransformState;

    // ----------------------------------- private methods -----------------------------------

    private isTransformationChanged(): boolean {
        if (!this.transformState) {
            return false;
        }
        const initial = this.tempHistory.getEntries()[0];
        if (!isSelectTransformTempEntry(initial)) {
            throw new Error('initial temp history entry has wrong type');
        }
        if (this.transformState.doClone !== initial.data.doClone) {
            return true;
        }
        if (this.transformState.targetLayerIndex !== initial.data.targetLayerIndex) {
            return true;
        }
        // not perfect but would be a lot of effort to determine if two transforms are equivalent
        return (
            JSON.stringify(this.transformState.transform) !== JSON.stringify(initial.data.transform)
        );
    }

    /** reset KlCanvas layer composites **/
    private resetKlCanvasLayerComposites(): void {
        const srcLayerCtx = this.getCurrentLayerCtx();
        const srcLayerIndex = throwIfNull(this.klCanvas.getLayerIndex(srcLayerCtx.canvas));
        this.klCanvas.setComposite(srcLayerIndex, undefined);
        if (this.transformState && this.transformState.targetLayerIndex !== srcLayerIndex) {
            this.klCanvas.setComposite(this.transformState.targetLayerIndex, undefined);
        }
    }

    private updateComposites(): void {
        if (!this.transformState) {
            return;
        }

        const srcLayerCanvas = this.getCurrentLayerCtx().canvas;
        const srcLayerIndex = throwIfNull(this.klCanvas.getLayerIndex(srcLayerCanvas));

        const config: Parameters<typeof createTransformationComposite>[0] = {
            klCanvasWidth: this.klCanvas.getWidth(),
            klCanvasHeight: this.klCanvas.getHeight(),
            transform: this.transformState.transform,
            selection: this.transformState.selection,
            selectionSample: this.transformState.selectionSample,
            algorithm: this.transformState.algorithm,
            doClone: this.transformState.doClone,
            backgroundIsTransparent:
                srcLayerIndex !== 0 || this.transformState.backgroundIsTransparent,
            ffdRenderer: this.ffdRenderer,
        };
        if (srcLayerIndex === this.transformState.targetLayerIndex) {
            this.klCanvas.setComposite(
                srcLayerIndex,
                createTransformationComposite(config, 'same'),
            );
        } else {
            this.klCanvas.setComposite(srcLayerIndex, createTransformationComposite(config, 'src'));
            this.klCanvas.setComposite(
                this.transformState.targetLayerIndex,
                createTransformationComposite(config, 'dest'),
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

    private tempHistoryPush(): void {
        if (!this.transformState) {
            return;
        }
        const newEntry: TSelectTransformTempEntry = {
            type: 'select-transform',
            data: {
                transform: BB.copyObj(this.transformState.transform),
                doClone: this.transformState.doClone,
                targetLayerIndex: this.transformState.targetLayerIndex,
                backgroundIsTransparent: this.transformState.backgroundIsTransparent,
                algorithm: this.transformState.algorithm,
            },
        };
        const topEntry = this.tempHistory.getEntries().at(-1);
        // skip if no change
        if (JSON.stringify(newEntry) === JSON.stringify(topEntry)) {
            return;
        }
        this.tempHistory.push(newEntry);
    }

    private propagateTransformationChange(skipPushUndo = false): void {
        if (!this.transformState) {
            return;
        }
        if (this.transformState.selection) {
            const selection = transformSelection(
                this.transformState.transform,
                this.transformState.selection,
            );
            this.easelSelect.setRenderedSelection(selection);
        }
        this.updateComposites();
        this.onUpdateProject();
        this.updateSelectUi();

        !skipPushUndo && this.tempHistoryPush();
    }

    private updateSelectUi(): void {
        if (!this.transformState) {
            return;
        }
        if (this.transformState.transform.type !== 'ffd') {
            this.selectUi.setFreeTransformTransformation(
                this.transformState.transform.freeTransform,
            );
        }
    }

    private clearTransformState(): void {
        if (this.transformState) {
            BB.freeCanvas(this.transformState.selectionSample.image);
            this.transformState = undefined;
        }
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

        this.selectTool = new SelectTool({
            klCanvas: this.klCanvas,
        });
        this.ffdRenderer = new FfdRenderer();
        this.onVisibilityChange = () => {
            if (document.hidden && this.selectMode === 'transform') {
                this.ffdRenderer.freeResources();
            }
        };
        document.addEventListener('visibilitychange', this.onVisibilityChange);

        this.easelSelect = new EaselSelect({
            selectMode: this.selectMode,
            onStartSelect: (p, operation) => this.selectTool.startSelect(p, operation),
            onGoSelect: (p, isShiftPressed) => {
                this.selectTool.goSelect(p, isShiftPressed);
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
            onGoMoveSelect: (p, isShiftPressed) => {
                this.selectTool.goMoveSelect(p, isShiftPressed);
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
            onResetSelection: () => this.resetSelection(),
            onTransform: (transform) => {
                if (!this.transformState) {
                    return;
                }
                this.transformState.transform = transform;
                this.propagateTransformationChange(true);
            },
            onTransformEnd: () => {
                this.tempHistoryPush();
            },
        });

        this.selectUi = new SelectUi({
            onChangeMode: (mode) => {
                if (mode === 'select') {
                    const layerIndex = throwIfNull(
                        this.klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas),
                    );
                    if (
                        this.transformState &&
                        (this.isTransformationChanged() ||
                            this.transformState.doClone ||
                            layerIndex !== this.transformState.targetLayerIndex ||
                            this.selectUi.getIsWarping())
                    ) {
                        // something changed -> apply

                        const transform = this.transformState.transform;
                        if (transform.type === 'free') {
                            klCanvasTransform({
                                klCanvas: this.klCanvas,
                                selectionSample: this.transformState.selectionSample,
                                ...(this.transformState.doClone
                                    ? {}
                                    : { eraseLayerIndex: layerIndex }),
                                targetLayerIndex: this.transformState.targetLayerIndex,
                                freeTransform: transform.freeTransform,
                                backgroundIsTransparent:
                                    this.transformState.backgroundIsTransparent,
                                algorithm: this.transformState.algorithm,
                                selection: this.transformState.selection,
                            });
                        } else {
                            const ffd =
                                transform.type === 'ffd+free'
                                    ? transformFfd(
                                          transform.ffd,
                                          freeTransformToMatrix(
                                              transform.freeTransform,
                                              rectToBounds(transform.ffdBounds, 'index'),
                                          ),
                                      )
                                    : transform.ffd;
                            if (this.transformState.doClone) {
                                klCanvasFfd({
                                    klCanvas: this.klCanvas,
                                    selectionSample: this.transformState.selectionSample,
                                    targetLayerIndex: this.transformState.targetLayerIndex,
                                    ffd,
                                    algorithm: this.transformState.algorithm,
                                    selection: this.transformState.selection,
                                    ffdRenderer: this.ffdRenderer,
                                });
                            } else {
                                klCanvasFfd({
                                    klCanvas: this.klCanvas,
                                    selectionSample: this.transformState.selectionSample,
                                    eraseLayerIndex: layerIndex,
                                    targetLayerIndex: this.transformState.targetLayerIndex,
                                    ffd,
                                    backgroundIsTransparent:
                                        this.transformState.backgroundIsTransparent,
                                    algorithm: this.transformState.algorithm,
                                    selection: this.transformState.selection,
                                    ffdRenderer: this.ffdRenderer,
                                });
                            }
                        }
                        this.clearTransformState();
                        p.statusOverlay.out(LANG('select-transform-applied'), true);
                    }

                    this.tempHistory.clear();
                    this.tempHistory.setIsActive(false);
                    this.selectUi.setIsWarping(false);
                    this.resetKlCanvasLayerComposites();
                    this.ffdRenderer.freeResources();
                    this.easelSelect.clearRenderedSelection(true);
                    const selection = this.klCanvas.getSelection();
                    this.selectTool.setSelection(selection);
                    this.selectUi.setHasSelection(!!selection);
                    this.onUpdateProject();
                    this.easelSelect.setMode(mode);
                } else {
                    // -> transform

                    // avoid changing state while mode-change can be rejected
                    const currentLayerCanvas = this.getCurrentLayerCtx().canvas;
                    const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCanvas));
                    const selectionSample = createSelectionSample(layerIndex, this.klCanvas);
                    if (!selectionSample) {
                        setTimeout(() => {
                            showModal({
                                message: LANG('select-transform-empty'),
                                type: 'error',
                            });
                        });
                        return false;
                    }

                    this.tempHistory.setIsActive(true);
                    const isBgLayer = layerIndex === 0;
                    let isTransparent = false;
                    if (isBgLayer) {
                        const layer = Object.entries(this.klHistory.getComposed().layerMap).find(
                            ([_, layer]) => layer.index === layerIndex,
                        )![1];
                        isTransparent = testComposedLayerHasTransparency(layer);
                        this.selectUi.setBackgroundIsTransparent(isTransparent);
                    }
                    this.transformState = initialiseTransformState({
                        selection: this.klCanvas.getSelection(),
                        selectionSample: selectionSample,
                        algorithm: this.selectUi.getAlgorithm(),
                        targetLayerIndex: layerIndex,
                        backgroundIsTransparent: isTransparent,
                    });

                    // push initial state
                    this.tempHistoryPush();

                    this.selectUi.setShowTransparentBackgroundToggle(isBgLayer);
                    this.updateComposites();
                    this.updateUiLayerList();
                    this.selectUi.setMoveToLayer(undefined);
                    this.onUpdateProject();
                    this.easelSelect.setMode(mode);
                    if (this.transformState.selection) {
                        const transformedSelection = transformSelection(
                            this.transformState.transform,
                            this.transformState.selection,
                        );
                        this.easelSelect.setRenderedSelection(transformedSelection);
                    }
                    this.easelSelect.initialiseTransform(this.transformState.transform);
                    this.updateSelectUi();
                }
                this.selectMode = mode;
                return true;
            },
            onChangeBooleanOperation: (operation) => {
                this.easelSelect.setBooleanOperation(operation);
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
                    if (!this.transformState) {
                        return;
                    }
                    this.transformState.transform = flipTransformation(
                        this.transformState.transform,
                        'y',
                    );
                    this.propagateTransformationChange();
                    this.easelSelect.setTransform(this.transformState.transform);
                },
                onFlipX: () => {
                    if (!this.transformState) {
                        return;
                    }
                    this.transformState.transform = flipTransformation(
                        this.transformState.transform,
                        'x',
                    );
                    this.propagateTransformationChange();
                    this.easelSelect.setTransform(this.transformState.transform);
                },
                onRotateDeg: (deg) => {
                    if (!this.transformState) {
                        return;
                    }
                    this.transformState.transform = rotateTransformation(
                        this.transformState.transform,
                        deg,
                    );
                    this.propagateTransformationChange();
                    this.easelSelect.setTransform(this.transformState.transform);
                },
                onClone: () => {
                    if (!this.transformState) {
                        return;
                    }
                    // commit
                    const layerIndex = throwIfNull(
                        this.klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas),
                    );
                    const transform = this.transformState.transform;
                    // apply
                    // should always apply. user might want to make something more opaque.
                    if (transform.type === 'free') {
                        if (this.transformState.doClone) {
                            klCanvasTransform({
                                klCanvas: this.klCanvas,
                                selectionSample: this.transformState.selectionSample,
                                targetLayerIndex: this.transformState.targetLayerIndex,
                                freeTransform: transform.freeTransform,
                                algorithm: this.transformState.algorithm,
                                selection: this.transformState.selection,
                            });
                        } else if (this.isTransformationChanged()) {
                            klCanvasTransform({
                                klCanvas: this.klCanvas,
                                selectionSample: this.transformState.selectionSample,
                                eraseLayerIndex: layerIndex,
                                targetLayerIndex: this.transformState.targetLayerIndex,
                                freeTransform: transform.freeTransform,
                                backgroundIsTransparent:
                                    this.transformState.backgroundIsTransparent,
                                algorithm: this.transformState.algorithm,
                                selection: this.transformState.selection,
                            });
                        }
                    } else {
                        const ffd =
                            transform.type === 'ffd+free'
                                ? transformFfd(
                                      transform.ffd,
                                      freeTransformToMatrix(
                                          transform.freeTransform,
                                          rectToBounds(transform.ffdBounds, 'index'),
                                      ),
                                  )
                                : transform.ffd;
                        if (this.transformState.doClone) {
                            klCanvasFfd({
                                klCanvas: this.klCanvas,
                                selectionSample: this.transformState.selectionSample,
                                targetLayerIndex: this.transformState.targetLayerIndex,
                                ffd,
                                algorithm: this.transformState.algorithm,
                                selection: this.transformState.selection,
                                ffdRenderer: this.ffdRenderer,
                            });
                        } else if (this.isTransformationChanged()) {
                            klCanvasFfd({
                                klCanvas: this.klCanvas,
                                selectionSample: this.transformState.selectionSample,
                                eraseLayerIndex: layerIndex,
                                targetLayerIndex: this.transformState.targetLayerIndex,
                                ffd,
                                backgroundIsTransparent:
                                    this.transformState.backgroundIsTransparent,
                                algorithm: this.transformState.algorithm,
                                selection: this.transformState.selection,
                                ffdRenderer: this.ffdRenderer,
                            });
                        }
                    }

                    this.tempHistory.clear();
                    // push initial state
                    this.tempHistoryPush();

                    this.transformState.doClone = true;
                    this.updateComposites();
                    this.onUpdateProject();

                    this.statusOverlay.out(LANG('select-transform-clone-applied'), true);
                },
                onScale: (factor) => {
                    if (!this.transformState) {
                        return;
                    }
                    this.transformState.transform = scaleTransformation(
                        this.transformState.transform,
                        factor,
                    );
                    this.propagateTransformationChange();
                    this.easelSelect.setTransform(this.transformState.transform);
                },
                onCenter: () => {
                    if (!this.transformState) {
                        return;
                    }
                    this.transformState.transform = centerTransformation(
                        this.transformState.transform,
                        {
                            x: this.klCanvas.getWidth() / 2,
                            y: this.klCanvas.getHeight() / 2,
                        },
                    );
                    this.propagateTransformationChange();
                    this.easelSelect.setTransform(this.transformState.transform);
                },
                onMoveToLayer: (index) => {
                    if (!this.transformState) {
                        return;
                    }
                    this.resetKlCanvasLayerComposites();
                    this.transformState.targetLayerIndex = index;
                    this.updateComposites();
                    this.onUpdateProject();
                    this.tempHistoryPush();
                },
                onChangeTransparentBackground: (isTransparent) => {
                    if (!this.transformState) {
                        return;
                    }
                    this.transformState.backgroundIsTransparent = isTransparent;
                    this.updateComposites();
                    this.onUpdateProject();
                    this.tempHistoryPush();
                },
                onChangeAlgorithm: (algorithm) => {
                    if (!this.transformState) {
                        return;
                    }
                    this.transformState.algorithm = algorithm;
                    this.updateComposites();
                    this.onUpdateProject();
                    this.tempHistoryPush();
                },
                onChangeConstrain: (isConstrained) => {
                    this.easelSelect.setIsConstrained(isConstrained);
                },
                onChangeSnapping: (isSnapping) => {
                    this.easelSelect.setIsSnapping(isSnapping);
                },
                onChangeWarp: (isWarping) => {
                    if (!this.transformState) {
                        return;
                    }
                    const transform = this.transformState.transform;
                    if (isWarping) {
                        if (transform.type === 'free') {
                            const selectionBounds = getSelectionBoundsFromSample(
                                this.transformState.selectionSample,
                            );
                            const matrix = freeTransformToMatrix(
                                transform.freeTransform,
                                selectionBounds,
                            );
                            this.transformState.transform = {
                                type: 'ffd',
                                ffd: transformFfd(
                                    createFfdLattice(5, 5, boundsToRect(selectionBounds)),
                                    matrix,
                                ),
                            };
                        } else if (transform.type === 'ffd+free') {
                            const matrix = freeTransformToMatrix(
                                transform.freeTransform,
                                rectToBounds(transform.ffdBounds, 'index'),
                            );
                            this.transformState.transform = {
                                type: 'ffd',
                                ffd: transformFfd(transform.ffd, matrix),
                            };
                        }
                    } else {
                        if (transform.type === 'ffd') {
                            const ffdBounds = boundsToRect(getFfdBounds(transform.ffd));
                            const freeTransform = rectToFreeTransform(ffdBounds);
                            this.transformState.transform = {
                                type: 'ffd+free',
                                ffd: BB.copyObj(transform.ffd),
                                ffdBounds,
                                freeTransform,
                            };
                        }
                    }
                    this.transformState.isWarping = isWarping;
                    this.easelSelect.setTransform(this.transformState.transform);
                    this.updateComposites();
                    this.onUpdateProject();
                    this.tempHistoryPush();
                },
            },
            onErase: () => {
                this.onErase();
            },
            onFill: () => {
                this.onFill();
            },
        });

        this.klHistory.addListener(() => {
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

    getSelectMode(): TSelectToolMode {
        return this.selectMode;
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
            // so there's no transformation to apply.
            this.clearTransformState();
            // this triggers selectUi.onMode synchronously, which does the cleanup
            this.selectUi.setMode('select');
            return true;
        }
        return false;
    }

    onHistory(type: THistoryExecutionType): void {
        if (this.transformState && (type === 'tempUndo' || type === 'tempRedo')) {
            this.resetKlCanvasLayerComposites();
            // recreate
            const entries = this.tempHistory.getEntries();
            const top = entries.at(-1)!;
            if (!isSelectTransformTempEntry(top)) {
                return;
            }
            const state = top.data;
            this.transformState.transform = BB.copyObj(state.transform);
            this.transformState.doClone = state.doClone;
            this.transformState.targetLayerIndex = state.targetLayerIndex;
            this.transformState.backgroundIsTransparent = state.backgroundIsTransparent;
            this.transformState.algorithm = state.algorithm;
            this.transformState.isWarping = state.transform.type === 'ffd';
            this.selectUi.setBackgroundIsTransparent(state.backgroundIsTransparent);
            this.selectUi.setAlgorithm(state.algorithm);
            this.selectUi.setIsWarping(state.transform.type === 'ffd');

            if (this.transformState.selection) {
                const selection = transformSelection(
                    this.transformState.transform,
                    this.transformState.selection,
                );
                this.easelSelect.setRenderedSelection(selection);
            }
            this.easelSelect.setTransform(this.transformState.transform);
            this.selectUi.setMoveToLayer(
                this.klCanvas.getLayerIndex(this.getCurrentLayerCtx().canvas) ===
                    state.targetLayerIndex
                    ? undefined
                    : state.targetLayerIndex,
            );
            this.updateComposites();
            this.onUpdateProject();
            this.updateSelectUi();
        }
    }

    destroy(): void {
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        // not a proper cleanup yet
    }
}
