import { KL } from '../klecks/kl';
import { BB } from '../bb/bb';
import { showIframeModal } from '../klecks/ui/modals/show-iframe-modal';
import { EmbedToolspaceTopRow } from '../embed/embed-toolspace-top-row';
import {
    TBrushUiInstance,
    TDeserializedKlStorageProject,
    TDrawEvent,
    TExportType,
    TGradient,
    TKlProject,
    TRgb,
    TUiLayout,
} from '../klecks/kl-types';
import { importFilters } from '../klecks/filters/filters-lazy';
import { klCanvasToPsdBlob } from '../klecks/storage/kl-canvas-to-psd-blob';
import { ProjectStore } from '../klecks/storage/project-store';
import { SaveReminder } from '../klecks/ui/components/save-reminder';
import { KlCanvas, TKlCanvasLayer } from '../klecks/canvas/kl-canvas';
import { LANG } from '../language/language';
import { LocalStorage } from '../bb/base/local-storage';
import { LineSmoothing } from '../klecks/events/line-smoothing';
import { LineSanitizer } from '../klecks/events/line-sanitizer';
import { TabRow } from '../klecks/ui/components/tab-row';
import { LayerPreview } from '../klecks/ui/components/layer-preview';
import { KlColorSlider } from '../klecks/ui/components/kl-color-slider';
import { ToolspaceToolRow } from '../klecks/ui/components/toolspace-tool-row';
import { StatusOverlay } from '../klecks/ui/components/status-overlay';
import { SaveToComputer } from '../klecks/storage/save-to-computer';
import { ToolspaceScroller } from '../klecks/ui/components/toolspace-scroller';
import { translateSmoothing } from '../klecks/utils/translate-smoothing';
import { KlAppImportHandler } from './kl-app-import-handler';
import toolPaintImg from 'url:/src/app/img/ui/tool-paint.svg';
import toolHandImg from 'url:/src/app/img/ui/tool-hand.svg';
import toolFillImg from 'url:/src/app/img/ui/tool-fill.svg';
import toolGradientImg from 'url:/src/app/img/ui/tool-gradient.svg';
import toolTextImg from 'url:/src/app/img/ui/tool-text.svg';
import toolShapeImg from 'url:/src/app/img/ui/tool-shape.svg';
import toolSelectImg from 'url:/src/app/img/ui/tool-select.svg';
import tabSettingsImg from 'url:/src/app/img/ui/tab-settings.svg';
import tabLayersImg from 'url:/src/app/img/ui/tab-layers.svg';
import tabEditImg from 'url:/src/app/img/ui/tab-edit.svg';
import { LayersUi } from '../klecks/ui/tool-tabs/layers-ui/layers-ui';
import { TVector2D } from '../bb/bb-types';
import { createConsoleApi } from './console-api';
import { KL_CONFIG } from '../klecks/kl-config';
import { TRenderTextParam } from '../klecks/image-operations/render-text';
import { Easel } from '../klecks/ui/easel/easel';
import { EaselHand } from '../klecks/ui/easel/tools/easel-hand';
import { EaselBrush } from '../klecks/ui/easel/tools/easel-brush';
import { EaselProjectUpdater } from '../klecks/ui/easel/easel-project-updater';
import { zoomByStep } from '../klecks/ui/project-viewport/utils/zoom-by-step';
import { EaselEyedropper } from '../klecks/ui/easel/tools/easel-eyedropper';
import { EaselPaintBucket } from '../klecks/ui/easel/tools/easel-paint-bucket';
import { EaselGradient } from '../klecks/ui/easel/tools/easel-gradient';
import { EaselText } from '../klecks/ui/easel/tools/easel-text';
import { EaselShape } from '../klecks/ui/easel/tools/easel-shape';
import { EaselRotate } from '../klecks/ui/easel/tools/easel-rotate';
import { EaselZoom } from '../klecks/ui/easel/tools/easel-zoom';
import { KlAppSelect } from './kl-app-select';
import { KlTempHistory } from '../klecks/history/kl-temp-history';
import { PinchZoomWatcher } from '../klecks/ui/components/pinch-zoom-watcher';
import { EASEL_MAX_SCALE, EASEL_MIN_SCALE } from '../klecks/ui/easel/easel.config';
import { THistoryEntryDataComposed } from '../klecks/history/history.types';
import { KlHistoryExecutor, THistoryExecutionType } from '../klecks/history/kl-history-executor';
import { KlHistory } from '../klecks/history/kl-history';
import { isHistoryEntryActiveLayerChange } from '../klecks/history/push-helpers/is-history-entry-active-layer-change';
import { MobileUi } from '../klecks/ui/mobile/mobile-ui';
import { MobileBrushUi } from '../klecks/ui/mobile/mobile-brush-ui';
import { canvasToBlob } from '../bb/base/canvas';
import { projectToComposed } from '../klecks/history/push-helpers/project-to-composed';
import { ERASE_COLOR } from '../klecks/brushes/erase-color';
import { KlRecoveryManager } from '../klecks/storage/kl-recovery-manager';
import { drawProject } from '../klecks/canvas/draw-project';
import { css, randomUuid, sleep } from '../bb/base/base';
import { UnloadWarningTrigger } from '../klecks/ui/components/unload-warning-trigger';
import { KL_INDEXED_DB } from '../klecks/storage/kl-indexed-db';
import { showModal } from '../klecks/ui/modals/base/showModal';
import { runBrowserStorageBanner } from '../klecks/ui/components/browser-storage-banner';
import { requestPersistentStorage } from '../klecks/storage/request-persistent-storage';
import { CrossTabChannel } from '../bb/base/cross-tab-channel';
import { MobileColorUi } from '../klecks/ui/mobile/mobile-color-ui';
import { getSelectionPath2d } from '../bb/multi-polygon/get-selection-path-2d';

importFilters();

type TKlAppOptionsEmbed = {
    url: string;
    enableImageDropperImport?: boolean; // default false
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
};

export type TKlAppParams = {
    project?: TKlProject;
    logoImg?: string; // app logo
    bottomBar?: HTMLElement; // row at bottom of toolspace
    embed?: TKlAppOptionsEmbed;
    app?: {
        imgurKey?: string; // for imgur uploads
    };
    aboutEl?: HTMLElement; // replaces info about Klecks in settings tab
    klRecoveryManager?: KlRecoveryManager; // undefined if IndexedDB fails connecting
};

type TKlAppToolId =
    | 'hand'
    | 'brush'
    | 'select'
    | 'eyedropper'
    | 'paintBucket'
    | 'gradient'
    | 'text'
    | 'shape'
    | 'rotate'
    | 'zoom';

export class KlApp {
    private readonly rootEl: HTMLElement;
    private uiWidth: number;
    private uiHeight: number;
    private readonly layerPreview: LayerPreview;
    private readonly klColorSlider: KlColorSlider;
    private readonly toolspaceToolRow: ToolspaceToolRow;
    private readonly statusOverlay: StatusOverlay;
    private readonly klCanvas: KlCanvas;
    private uiLayout: TUiLayout;
    private readonly embed: undefined | TKlAppOptionsEmbed;
    private readonly saveToComputer: SaveToComputer;
    private readonly lineSanitizer: LineSanitizer;
    private readonly easel: Easel<TKlAppToolId>;
    private readonly easelProjectUpdater: EaselProjectUpdater<TKlAppToolId>;
    private readonly easelBrush: EaselBrush;
    private readonly collapseThreshold: number = 820;
    private readonly mobileUi: MobileUi;
    private readonly mobileBrushUi: MobileBrushUi;
    private readonly mobileColorUi: MobileColorUi;
    private readonly toolspace: HTMLElement;
    private readonly toolspaceInner: HTMLElement;
    private readonly toolWidth: number = 271;
    private readonly bottomBar: HTMLElement | undefined;
    private readonly layersUi: LayersUi;
    private readonly toolspaceScroller: ToolspaceScroller;
    private readonly bottomBarWrapper: HTMLElement;
    private readonly saveReminder: SaveReminder | undefined;
    private readonly unloadWarningTrigger: UnloadWarningTrigger | undefined;
    private lastSavedHistoryIndex: number = 0;
    private readonly klHistory: KlHistory;

    private updateLastSaved(): void {
        this.lastSavedHistoryIndex = this.klHistory.getTotalIndex();
        this.saveReminder?.reset();
        this.unloadWarningTrigger?.update();
    }

    private updateCollapse(isInitial?: boolean): void {
        if (isInitial) {
            const isMobile = Boolean(LocalStorage.getItem('uiShowMobile') ?? false);
            if (isMobile) {
                this.mobileUi.setToolspaceIsOpen(false);
            }
        }
        this.mobileUi.setOrientation(this.uiLayout);
        if (this.uiWidth < this.collapseThreshold) {
            this.mobileUi.setIsVisible(true);
            if (this.mobileUi.getToolspaceIsOpen()) {
                if (this.uiLayout === 'left') {
                    css(this.easel.getElement(), {
                        left: '271px',
                    });
                } else {
                    css(this.easel.getElement(), {
                        left: '0',
                    });
                }
                this.toolspace.style.display = 'block';
                this.easel.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
                this.statusOverlay.setWide(false);
            } else {
                if (this.uiLayout === 'left') {
                    css(this.easel.getElement(), {
                        left: '0',
                    });
                } else {
                    css(this.easel.getElement(), {
                        left: '0',
                    });
                }
                this.toolspace.style.display = 'none';
                this.easel.setSize(Math.max(0, this.uiWidth), this.uiHeight);
                this.statusOverlay.setWide(true);
            }
        } else {
            this.mobileColorUi.closeColorPicker();
            this.mobileUi.setIsVisible(false);
            if (this.uiLayout === 'left') {
                css(this.easel.getElement(), {
                    left: '271px',
                });
            }
            this.toolspace.style.display = 'block';
            this.easel.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
            this.statusOverlay.setWide(false);
        }
        this.mobileUi.update();
    }

    private updateBottomBar(): void {
        if (!this.bottomBar) {
            return;
        }
        const isVisible = this.toolspaceInner.scrollHeight + 40 < window.innerHeight;
        const newDisplay = isVisible ? '' : 'none';
        // check to prevent infinite MutationObserver loop in Pale Moon
        if (newDisplay !== this.bottomBarWrapper.style.display) {
            this.bottomBarWrapper.style.display = newDisplay;
        }
    }

    private updateUi(): void {
        this.toolspace.classList.toggle('kl-toolspace--left', this.uiLayout === 'left');
        this.toolspace.classList.toggle('kl-toolspace--right', this.uiLayout === 'right');
        if (this.uiLayout === 'left') {
            css(this.toolspace, {
                left: '0',
                right: '',
            });
            css(this.easel.getElement(), {
                left: '271px',
            });
        } else {
            css(this.toolspace, {
                left: '',
                right: '0',
            });
            css(this.easel.getElement(), {
                left: '0',
            });
        }
        this.statusOverlay.setUiState(this.uiLayout);
        this.layerPreview.setUiState(this.uiLayout);
        this.layersUi.setUiState(this.uiLayout);
        this.updateCollapse();
        this.toolspaceScroller.updateUiState(this.uiLayout);
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TKlAppParams) {
        this.embed = p.embed;
        // default 2048, unless your screen is bigger than that (that computer then probably has the horsepower for that)
        // but not larger than 4096 - a fairly arbitrary decision
        const maxCanvasSize = Math.min(
            4096,
            Math.max(2048, Math.max(window.screen.width, window.screen.height)),
        );
        this.uiLayout = (
            this.embed
                ? 'left'
                : LocalStorage.getItem('uiState')
                  ? LocalStorage.getItem('uiState')
                  : 'right'
        ) as TUiLayout;
        const projectStore = KL_INDEXED_DB.getIsAvailable() ? new ProjectStore() : undefined;
        this.rootEl = BB.el({
            className: 'g-root',
            css: {
                position: 'absolute',
                left: '0',
                top: '0',
                right: '0',
                bottom: '0',
            },
        });

        this.uiWidth = Math.max(0, window.innerWidth);
        this.uiHeight = Math.max(0, window.innerHeight);
        let exportType: TExportType = 'png';

        const initialWidth = Math.max(
            10,
            Math.min(
                maxCanvasSize,
                window.innerWidth < this.collapseThreshold
                    ? this.uiWidth
                    : this.uiWidth - this.toolWidth,
            ),
        );
        const initialHeight = Math.max(10, Math.min(maxCanvasSize, this.uiHeight));

        this.klHistory = new KlHistory({
            oldest: projectToComposed(
                p.project ?? {
                    projectId: randomUuid(),
                    width: initialWidth,
                    height: initialHeight,
                    layers: [
                        {
                            name: LANG('layers-layer') + ' 1', // not ideal
                            opacity: 1,
                            isVisible: true,
                            mixModeStr: 'source-over',
                            image: {
                                fill: BB.ColorConverter.toRgbStr({
                                    r: ERASE_COLOR,
                                    g: ERASE_COLOR,
                                    b: ERASE_COLOR,
                                }),
                            },
                        },
                    ],
                },
            ),
        });
        const klRecoveryManager = p.klRecoveryManager;
        if (klRecoveryManager) {
            klRecoveryManager.setKlHistory(this.klHistory);
            klRecoveryManager.setGetThumbnail((factor) => {
                return drawProject(this.klCanvas.getProject(), factor);
            });
        }
        if (p.project) {
            // attempt at freeing memory
            p.project.layers.forEach((layer) => {
                if (layer.image instanceof HTMLCanvasElement) {
                    BB.freeCanvas(layer.image);
                }
                layer.image = null as any;
            });
        }

        this.klCanvas = new KL.KlCanvas(this.klHistory, this.embed ? -1 : 1);
        const tempHistory = new KlTempHistory();
        let mainTabRow: TabRow | undefined = undefined;

        const clearLayer = (showStatus?: boolean, ignoreSelection?: boolean) => {
            applyUncommitted();
            const layerIndex = currentLayer.index;
            this.klCanvas.eraseLayer({
                layerIndex,
                useAlphaLock: layerIndex === 0 && !brushUiMap.eraserBrush.getIsTransparentBg(),
                useSelection: !ignoreSelection,
            });
            showStatus &&
                this.statusOverlay.out(
                    this.klCanvas.getSelection()
                        ? LANG('cleared-selected-area')
                        : LANG('cleared-layer'),
                    true,
                );
        };

        let currentColor = new BB.RGB(0, 0, 0);
        let currentBrushUi: TBrushUiInstance<any>;
        let currentBrushId: string;
        let lastNonEraserBrushId: string;
        let currentLayer: TKlCanvasLayer = this.klCanvas.getLayer(
            this.klCanvas.getLayerCount() - 1,
        );

        // when cycling through brushes you need to know the next non-eraser brush
        const getNextBrushId = (): string => {
            if (currentBrushId === 'eraserBrush') {
                return lastNonEraserBrushId;
            }
            const keyArr = Object.keys(brushUiMap).filter((item) => item !== 'eraserBrush');
            const i = keyArr.findIndex((item) => item === currentBrushId);
            return keyArr[(i + 1) % keyArr.length];
        };

        const sizeWatcher = (val: number) => {
            brushSettingService.emitSize(val);
            if (this.easelBrush) {
                this.easelBrush.setBrush({ radius: val });
            }
        };

        const brushSettingService = new KL.BrushSettingService({
            onSetColor: (color) => {
                this.klColorSlider.setColor(color);
                currentBrushUi.setColor(color);
                this.mobileColorUi.setColor(color);
                currentColor = BB.copyObj(color);
            },
            onSetSize: (size) => {
                currentBrushUi.setSize(size);
                this.easelBrush.setBrush({ radius: size });
            },
            onSetOpacity: (opacity) => {
                currentBrushUi.setOpacity(opacity);
            },
            onSetScatter: (scatter) => {
                currentBrushUi.setScatter(scatter);
            },
            onGetColor: () => this.klColorSlider.getColor(),
            onGetSize: () => brushUiMap[currentBrushId].getSize(),
            onGetOpacity: () => brushUiMap[currentBrushId].getOpacity(),
            onGetScatter: () => brushUiMap[currentBrushId].getScatter(),
            onGetSliderConfig: () => {
                return {
                    sizeSlider: KL.BRUSHES_UI[currentBrushId].sizeSlider,
                    opacitySlider: KL.BRUSHES_UI[currentBrushId].opacitySlider,
                    scatterSlider: KL.BRUSHES_UI[currentBrushId].scatterSlider,
                };
            },
        });

        const lineSmoothing = new LineSmoothing({
            smoothing: translateSmoothing(1),
        });
        this.lineSanitizer = new LineSanitizer();

        const drawEventChain = new BB.EventChain({
            chainArr: [this.lineSanitizer as any, lineSmoothing as any],
        });

        drawEventChain.setChainOut(((event: TDrawEvent) => {
            if (event.type === 'down') {
                this.toolspace.style.pointerEvents = 'none';
                currentBrushUi.startLine(event.x, event.y, event.pressure);
                this.easelBrush.setLastDrawEvent({ x: event.x, y: event.y });
                this.easel.requestRender();
            }
            if (event.type === 'move') {
                currentBrushUi.goLine(event.x, event.y, event.pressure, event.isCoalesced);
                this.easelBrush.setLastDrawEvent({ x: event.x, y: event.y });
                this.easel.requestRender();
            }
            if (event.type === 'up') {
                this.toolspace.style.pointerEvents = '';
                currentBrushUi.endLine();
                this.easel.requestRender();
            }
            if (event.type === 'line') {
                currentBrushUi.getBrush().drawLineSegment(event.x0, event.y0, event.x1, event.y1);
                this.easelBrush.setLastDrawEvent({ x: event.x1, y: event.y1 });
                this.easel.requestRender();
            }
        }) as any);

        let textToolSettings = {
            size: 20,
            align: 'left' as 'left' | 'center' | 'right',
            isBold: false,
            isItalic: false,
            font: 'sans-serif',
            letterSpacing: 0,
            lineHeight: 1,
            fill: {
                color: { r: 0, g: 0, b: 0, a: 1 },
            },
        } as TRenderTextParam;

        /**
         * Uncommited action is something like select tool > transform which puts the canvas and UI into
         * a temporary state. Changes need to be committed or discarded *before* doing something else.
         *
         * returns true if something was applied
         */
        const applyUncommitted = (): boolean => {
            let didApply = false;
            if (this.easel.getTool() === 'select') {
                didApply = klAppSelect.commitTransform();
            }
            return didApply;
        };

        /** see applyUncommitted **/
        const discardUncommitted = (): boolean => {
            if (this.easel.getTool() === 'select') {
                return klAppSelect.discardTransform();
            }
            return false;
        };

        const propagateUndoRedoChanges = (
            type: THistoryExecutionType,
            composedBefore: THistoryEntryDataComposed,
        ) => {
            if (['undo', 'redo'].includes(type)) {
                const composedAfter = this.klHistory.getComposed();

                this.klCanvas.updateViaComposed(composedBefore!, composedAfter);

                setCurrentLayer(
                    this.klCanvas.getLayer(
                        composedAfter.layerMap[composedAfter.activeLayerId].index,
                    ),
                );
                this.easelProjectUpdater.update(); // triggers render

                const dimensionChanged =
                    composedBefore.size.width !== composedAfter.size.width ||
                    composedBefore.size.height !== composedAfter.size.height;
                if (dimensionChanged) {
                    this.easel.resetOrFitTransform(true);
                }
                this.easelBrush.setLastDrawEvent();
                this.layersUi.update(currentLayer.index);
            }

            klAppSelect.onHistory(type);
        };

        const undo = (showMessage?: boolean) => {
            if (!tempHistory.canDecreaseIndex()) {
                discardUncommitted();
            }
            const composedBefore = this.klHistory.getComposed();
            const result = klHistoryExecutor.undo();
            if (!result) {
                // didn't do anything
                return;
            }
            propagateUndoRedoChanges(result.type, composedBefore);
            if (showMessage) {
                this.statusOverlay.out(LANG('undo'), true);
            }
        };

        const redo = (showMessage?: boolean) => {
            const composedBefore = this.klHistory.getComposed();
            const result = klHistoryExecutor.redo();
            if (!result) {
                // didn't do anything
                return;
            }
            propagateUndoRedoChanges(result.type, composedBefore);
            if (showMessage) {
                this.statusOverlay.out(LANG('redo'), true);
            }
        };

        this.statusOverlay = new KL.StatusOverlay();

        const klAppSelect = new KlAppSelect({
            klCanvas: this.klCanvas,
            getCurrentLayerCtx: () => currentLayer.context,
            onUpdateProject: () => this.easelProjectUpdater.update(),
            klHistory: this.klHistory,
            tempHistory,
            statusOverlay: this.statusOverlay,
            onFill: () => {
                this.klCanvas.layerFill(
                    currentLayer.index,
                    this.klColorSlider.getColor(),
                    undefined,
                    true,
                );
                this.statusOverlay.out(
                    this.klCanvas.getSelection() ? LANG('filled-selected-area') : LANG('filled'),
                    true,
                );
            },
            onErase: () => {
                const layerIndex = currentLayer.index;
                this.klCanvas.eraseLayer({
                    layerIndex,
                    useAlphaLock: layerIndex === 0 && !brushUiMap.eraserBrush.getIsTransparentBg(),
                    useSelection: true,
                });
                this.statusOverlay.out(
                    this.klCanvas.getSelection()
                        ? LANG('cleared-selected-area')
                        : LANG('cleared-layer'),
                    true,
                );
            },
        });

        this.easelBrush = new EaselBrush({
            radius: 5,
            onLineStart: (e) => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'down',
                    scale: this.easel.getTransform().scale,
                    shiftIsPressed: keyListener.isPressed('shift'),
                    pressure: e.pressure,
                    isCoalesced: e.isCoalesced,
                    x: e.x,
                    y: e.y,
                } as any);
            },
            onLineGo: (e) => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'move',
                    scale: this.easel.getTransform().scale,
                    shiftIsPressed: keyListener.isPressed('shift'),
                    pressure: e.pressure,
                    isCoalesced: e.isCoalesced,
                    x: e.x,
                    y: e.y,
                } as any);
            },
            onLineEnd: () => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'up',
                    scale: this.easel.getTransform().scale,
                    shiftIsPressed: keyListener.isPressed('shift'),
                    isCoalesced: false,
                } as any);
            },
            onLine: (p1, p2) => {
                // expects TDrawEvent
                drawEventChain.chainIn({
                    type: 'line',
                    x0: p1.x,
                    y0: p1.y,
                    x1: p2.x,
                    y1: p2.y,
                    pressure0: 1,
                    pressure1: 1,
                } as any);
            },
        });

        const easelHand = new EaselHand({});
        const easelShape = new EaselShape({
            onDown: (p, angleRad) => {
                shapeTool.onDown(p.x, p.y, angleRad);
            },
            onMove: (p) => {
                shapeTool.onMove(p.x, p.y);
            },
            onUp: (p) => {
                shapeTool.onUp(p.x, p.y);
            },
        });

        let isFirstTransform = true;
        this.easel = new Easel({
            width: Math.max(0, this.uiWidth - this.toolWidth),
            height: this.uiHeight,
            project: {
                width: this.klCanvas.getWidth(),
                height: this.klCanvas.getHeight(),
                layers: [],
            }, // temp
            tools: {
                brush: this.easelBrush,
                hand: easelHand,
                select: klAppSelect.getEaselSelect(),
                eyedropper: new EaselEyedropper({
                    onPick: (p) => {
                        const color = this.klCanvas.getColorAt(p.x, p.y);
                        brushSettingService.setColor(color);
                        return color;
                    },
                    onPickEnd: () => {
                        if (
                            this.klColorSlider.getIsEyedropping() ||
                            this.mobileColorUi.getIsEyedropping()
                        ) {
                            this.klColorSlider.setIsEyedropping(false);
                            this.mobileColorUi.setIsEyedropping(false);
                            this.easel.setTool(this.toolspaceToolRow.getActive());
                        }
                    },
                }),
                paintBucket: new EaselPaintBucket({
                    onFill: (p) => {
                        this.klCanvas.floodFill(
                            currentLayer.index,
                            p.x,
                            p.y,
                            fillUi.getIsEraser() ? null : this.klColorSlider.getColor(),
                            fillUi.getOpacity(),
                            fillUi.getTolerance(),
                            fillUi.getSample(),
                            fillUi.getGrow(),
                            fillUi.getContiguous(),
                        );
                        this.easel.requestRender();
                    },
                }),
                gradient: new EaselGradient({
                    onDown: (p, angleRad) => {
                        gradientTool.onDown(p.x, p.y, angleRad);
                    },
                    onMove: (p) => {
                        gradientTool.onMove(p.x, p.y);
                    },
                    onUp: (p) => {
                        gradientTool.onUp(p.x, p.y);
                    },
                }),
                text: new EaselText({
                    onDown: (p, angleRad) => {
                        if (KL.DIALOG_COUNTER.get() > 0) {
                            return;
                        }

                        KL.textToolDialog({
                            klCanvas: this.klCanvas,
                            layerIndex: currentLayer.index,
                            primaryColor: this.klColorSlider.getColor(),
                            secondaryColor: this.klColorSlider.getSecondaryRGB(),

                            text: {
                                ...textToolSettings,
                                text: '',
                                x: p.x,
                                y: p.y,
                                angleRad: angleRad,
                                fill: textToolSettings.fill
                                    ? {
                                          color: {
                                              ...this.klColorSlider.getColor(),
                                              a: textToolSettings.fill.color.a,
                                          },
                                      }
                                    : undefined,
                                stroke: textToolSettings.stroke
                                    ? {
                                          ...textToolSettings.stroke,
                                          color: {
                                              ...this.klColorSlider.getSecondaryRGB(),
                                              a: textToolSettings.stroke.color.a,
                                          },
                                      }
                                    : undefined,
                            },

                            onConfirm: (val) => {
                                textToolSettings = {
                                    ...val,
                                    text: '',
                                };
                                this.klCanvas.text(currentLayer.index, val);
                            },
                        });
                    },
                }),
                shape: easelShape,
                rotate: new EaselRotate({}),
                zoom: new EaselZoom({}),
            },
            tool: 'brush',
            onChangeTool: (toolId) => {
                this.mobileBrushUi.setIsVisible(toolId === 'brush');
                this.mobileColorUi.setIsVisible(toolId !== 'select');
            },
            onTransformChange: (transform, isScaleOrAngleChanged) => {
                handUi.update(transform.scale, transform.angleDeg);
                this.toolspaceToolRow.setEnableZoomIn(transform.scale !== EASEL_MAX_SCALE);
                this.toolspaceToolRow.setEnableZoomOut(transform.scale !== EASEL_MIN_SCALE);

                if (isScaleOrAngleChanged && !isFirstTransform) {
                    this.statusOverlay.out({
                        type: 'transform',
                        scale: transform.scale,
                        angleDeg: transform.angleDeg,
                    });
                }
                if (isFirstTransform) {
                    isFirstTransform = false;
                }
            },
            onUndo: () => {
                undo(true);
            },
            onRedo: () => {
                redo(true);
            },
        });
        css(this.easel.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
        });
        this.easelProjectUpdater = new EaselProjectUpdater({
            klCanvas: this.klCanvas,
            easel: this.easel,
        });
        this.klHistory.addListener(() => {
            this.easelProjectUpdater.update();
        });
        KL.DIALOG_COUNTER.subscribe((count) => {
            this.easel.setIsFrozen(count > 0);
        });

        const updateMainTabVisibility = () => {
            if (!mainTabRow) {
                return;
            }

            const toolObj = {
                brush: {},
                hand: {},
                paintBucket: {},
                gradient: {},
                text: {},
                shape: {},
                select: {},
            };

            const activeStr = this.toolspaceToolRow.getActive();
            const oldTabId = mainTabRow.getOpenedTabId();

            const keysArr = Object.keys(toolObj);
            for (let i = 0; i < keysArr.length; i++) {
                if (activeStr === keysArr[i]) {
                    mainTabRow.setIsVisible(keysArr[i], true);
                } else {
                    mainTabRow.setIsVisible(keysArr[i], false);
                    if (oldTabId === keysArr[i]) {
                        mainTabRow.open(activeStr);
                    }
                }
            }
        };

        const keyListener = new BB.KeyListener({
            onDown: (keyStr, event, comboStr) => {
                if (KL.DIALOG_COUNTER.get() > 0 || BB.isInputFocused(true)) {
                    return;
                }

                const isDrawing = this.lineSanitizer.getIsDrawing() || this.easel.getIsLocked();
                if (isDrawing) {
                    return;
                }

                if (comboStr === 'home') {
                    this.easel.fitTransform();
                }
                if (comboStr === 'end') {
                    this.easel.resetTransform();
                }
                if (['ctrl+z', 'cmd+z'].includes(comboStr)) {
                    event.preventDefault();
                    undo();
                }
                if (
                    ['ctrl+y', 'cmd+y'].includes(comboStr) ||
                    ((BB.sameKeys('ctrl+shift+z', comboStr) ||
                        BB.sameKeys('cmd+shift+z', comboStr)) &&
                        keyStr === 'z')
                ) {
                    event.preventDefault();
                    redo();
                }
                if (!this.embed) {
                    if (['ctrl+s', 'cmd+s'].includes(comboStr)) {
                        event.preventDefault();
                        applyUncommitted();
                        this.saveToComputer.save();
                    }
                    if (['ctrl+shift+s', 'cmd+shift+s'].includes(comboStr)) {
                        event.preventDefault();
                        applyUncommitted();
                        if (projectStore) {
                            (async () => {
                                await requestPersistentStorage();

                                const meta = projectStore!.getCurrentMeta();
                                const project = this.getProject();

                                if (meta && meta.projectId !== project.projectId) {
                                    const doOverwrite = await new Promise<boolean>(
                                        (resolve, reject) => {
                                            showModal({
                                                target: document.body,
                                                type: 'warning',
                                                message: LANG('file-storage-overwrite-confirm'),
                                                buttons: [LANG('file-storage-overwrite'), 'Cancel'],
                                                callback: async (result) => {
                                                    if (result === 'Cancel') {
                                                        resolve(false);
                                                        return;
                                                    }
                                                    resolve(true);
                                                },
                                            });
                                        },
                                    );
                                    if (!doOverwrite) {
                                        return;
                                    }
                                }

                                let success = true;
                                try {
                                    await projectStore!.store(this.klCanvas.getProject());
                                } catch (e) {
                                    success = false;
                                    setTimeout(() => {
                                        throw new Error(
                                            'keyboard-shortcut: failed to store browser storage, ' +
                                                e,
                                        );
                                    }, 0);
                                    this.statusOverlay.out(
                                        '❌ ' + LANG('file-storage-failed'),
                                        true,
                                    );
                                }
                                if (success) {
                                    this.updateLastSaved();
                                    this.statusOverlay.out(LANG('file-storage-stored'), true);
                                }
                            })();
                        } else {
                            this.statusOverlay.out('❌ ' + LANG('file-storage-failed'), true);
                        }
                    }
                    if (['ctrl+c', 'cmd+c'].includes(comboStr)) {
                        event.preventDefault();
                        applyUncommitted();
                        copyToClipboard(true);
                    }
                }
                if (['ctrl+a', 'cmd+a'].includes(comboStr)) {
                    event.preventDefault();
                }

                if (comboStr === 'sqbr_open') {
                    currentBrushUi.decreaseSize(
                        Math.max(0.005, 0.03 / this.easel.getTransform().scale),
                    );
                }
                if (comboStr === 'sqbr_close') {
                    currentBrushUi.increaseSize(
                        Math.max(0.005, 0.03 / this.easel.getTransform().scale),
                    );
                }
                if (comboStr === 'enter') {
                    if (!applyUncommitted()) {
                        this.klCanvas.layerFill(
                            currentLayer.index,
                            this.klColorSlider.getColor(),
                            undefined,
                            true,
                        );
                        this.statusOverlay.out(
                            this.klCanvas.getSelection()
                                ? LANG('filled-selected-area')
                                : LANG('filled'),
                            true,
                        );
                    }
                }
                if (comboStr === 'esc') {
                    if (discardUncommitted()) {
                        event.preventDefault();
                    }
                }
                if (['delete', 'backspace'].includes(comboStr)) {
                    clearLayer(true);
                }
                if (comboStr === 'ctrl+shift+e' || comboStr === 'shift+ctrl+e') {
                    event.preventDefault();
                    this.layersUi.advancedMergeDialog();
                }
                if (comboStr === 'shift+e') {
                    event.preventDefault();
                    currentBrushUi.toggleEraser?.();
                } else if (comboStr === 'e') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('brush');
                    this.toolspaceToolRow.setActive('brush');
                    mainTabRow?.open('brush');
                    updateMainTabVisibility();
                    brushTabRow.open('eraserBrush');
                }
                if (comboStr === 'b') {
                    event.preventDefault();
                    applyUncommitted();
                    const prevMode = this.easel.getTool();
                    this.easel.setTool('brush');
                    this.toolspaceToolRow.setActive('brush');
                    mainTabRow?.open('brush');
                    updateMainTabVisibility();
                    brushTabRow.open(prevMode === 'brush' ? getNextBrushId() : currentBrushId);
                }
                if (comboStr === 'g') {
                    event.preventDefault();
                    applyUncommitted();
                    const newMode =
                        this.easel.getTool() === 'paintBucket' ? 'gradient' : 'paintBucket';
                    this.easel.setTool(newMode);
                    this.toolspaceToolRow.setActive(newMode);
                    mainTabRow?.open(newMode);
                    updateMainTabVisibility();
                }
                if (comboStr === 't') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('text');
                    this.toolspaceToolRow.setActive('text');
                    mainTabRow?.open('text');
                    updateMainTabVisibility();
                }
                if (comboStr === 'u') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('shape');
                    this.toolspaceToolRow.setActive('shape');
                    mainTabRow?.open('shape');
                    updateMainTabVisibility();
                }
                if (comboStr === 'l') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('select');
                    this.toolspaceToolRow.setActive('select');
                    mainTabRow?.open('select');
                    updateMainTabVisibility();
                }
                if (comboStr === 'x') {
                    event.preventDefault();
                    this.klColorSlider.swapColors();
                }
            },
            onUp: (keyStr, event) => {},
        });

        const brushUiMap: {
            [key: string]: any;
        } = {};
        // create brush UIs
        Object.entries(KL.BRUSHES_UI).forEach(([b, brushUi]) => {
            const ui = new (brushUi.Ui as any)({
                klHistory: this.klHistory,
                onSizeChange: sizeWatcher,
                onScatterChange: (scatter: number) => {
                    brushSettingService.emitScatter(scatter);
                },
                onOpacityChange: (opacity: number) => {
                    brushSettingService.emitOpacity(opacity);
                },
                onConfigChange: () => {
                    brushSettingService.emitSliderConfig({
                        sizeSlider: KL.BRUSHES_UI[currentBrushId].sizeSlider,
                        opacitySlider: KL.BRUSHES_UI[currentBrushId].opacitySlider,
                        scatterSlider: KL.BRUSHES_UI[currentBrushId].scatterSlider,
                    });
                },
            });
            brushUiMap[b] = ui;
            ui.getElement().style.padding = 10 + 'px';
        });

        this.toolspace = BB.el({
            className: 'kl-toolspace',
            css: {
                position: 'absolute',
                right: '0',
                top: '0',
                bottom: '0',
                width: this.toolWidth + 'px',
                overflow: 'hidden',
                userSelect: 'none',
                touchAction: 'none',
            },
        });
        this.toolspaceInner = BB.el({
            parent: this.toolspace,
        });
        this.toolspace.oncontextmenu = () => {
            return false;
        };
        this.toolspace.onclick = BB.handleClick;

        this.mobileBrushUi = new MobileBrushUi({
            onBrush: () => {
                brushTabRow.open(lastNonEraserBrushId);
            },
            onEraser: () => {
                brushTabRow.open('eraserBrush');
            },
        });
        this.mobileColorUi = new MobileColorUi({
            onEyedropper: (isActive) => {
                if (isActive) {
                    this.klColorSlider.setIsEyedropping(true);
                    this.easel.setTool('eyedropper');
                } else {
                    this.klColorSlider.setIsEyedropping(false);
                    this.easel.setTool(this.toolspaceToolRow.getActive());
                }
            },
            color: currentColor,
            onColorChange: (c) => {
                brushSettingService.setColor(c);
            },
        });

        this.mobileUi = new MobileUi({
            onShowToolspace: (b) => {
                this.mobileColorUi.closeColorPicker();
                this.updateCollapse();
            },
            toolUis: [this.mobileBrushUi.getElement(), this.mobileColorUi.getElement()],
        });

        this.updateCollapse(true);

        let overlayToolspace;
        setTimeout(() => {
            overlayToolspace = new KL.OverlayToolspace({
                enabledTest: () => {
                    return KL.DIALOG_COUNTER.get() === 0 && !this.easel.getIsLocked();
                },
                brushSettingService,
            });
            this.rootEl.append(overlayToolspace.getElement());
        }, 0);

        BB.append(this.rootEl, [
            this.easel.getElement(),
            // this.klCanvasWorkspace.getElement(),
            this.toolspace,
            this.mobileUi.getElement(),
        ]);

        let toolspaceTopRow;
        if (this.embed) {
            toolspaceTopRow = new EmbedToolspaceTopRow({
                onHelp: () => {
                    showIframeModal(this.embed!.url + '/help.html', !!this.embed);
                },
                onSubmit: () => {
                    applyUncommitted();
                    const onFailure = () => {
                        let closeFunc: () => void;
                        const saveBtn = BB.el({
                            tagName: 'button',
                            textContent: LANG('save-reminder-save-psd'),
                            css: {
                                display: 'block',
                            },
                        });
                        saveBtn.onclick = () => {
                            this.saveAsPsd();
                            closeFunc();
                        };
                        KL.popup({
                            target: this.rootEl,
                            message: '<b>' + LANG('upload-failed') + '</b>',
                            div: BB.el({
                                content: [
                                    BB.el({
                                        content: LANG('backup-drawing'),
                                        css: {
                                            marginBottom: '10px',
                                        },
                                    }),
                                    saveBtn,
                                ],
                            }),
                            ignoreBackground: true,
                            closeFunc: (f) => {
                                closeFunc = f;
                            },
                        });
                    };

                    KL.popup({
                        target: this.rootEl,
                        message: LANG('submit-prompt'),
                        buttons: [LANG('submit'), 'Cancel'],
                        callback: async (result) => {
                            if (result !== LANG('submit')) {
                                return;
                            }

                            const overlay = BB.el({
                                parent: this.rootEl,
                                className: 'upload-overlay',
                                content: '<div class="spinner"></div> ' + LANG('submit-submitting'),
                            });

                            this.embed!.onSubmit(
                                () => {
                                    this.updateLastSaved();
                                    overlay.remove();
                                },
                                () => {
                                    overlay.remove();
                                    onFailure();
                                },
                            );
                        },
                    });
                },
                onLeftRight: () => {
                    this.uiLayout = this.uiLayout === 'left' ? 'right' : 'left';
                    this.updateUi();
                },
            });
        } else {
            toolspaceTopRow = new KL.ToolspaceTopRow({
                logoImg: p.logoImg!,
                onLogo: () => {
                    showIframeModal('./home/', !!this.embed);
                },
                onNew: () => {
                    showNewImageDialog();
                },
                onImport: () => {
                    fileUi!.triggerImport();
                },
                onSave: () => {
                    this.saveToComputer.save();
                },
                onShare: () => {
                    shareImage();
                },
                onHelp: () => {
                    showIframeModal('./help/', !!this.embed);
                },
            });
        }
        toolspaceTopRow.getElement().style.marginBottom = '10px';
        this.toolspaceInner.append(toolspaceTopRow.getElement());

        this.toolspaceToolRow = new KL.ToolspaceToolRow({
            onActivate: (activeStr) => {
                if (activeStr !== 'hand') {
                    // hand only one that doesn't cause changes
                    applyUncommitted();
                }

                if (activeStr === 'brush') {
                    this.easel.setTool('brush');
                } else if (activeStr === 'hand') {
                    this.easel.setTool('hand');
                } else if (activeStr === 'paintBucket') {
                    this.easel.setTool('paintBucket');
                } else if (activeStr === 'gradient') {
                    this.easel.setTool('gradient');
                } else if (activeStr === 'text') {
                    this.easel.setTool('text');
                } else if (activeStr === 'shape') {
                    this.easel.setTool('shape');
                } else if (activeStr === 'select') {
                    // this.klCanvasWorkspace.setMode('shape');
                    this.easel.setTool('select');
                } else {
                    throw new Error('unknown activeStr');
                }
                mainTabRow?.open(activeStr);
                updateMainTabVisibility();
                this.klColorSlider.setIsEyedropping(false);
                this.mobileColorUi.setIsEyedropping(false);
            },
            onZoomIn: () => {
                const oldScale = this.easel.getTransform().scale;
                const newScale = zoomByStep(
                    oldScale,
                    keyListener.isPressed('shift') ? 1 / 8 : 1 / 2,
                );
                this.easel.scale(newScale / oldScale);
            },
            onZoomOut: () => {
                const oldScale = this.easel.getTransform().scale;
                const newScale = zoomByStep(
                    oldScale,
                    keyListener.isPressed('shift') ? -1 / 8 : -1 / 2,
                );
                this.easel.scale(newScale / oldScale);
            },
            onUndo: () => {
                undo();
            },
            onRedo: () => {
                redo();
            },
        });
        this.toolspaceToolRow.setIsSmall(this.uiHeight < 540);
        this.toolspaceInner.append(this.toolspaceToolRow.getElement());

        const setBrushColor = (p_color: TRgb) => {
            currentColor = p_color;
            currentBrushUi.setColor(p_color);
            brushSettingService.emitColor(p_color);
            this.mobileColorUi.setColor(p_color);
            this.klColorSlider.setIsEyedropping(false);
            this.mobileColorUi.setIsEyedropping(false);
        };

        this.klColorSlider = new KL.KlColorSlider({
            width: 250,
            height: 30,
            svHeight: 100,
            startValue: new BB.RGB(0, 0, 0),
            onPick: setBrushColor,
            onEyedropper: (isActive) => {
                if (isActive) {
                    this.mobileColorUi.setIsEyedropping(true);
                    this.easel.setTool('eyedropper');
                } else {
                    this.mobileColorUi.setIsEyedropping(false);
                    this.easel.setTool(this.toolspaceToolRow.getActive());
                }
            },
        });
        this.klColorSlider.setHeight(Math.max(163, Math.min(400, this.uiHeight - 505)));

        const setCurrentBrush = (brushId: string) => {
            if (brushId !== 'eraserBrush') {
                lastNonEraserBrushId = brushId;
            }

            if (this.klColorSlider) {
                if (brushId === 'eraserBrush') {
                    this.klColorSlider.enable(false);
                } else {
                    this.klColorSlider.enable(true);
                }
            }

            currentBrushId = brushId;
            currentBrushUi = brushUiMap[brushId];
            currentBrushUi.setColor(currentColor);
            currentBrushUi.setLayer(currentLayer);
            this.easelBrush.setBrush({
                type: currentBrushId === 'pixelBrush' ? 'pixel-square' : 'round',
            });
            this.toolspaceToolRow.setActive('brush');
            updateMainTabVisibility();
        };

        const setCurrentLayer = (layer: TKlCanvasLayer) => {
            currentLayer = layer;
            currentBrushUi.setLayer(currentLayer);
            this.layerPreview.setLayer(currentLayer);
        };

        const brushDiv = BB.el();
        const colorDiv = BB.el({
            css: {
                margin: '10px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
            },
        });
        const toolspaceStabilizerRow = new KL.ToolspaceStabilizerRow({
            smoothing: 1,
            onSelect: (v) => {
                lineSmoothing.setSmoothing(translateSmoothing(v));
            },
        });

        brushDiv.append(colorDiv);
        BB.append(colorDiv, [
            this.klColorSlider.getElement(),
            this.klColorSlider.getOutputElement(),
            toolspaceStabilizerRow.getElement(),
        ]);

        const brushTabRow = new KL.TabRow({
            initialId: 'penBrush',
            useAccent: true,
            tabArr: (() => {
                const result = [];

                const createTab = (keyStr: string) => {
                    return {
                        id: keyStr,
                        image: KL.BRUSHES_UI[keyStr].image,
                        title: KL.BRUSHES_UI[keyStr].tooltip,
                        onOpen: () => {
                            brushUiMap[keyStr].getElement().style.display = 'block';
                            setCurrentBrush(keyStr);
                            this.klColorSlider.setIsEyedropping(false);
                            this.mobileColorUi.setIsEyedropping(false);
                            brushSettingService.emitSliderConfig({
                                sizeSlider: KL.BRUSHES_UI[keyStr].sizeSlider,
                                opacitySlider: KL.BRUSHES_UI[keyStr].opacitySlider,
                                scatterSlider: KL.BRUSHES_UI[keyStr].scatterSlider,
                            });
                            sizeWatcher(brushUiMap[keyStr].getSize());
                            brushSettingService.emitOpacity(brushUiMap[keyStr].getOpacity());
                            this.mobileBrushUi.setType(
                                keyStr === 'eraserBrush' ? 'eraser' : 'brush',
                            );
                        },
                        onClose: () => {
                            brushUiMap[keyStr].getElement().style.display = 'none';
                        },
                    };
                };

                const keyArr = Object.keys(brushUiMap);
                for (let i = 0; i < keyArr.length; i++) {
                    result.push(createTab(keyArr[i]));
                }
                return result;
            })(),
        });
        BB.append(brushDiv, [
            brushTabRow.getElement(),
            ...Object.entries(KL.BRUSHES_UI).map(([b]) => brushUiMap[b].getElement()),
        ]);

        const handUi = new KL.HandUi({
            scale: this.easel.getTransform().scale,
            angleDeg: 0,
            onReset: () => {
                this.easel.resetTransform();
            },
            onFit: () => {
                this.easel.fitTransform();
            },
            onAngleChange: (angleDeg, isRelative) => {
                this.easel.setAngleDeg(angleDeg, isRelative);
            },
            onChangeUseInertiaScrolling: (b) => {
                easelHand.setUseInertiaScrolling(b);
            },
        });

        const fillUi = new KL.FillUi({
            colorSlider: this.klColorSlider,
        });

        const gradientUi = new KL.GradientUi({
            colorSlider: this.klColorSlider,
        });

        const textUi = new KL.TextUi({
            colorSlider: this.klColorSlider,
        });

        const shapeUi = new KL.ShapeUi({
            colorSlider: this.klColorSlider,
            onChangePanning: (doPan) => easelShape.setPanning(doPan),
        });

        const gradientTool = new KL.GradientTool({
            onGradient: (isDone, x1, y1, x2, y2, angleRad) => {
                const layerIndex = currentLayer.index;
                const settings = gradientUi.getSettings();
                const gradientObj: TGradient = {
                    type: settings.type,
                    color1: this.klColorSlider.getColor(),
                    isReversed: settings.isReversed,
                    opacity: settings.opacity,
                    doLockAlpha: settings.doLockAlpha,
                    isEraser: settings.isEraser,
                    doSnap: keyListener.isPressed('shift') || settings.doSnap,
                    x1,
                    y1,
                    x2,
                    y2,
                    angleRad,
                };

                if (isDone) {
                    this.klCanvas.setComposite(layerIndex, undefined);
                    this.klCanvas.drawGradient(layerIndex, gradientObj);
                } else {
                    const selection = this.klCanvas.getSelection();
                    const selectionPath = selection
                        ? new Path2D(getSelectionPath2d(selection))
                        : undefined;
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawGradient(ctx, gradientObj, selectionPath);
                        },
                    });
                }

                this.easelProjectUpdater.update();
            },
        });

        const shapeTool = new KL.ShapeTool({
            onShape: (isDone, x1, y1, x2, y2, angleRad) => {
                const layerIndex = currentLayer.index;

                const shapeObj: any = {
                    type: shapeUi.getShape(),
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2,
                    angleRad: angleRad,
                    isOutwards: shapeUi.getIsOutwards(),
                    opacity: shapeUi.getOpacity(),
                    isEraser: shapeUi.getIsEraser(),
                    doLockAlpha: shapeUi.getDoLockAlpha(),
                };
                if (shapeUi.getShape() === 'line') {
                    shapeObj.strokeRgb = this.klColorSlider.getColor();
                    shapeObj.lineWidth = shapeUi.getLineWidth();
                    shapeObj.isAngleSnap = shapeUi.getIsSnap() || keyListener.isPressed('shift');
                } else {
                    shapeObj.isFixedRatio = shapeUi.getIsFixed() || keyListener.isPressed('shift');
                    if (shapeUi.getMode() === 'stroke') {
                        shapeObj.strokeRgb = this.klColorSlider.getColor();
                        shapeObj.lineWidth = shapeUi.getLineWidth();
                    } else {
                        shapeObj.fillRgb = this.klColorSlider.getColor();
                    }
                }

                if (isDone) {
                    this.klCanvas.setComposite(layerIndex, undefined);
                    this.klCanvas.drawShape(layerIndex, shapeObj);
                } else {
                    const selection = this.klCanvas.getSelection();
                    const selectionPath = selection
                        ? new Path2D(getSelectionPath2d(selection))
                        : undefined;
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawShape(ctx, shapeObj, selectionPath);
                        },
                    });
                }

                this.easelProjectUpdater.update();
            },
        });

        this.layersUi = new KL.LayersUi({
            klCanvas: this.klCanvas,
            onSelect: (layerIndex, pushHistory) => {
                const activeLayer = this.klCanvas.getLayer(layerIndex);
                setCurrentLayer(activeLayer);

                if (pushHistory) {
                    const topEntry = this.klHistory.getEntries().at(-1)!.data;
                    const replaceTop = isHistoryEntryActiveLayerChange(topEntry);

                    this.klHistory.push(
                        {
                            activeLayerId: activeLayer.id,
                        },
                        replaceTop,
                    );
                }
            },
            parentEl: this.rootEl,
            uiState: this.uiLayout,
            applyUncommitted: () => applyUncommitted(),
            klHistory: this.klHistory,
            onUpdateProject: () => this.easelProjectUpdater.update(),
            onClearLayer: () => clearLayer(false, true),
        });
        this.layerPreview = new KL.LayerPreview({
            klRootEl: this.rootEl,
            onClick: () => {
                mainTabRow?.open('layers');
            },
            uiState: this.uiLayout,
            klHistory: this.klHistory,
        });
        this.layerPreview.setIsVisible(this.uiHeight >= 579);
        this.layerPreview.setLayer(currentLayer);

        const editUi = new KL.EditUi({
            klRootEl: this.rootEl,
            klColorSlider: this.klColorSlider,
            layersUi: this.layersUi,
            getCurrentColor: () => currentColor,
            maxCanvasSize,
            klCanvas: this.klCanvas,
            getCurrentLayer: () => currentLayer,
            isEmbed: !!this.embed,
            statusOverlay: this.statusOverlay,
            onCanvasChanged: () => {
                this.easelProjectUpdater.update();
                this.easel.resetOrFitTransform(true);
            },
            applyUncommitted: () => applyUncommitted(),
            klHistory: this.klHistory,
            onCopyToClipboard: () => {
                applyUncommitted();
                copyToClipboard(false, false);
            },
            onPaste: () => importHandler.readClipboard(),
        });

        const klHistoryExecutor = new KlHistoryExecutor({
            klHistory: this.klHistory,
            tempHistory,
            onCanUndoRedoChange: (canUndo, canRedo) => {
                this.toolspaceToolRow.setEnableUndo(canUndo);
                this.toolspaceToolRow.setEnableRedo(canRedo);
            },
        });

        const showNewImageDialog = () => {
            applyUncommitted();
            KL.newImageDialog({
                currentColor: currentColor,
                secondaryColor: this.klColorSlider.getSecondaryRGB(),
                maxCanvasSize,
                canvasWidth: this.klCanvas.getWidth(),
                canvasHeight: this.klCanvas.getHeight(),
                workspaceWidth:
                    window.innerWidth < this.collapseThreshold
                        ? this.uiWidth
                        : this.uiWidth - this.toolWidth,
                workspaceHeight: this.uiHeight,
                onConfirm: (width, height, color) => {
                    this.klCanvas.reset({
                        width: width,
                        height: height,
                        color: color.a === 1 ? color : undefined,
                    });

                    this.layersUi.update(0);
                    setCurrentLayer(this.klCanvas.getLayer(0));
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform(true);
                },
                onCancel: () => {},
            });
        };

        const shareImage = (callback?: () => void) => {
            applyUncommitted();
            BB.shareCanvas({
                canvas: this.klCanvas.getCompleteCanvas(1),
                fileName: BB.getDate() + KL_CONFIG.filenameBase + '.png',
                title: BB.getDate() + KL_CONFIG.filenameBase + '.png',
                callback: callback ? callback : () => {},
            });
        };

        this.saveToComputer = new KL.SaveToComputer(
            () => exportType,
            this.klCanvas,
            () => {
                this.updateLastSaved();
            },
        );

        const copyToClipboard = (showCrop: boolean = false, closeOnBlur: boolean = true) => {
            KL.clipboardDialog(
                this.rootEl,
                (maskSelection) => {
                    return this.klCanvas.getCompleteCanvas(1, maskSelection);
                },
                (inputObj) => {
                    if (
                        inputObj.left === 0 &&
                        inputObj.right === 0 &&
                        inputObj.top === 0 &&
                        inputObj.bottom === 0
                    ) {
                        return;
                    }
                    //do a crop
                    KL.FILTER_LIB.cropExtend.apply!({
                        layer: currentLayer,
                        klCanvas: this.klCanvas,
                        input: inputObj,
                        klHistory: this.klHistory,
                    });
                    this.layersUi.update();
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform(true);
                },
                this.statusOverlay,
                showCrop || false,
                closeOnBlur,
                this.klCanvas.getSelection(),
            );
        };

        const onOpenBrowserStorage = async () => {
            const showFailureMessage = () => {
                KL.popup({
                    target: this.rootEl,
                    message: LANG('file-storage-open-failed'),
                    type: 'error',
                });
            };

            if (!projectStore) {
                showFailureMessage();
                return;
            }
            const meta = projectStore.getCurrentMeta();

            // Check is project already opened in other tab.
            // (if it's already open in the current tab, user showed intentionality. Don't ask again.)
            if (meta && this.klHistory.getComposed().projectId.value !== meta.projectId) {
                let doOpen = true;
                const crossTabChannel = new CrossTabChannel('kl-tab-communication');

                const openedProjectIds: string[] = [];
                const otherIdListener = (message: any) => {
                    if (message.type === 'response-project-id') {
                        openedProjectIds.push(message.id);
                    }
                };
                crossTabChannel.subscribe(otherIdListener);
                crossTabChannel.postMessage({ type: 'request-project-ids' });
                await sleep(100);
                crossTabChannel.unsubscribe(otherIdListener);

                if (meta && openedProjectIds.includes(meta.projectId)) {
                    doOpen = await new Promise<boolean>((resolve, reject) => {
                        showModal({
                            target: document.body,
                            message: LANG('file-storage-open-confirmation'),
                            buttons: [LANG('file-storage-open'), 'Cancel'],
                            callback: async (result) => {
                                if (result === 'Cancel') {
                                    resolve(false);
                                    return;
                                }
                                resolve(true);
                            },
                        });
                    });
                }

                crossTabChannel.close();
                if (!doOpen) {
                    return;
                }
            }

            let closeLoader: (() => void) | undefined;
            KL.popup({
                target: this.rootEl,
                message: LANG('loading'),
                callback: (result) => {
                    closeLoader = undefined;
                },
                closeFunc: (f) => {
                    closeLoader = f;
                },
            });
            let project: TDeserializedKlStorageProject | undefined;
            try {
                project = await projectStore?.read();
            } catch (e) {
                setTimeout(() => {
                    throw e;
                });
            }
            if (!project) {
                closeLoader?.();
                showFailureMessage();
                return;
            }
            applyUncommitted();
            const layerIndex = this.klCanvas.reset({
                projectId: project.project.projectId,
                width: project.project.width,
                height: project.project.height,
                layers: project.project.layers.map((item) => {
                    let image = item.image;
                    if (!(image instanceof HTMLCanvasElement)) {
                        image = BB.canvas(project.project.width, project.project.height);
                        if (item.image instanceof HTMLImageElement) {
                            const ctx = BB.ctx(image);
                            ctx.drawImage(item.image, 0, 0);
                        }
                    }
                    return {
                        ...item,
                        id: randomUuid(),
                        image,
                        mixModeStr: item.mixModeStr ?? 'source-over',
                    };
                }),
            });
            this.layersUi.update(layerIndex);
            setCurrentLayer(this.klCanvas.getLayer(layerIndex));
            this.easelProjectUpdater.update();
            this.easel.resetOrFitTransform(true);

            setTimeout(() => {
                // timeout to overwrite zoom overlay msg
                this.statusOverlay.out(LANG('file-storage-restored'));
            });
            closeLoader?.();
        };

        const fileUi = this.embed
            ? null
            : new KL.FileUi({
                  klRootEl: this.rootEl,
                  projectStore: projectStore,
                  getProject: () => this.klCanvas.getProject(),
                  exportType: exportType,
                  onExportTypeChange: (type) => {
                      exportType = type;
                  },
                  onFileSelect: (files, optionsStr) =>
                      importHandler.handleFileSelect(files, optionsStr),
                  onSaveImageToComputer: () => {
                      applyUncommitted();
                      this.saveToComputer.save();
                  },
                  onNewImage: showNewImageDialog,
                  onShareImage: (callback) => {
                      applyUncommitted();
                      shareImage(callback);
                  },
                  onUpload: () => {
                      // on upload
                      applyUncommitted();
                      KL.imgurUpload(
                          this.klCanvas,
                          this.rootEl,
                          p.app && p.app.imgurKey ? p.app.imgurKey : '',
                          () => this.updateLastSaved(),
                      );
                  },
                  applyUncommitted: () => applyUncommitted(),
                  onChangeShowSaveDialog: (b) => {
                      this.saveToComputer.setShowSaveDialog(b);
                  },
                  klRecoveryManager,
                  onOpenBrowserStorage,
                  onStoredToBrowserStorage: () => {
                      this.updateLastSaved();
                  },
              });

        if (!this.embed && projectStore) {
            this.saveReminder = new SaveReminder({
                onSaveAsPsd: () => {
                    if (!this.embed) {
                        this.saveAsPsd();
                    }
                },
                isDrawing: () => {
                    return this.isDrawing();
                },
                projectStore,
                getProject: () => this.getProject(),
                onStored: () => {
                    this.updateLastSaved();
                },
                applyUncommitted,
                klHistory: this.klHistory,
            });
        }

        const settingsUi = new KL.SettingsUi({
            onLeftRight: () => {
                this.uiLayout = this.uiLayout === 'left' ? 'right' : 'left';
                this.updateUi();
                if (!this.embed) {
                    LocalStorage.setItem('uiState', this.uiLayout);
                }
            },
            saveReminder: this.saveReminder,
            customAbout: p.aboutEl,
        });

        mainTabRow = new KL.TabRow({
            initialId: 'brush',
            tabArr: [
                {
                    id: 'brush',
                    title: LANG('tool-brush'),
                    image: toolPaintImg,
                    onOpen: () => {
                        if (currentBrushId === 'eraserBrush') {
                            this.klColorSlider.enable(false);
                        }
                        BB.append(colorDiv, [
                            this.klColorSlider.getElement(),
                            this.klColorSlider.getOutputElement(),
                            toolspaceStabilizerRow.getElement(),
                        ]);
                        brushDiv.style.display = 'block';
                    },
                    onClose: () => {
                        brushDiv.style.display = 'none';
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'hand',
                    title: LANG('tool-hand'),
                    image: toolHandImg,
                    isVisible: false,
                    onOpen: () => {
                        handUi.setIsVisible(true);
                    },
                    onClose: () => {
                        handUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'paintBucket',
                    title: LANG('tool-paint-bucket'),
                    image: toolFillImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        fillUi.setIsVisible(true);
                    },
                    onClose: () => {
                        fillUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'gradient',
                    title: LANG('tool-gradient'),
                    image: toolGradientImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        gradientUi.setIsVisible(true);
                    },
                    onClose: () => {
                        gradientUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'text',
                    title: LANG('tool-text'),
                    image: toolTextImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        textUi.setIsVisible(true);
                    },
                    onClose: () => {
                        textUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'shape',
                    title: LANG('tool-shape'),
                    image: toolShapeImg,
                    isVisible: false,
                    onOpen: () => {
                        this.klColorSlider.enable(true);
                        shapeUi.setIsVisible(true);
                    },
                    onClose: () => {
                        shapeUi.setIsVisible(false);
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'select',
                    title: LANG('tool-select'),
                    image: toolSelectImg,
                    isVisible: false,
                    onOpen: () => {
                        klAppSelect.getSelectUi().setIsVisible(true);
                    },
                    onClose: () => {
                        klAppSelect.getSelectUi().setIsVisible(false);
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'layers',
                    title: LANG('layers'),
                    image: tabLayersImg,
                    onOpen: () => {
                        this.layersUi.update();
                        this.layersUi.getElement().style.display = 'block';
                    },
                    onClose: () => {
                        this.layersUi.getElement().style.display = 'none';
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'edit',
                    title: LANG('tab-edit'),
                    image: tabEditImg,
                    onOpen: () => {
                        editUi.show();
                    },
                    onClose: () => {
                        editUi.hide();
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'file',
                    label: LANG('tab-file'),
                    isVisible: !!fileUi,
                    onOpen: () => {
                        if (!fileUi) {
                            return;
                        }
                        fileUi.getElement().style.display = 'block';
                        fileUi.setIsVisible(true);
                    },
                    onClose: () => {
                        if (!fileUi) {
                            return;
                        }
                        fileUi.getElement().style.display = 'none';
                        fileUi.setIsVisible(false);
                    },
                    css: {
                        padding: '0 7px',
                    },
                },
                {
                    id: 'settings',
                    title: LANG('tab-settings'),
                    image: tabSettingsImg,
                    onOpen: () => {
                        settingsUi.getElement().style.display = 'block';
                        // settingsTab.setIsVisible(true);
                    },
                    onClose: () => {
                        settingsUi.getElement().style.display = 'none';
                        // settingsTab.setIsVisible(false);
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
            ],
        });

        this.bottomBarWrapper = BB.el({
            css: {
                width: '270px',
                position: 'absolute',
                bottom: '0',
                left: '0',
            },
        });
        if (p.bottomBar) {
            this.bottomBar = p.bottomBar;
            this.bottomBarWrapper.append(this.bottomBar);
            const observer = new MutationObserver(() => this.updateBottomBar());
            observer.observe(this.toolspaceInner, {
                attributes: true,
                childList: true,
                subtree: true,
            });
        }

        BB.append(this.toolspaceInner, [
            this.layerPreview.getElement(),
            mainTabRow.getElement(),
            brushDiv,
            handUi.getElement(),
            fillUi.getElement(),
            gradientUi.getElement(),
            textUi.getElement(),
            shapeUi.getElement(),
            klAppSelect.getSelectUi().getElement(),
            this.layersUi.getElement(),
            editUi.getElement(),
            fileUi ? fileUi.getElement() : undefined,
            settingsUi.getElement(),
            BB.el({
                css: {
                    height: '10px', // a bit of spacing at the bottom
                },
            }),
            this.bottomBarWrapper ? this.bottomBarWrapper : undefined,
        ]);

        this.toolspaceScroller = new KL.ToolspaceScroller({
            toolspace: this.toolspace,
            uiState: this.uiLayout,
        });

        if (!this.embed) {
            Object.defineProperty(window, 'KL', {
                value: createConsoleApi({
                    onDraw: (path: TVector2D[]): void => {
                        if (!path || path.length === 0) {
                            return;
                        }
                        path.forEach((p, index) => {
                            if (index === 0) {
                                currentBrushUi.startLine(p.x, p.y, 1);
                            } else {
                                currentBrushUi.goLine(p.x, p.y, 1);
                            }
                        });
                        currentBrushUi.endLine();
                    },
                }),
                writable: false,
            });
        }

        this.resize(this.uiWidth, this.uiHeight);
        this.updateUi();

        const importHandler = new KlAppImportHandler(
            {
                klRootEl: this.rootEl,
                maxCanvasSize,
                layersUi: this.layersUi,
                setCurrentLayer,
                klCanvas: this.klCanvas,
                onImportConfirm: () => {
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform(true);
                },
                applyUncommitted: () => applyUncommitted(),
            },
            {
                onColor: (rgb) => brushSettingService.setColor(rgb),
            },
        );

        if (!this.embed || this.embed.enableImageDropperImport) {
            new KL.KlImageDropper({
                target: document.body,
                onDrop: (files, optionStr) => {
                    if (KL.DIALOG_COUNTER.get() > 0) {
                        return;
                    }
                    applyUncommitted();
                    importHandler.handleFileSelect(files, optionStr);
                },
                enabledTest: () => {
                    return KL.DIALOG_COUNTER.get() === 0;
                },
            });

            window.document.addEventListener(
                'paste',
                (e: ClipboardEvent) => importHandler.onPaste(e),
                false,
            );
        }

        this.unloadWarningTrigger = new UnloadWarningTrigger({
            klHistory: this.klHistory,
            getLastSavedHistoryIndex: () => this.lastSavedHistoryIndex,
        });

        {
            window.addEventListener('resize', () => {
                this.resize(window.innerWidth, window.innerHeight);
            });
            window.addEventListener('orientationchange', () => {
                this.resize(window.innerWidth, window.innerHeight);
            });
            // 2024-08: window.resize doesn't fire on iPad Safari when:
            // pinch zoomed page, then reload, and un-pinch-zoom page
            // therefor also listen to visualViewport.
            if ('visualViewport' in window && visualViewport !== null) {
                visualViewport.addEventListener('resize', () => {
                    this.resize(window.innerWidth, window.innerHeight);
                });
            }

            // iPad doesn't trigger 'resize' event when using text zoom, although it's resizing the window.
            // Workaround: place a div in the body that fills the window, and use a ResizeObserver
            const windowResizeWatcher = BB.el({
                parent: document.body,
                css: {
                    position: 'fixed',
                    left: '0',
                    top: '0',
                    right: '0',
                    bottom: '0',
                    pointerEvents: 'none',
                    zIndex: '-1',
                    userSelect: 'none',
                },
            });
            try {
                // Not all browsers support ResizeObserver. Not critical though.
                const observer = new ResizeObserver(() =>
                    this.resize(window.innerWidth, window.innerHeight),
                );
                observer.observe(windowResizeWatcher);
            } catch (e) {
                windowResizeWatcher.remove();
            }

            // prevent ctrl scroll -> zooming page
            this.rootEl.addEventListener(
                'wheel',
                (event) => {
                    if (keyListener.isPressed('ctrl')) {
                        event.preventDefault();
                    }
                },
                { passive: false },
            );
            //maybe prevent zooming on safari mac os - todo still needed?
            const prevent = (e: Event) => {
                e.preventDefault();
            };
            window.addEventListener('gesturestart', prevent, { passive: false });
            window.addEventListener('gesturechange', prevent, { passive: false });
            window.addEventListener('gestureend', prevent, { passive: false });

            const pinchZoomWatcher = new PinchZoomWatcher();
        }

        if (!this.embed) {
            setTimeout(() => {
                runBrowserStorageBanner({
                    projectStore,
                    klRecoveryManager,
                    onOpenBrowserStorage,
                    klHistory: this.klHistory,
                });
            });
        }
        this.saveReminder?.init();
    }

    // -------- interface --------

    getElement(): HTMLElement {
        return this.rootEl;
    }

    resize(w: number, h: number): void {
        // iPad scrolls down when increasing text zoom
        if (window.scrollY > 0) {
            window.scrollTo(0, 0);
        }

        if (this.uiWidth === Math.max(0, w) && this.uiHeight === Math.max(0, h)) {
            return;
        }

        this.uiWidth = Math.max(0, w);
        this.uiHeight = Math.max(0, h);

        this.updateCollapse();
        this.updateBottomBar();

        this.layerPreview.setIsVisible(this.uiHeight >= 579);
        this.klColorSlider.setHeight(Math.max(163, Math.min(400, this.uiHeight - 505)));
        this.toolspaceToolRow.setIsSmall(this.uiHeight < 540);
    }

    out(msg: string): void {
        this.statusOverlay.out(msg);
    }

    async getPNG(): Promise<Blob> {
        return await canvasToBlob(this.klCanvas.getCompleteCanvas(1), 'image/png');
    }

    getPSD = async (): Promise<Blob> => {
        return await klCanvasToPsdBlob(this.klCanvas);
    };

    getProject(): TKlProject {
        return this.klCanvas.getProject();
    }

    swapUiLeftRight(): void {
        this.uiLayout = this.uiLayout === 'left' ? 'right' : 'left';
        if (!this.embed) {
            LocalStorage.setItem('uiState', this.uiLayout);
        }
        this.updateUi();
    }

    saveAsPsd(): void {
        this.saveToComputer.save('psd');
    }

    isDrawing(): boolean {
        return this.lineSanitizer.getIsDrawing() || this.easel.getIsLocked();
    }
}
