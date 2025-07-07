import { KL } from '../klecks/kl';
import { KlHistory, TMiscFocusLayerHistoryEntry } from '../klecks/history/kl-history';
import { BB } from '../bb/bb';
import { showIframeModal } from '../klecks/ui/modals/show-iframe-modal';
import { EmbedToolspaceTopRow } from '../embed/embed-toolspace-top-row';
import {
    IGradient,
    TOldestProjectState,
    IKlProject,
    IRGB,
    TDrawEvent,
    TExportType,
    TKlCanvasLayer,
    TUiLayout,
} from '../klecks/kl-types';
import { importFilters } from '../klecks/filters/filters-lazy';
import { base64ToBlob } from '../klecks/storage/base-64-to-blob';
import { klCanvasToPsdBlob } from '../klecks/storage/kl-canvas-to-psd-blob';
import { ProjectStore } from '../klecks/storage/project-store';
import { SaveReminder } from '../klecks/ui/components/save-reminder';
import { KlCanvas } from '../klecks/canvas/kl-canvas';
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
import { ToolspaceCollapser } from '../klecks/ui/components/toolspace-collapser';
import { ToolspaceScroller } from '../klecks/ui/components/toolspace-scroller';
import { translateSmoothing } from '../klecks/utils/translate-smoothing';
import { KlAppImportHandler } from './kl-app-import-handler';
import toolPaintImg from '/src/app/img/ui/tool-paint.svg';
import toolHandImg from '/src/app/img/ui/tool-hand.svg';
import toolFillImg from '/src/app/img/ui/tool-fill.svg';
import toolGradientImg from '/src/app/img/ui/tool-gradient.svg';
import toolTextImg from '/src/app/img/ui/tool-text.svg';
import toolShapeImg from '/src/app/img/ui/tool-shape.svg';
import toolSelectImg from '/src/app/img/ui/tool-select.svg';
import tabSettingsImg from '/src/app/img/ui/tab-settings.svg';
import tabLayersImg from '/src/app/img/ui/tab-layers.svg';
import { LayersUi } from '../klecks/ui/tool-tabs/layers-ui/layers-ui';
import { IVector2D } from '../bb/bb-types';
import { createConsoleApi } from './console-api';
import { ERASE_COLOR } from '../klecks/brushes/erase-color';
import { throwIfNull } from '../bb/base/base';
import { klConfig } from '../klecks/kl-config';
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
import { KlHistoryExecutor } from '../klecks/history/kl-history-executor';
import { PinchZoomWatcher } from '../klecks/ui/components/pinch-zoom-watcher';
import { EASEL_MAX_SCALE, EASEL_MIN_SCALE } from '../klecks/ui/easel/easel.config';
import { UploadImage } from '../klecks/storage/upload-image';
import { Style } from '../klecks/kl-types';
import { StyleSelectionUi } from '../klecks/ui/components/style-selection-ui';

importFilters();

type KlAppOptionsEmbed = {
    url: string;
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
};

export type TKlAppParams = {
    project?: IKlProject;
    saveReminder?: SaveReminder;
    projectStore?: ProjectStore;
    logoImg?: string; // app logo
    bottomBar?: HTMLElement; // row at bottom of toolspace
    embed?: KlAppOptionsEmbed;
    simpleUi: boolean;
    session: string;
    app?: {
        imgurKey?: string; // for imgur uploads
    };
    aboutEl?: HTMLElement; // replaces info about Klecks in settings tab
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
    private readonly klRootEl: HTMLElement;
    private uiWidth: number;
    private uiHeight: number;
    private simpleUi: boolean;
    private backendUrl: string;
    private session: string;
    private readonly layerPreview: LayerPreview;
    private readonly klColorSlider: KlColorSlider;
    private readonly toolspaceToolRow: ToolspaceToolRow;
    private readonly statusOverlay: StatusOverlay;
    private readonly klCanvas: KlCanvas;
    private uiState: TUiLayout;
    private readonly embed: undefined | KlAppOptionsEmbed;
    private readonly saveToComputer: SaveToComputer;
    private readonly uploadImage: UploadImage;
    private readonly lineSanitizer: LineSanitizer;
    private readonly easel: Easel<TKlAppToolId>;
    private readonly easelProjectUpdater: EaselProjectUpdater<TKlAppToolId>;
    private readonly easelBrush: EaselBrush;
    private readonly collapseThreshold: number = 820;
    private readonly toolspaceCollapser: ToolspaceCollapser;
    private readonly toolspace: HTMLElement;
    private readonly toolspaceInner: HTMLElement;
    private readonly toolWidth: number = 271;
    private readonly bottomBar: HTMLElement | undefined;
    private readonly layersUi: LayersUi;
    private readonly toolspaceScroller: ToolspaceScroller;
    private readonly bottomBarWrapper: HTMLElement;
    private selectedStyle: Style;
    private styleOptions: Style[];
    private sessionSettings: SessionSettings;
    private styleSelectionUi: StyleSelectionUi | undefined;

    private updateCollapse(): void {
        //collapser
        if (this.uiWidth < this.collapseThreshold) {
            this.toolspaceCollapser.getElement().style.display = 'block';

            this.toolspaceCollapser.setDirection(this.uiState);
            if (this.toolspaceCollapser.isOpen()) {
                if (this.uiState === 'left') {
                    BB.css(this.toolspaceCollapser.getElement(), {
                        left: '271px',
                        right: '',
                    });
                    BB.css(this.easel.getElement(), {
                        left: '271px',
                    });
                } else {
                    BB.css(this.toolspaceCollapser.getElement(), {
                        left: '',
                        right: '271px',
                    });
                    BB.css(this.easel.getElement(), {
                        left: '0',
                    });
                }
                this.toolspace.style.display = 'flex';
                this.easel.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
                this.statusOverlay.setWide(false);
            } else {
                if (this.uiState === 'left') {
                    BB.css(this.toolspaceCollapser.getElement(), {
                        left: '0',
                        right: '',
                    });
                } else {
                    BB.css(this.toolspaceCollapser.getElement(), {
                        left: '',
                        right: '0',
                    });
                }
                this.toolspace.style.display = 'none';
                this.easel.setSize(Math.max(0, this.uiWidth), this.uiHeight);
                this.statusOverlay.setWide(true);
            }
        } else {
            this.toolspaceCollapser.getElement().style.display = 'none';
            if (this.uiState === 'left') {
                BB.css(this.easel.getElement(), {
                    left: '271px',
                });
            }
            this.toolspace.style.display = 'flex';
            this.easel.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
            this.statusOverlay.setWide(false);
        }
        // this.resize(this.klCanvas.getWidth(), this.klCanvas.getHeight());
        this.easel.fitTransform();
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
        this.toolspace.classList.toggle('kl-toolspace--left', this.uiState === 'left');
        this.toolspace.classList.toggle('kl-toolspace--right', this.uiState === 'right');
        if (this.uiState === 'left') {
            BB.css(this.toolspace, {
                left: '0',
                right: '',
            });
            BB.css(this.easel.getElement(), {
                left: '271px',
            });
        } else {
            BB.css(this.toolspace, {
                left: '',
                right: '0',
            });
            BB.css(this.easel.getElement(), {
                left: '0',
            });
        }
        this.statusOverlay.setUiState(this.uiState);
        this.layerPreview.setUiState(this.uiState);
        this.layersUi.setUiState(this.uiState);
        this.updateCollapse();
        this.toolspaceScroller.updateUiState(this.uiState);
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: TKlAppParams) {
        this.embed = p.embed;
        // default 2048, unless your screen is bigger than that (that computer then probably has the horsepower for that)
        // but not larger than 4096 - a fairly arbitrary decision
        const klMaxCanvasSize = Math.min(
            4096,
            Math.max(2048, Math.max(window.screen.width, window.screen.height)),
        );
        this.uiState = (
            this.embed
                ? 'left'
                : LocalStorage.getItem('uiState')
                  ? LocalStorage.getItem('uiState')
                  : 'right'
        ) as TUiLayout;
        const projectStore = p.projectStore;
        this.klRootEl = BB.el({
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
        
        
        this.klCanvas = new KL.KlCanvas(
            p.project
                ? {
                      projectObj: p.project,
                  }
                : {
                   width: 720,
                   height: 1280
                // width: Math.max(10, Math.min(klMaxCanvasSize, window.innerWidth < this.collapseThreshold ? this.uiWidth : this.uiWidth - this.toolWidth)),
                // height: Math.max(10, Math.min(klMaxCanvasSize, this.uiHeight)),
            }, this.embed ? -1 : 0);
        const klHistory = new KlHistory();
        this.klCanvas.setHistory(klHistory);
        const tempHistory = new KlTempHistory();
        let oldestProjectState: TOldestProjectState;
        let mainTabRow: TabRow | undefined = undefined;
        this.simpleUi = p.simpleUi;
        this.session = p.session;
        this.backendUrl = process.env.BACKEND_URL ?? "";
        this.styleOptions = [];
        this.sessionSettings = {} as SessionSettings;
        this.styleOptions = []; // Initialize as empty array
        this.selectedStyle = { // Default selected style before fetch
            id: 'default-initial-style', // Added default ID
            name: 'van gogh',
            // positivePrompt and negativePrompt removed by previous change
            imageUrl: '' // Placeholder image
        };

        this.styleSelectionUi = new StyleSelectionUi({
            backendUrl: this.backendUrl,
            styleOptions: this.styleOptions,
            selectedStyle: this.selectedStyle,
            onStyleSelect: (style) => {
                this.selectedStyle = style;
                this.uploadImage.setStyle(style);
                this.uploadImage.Send();
            }
        });
        // Style fetching will be done later, and will call this.styleSelectionUi.updateStyleSelection

        fetch(`${this.backendUrl}/SessionSettings/GetBySession/${p.session}`, { credentials: 'include'}).then(async response => {
            this.sessionSettings = await response.json() as SessionSettings
        })

        if (!p.saveReminder) {
            p.saveReminder = {
                init: () => {},
                reset: () => {},
            } as SaveReminder;
        }

        if (p.project) {
            // attempt at freeing memory
            p.project.layers.forEach((layer) => {
                layer.image = null as any;
            });
            p.project = undefined;
        } else {
            // init blank project
            klHistory.pause(true);
            this.klCanvas.addLayer();
            this.klCanvas.layerFill(0, {r: 255, g: 208, b: 89});
            klHistory.pause(false);
        }
        try {
            oldestProjectState = {
                canvas: new KL.KlCanvas({ copy: this.klCanvas }, this.embed ? -1 : 0),
                focus: this.klCanvas.getLayerCount() - 1,
                brushes: {},
            };
        } catch (e) {
            if ((e as Error).message === 'kl-create-canvas-error') {
                this.klCanvas.destroy();
            }
            throw e;
        }
        Object.entries(KL.brushes).forEach(([b, Brush]) => {
            oldestProjectState.brushes[b] = new Brush();
            if (oldestProjectState.canvas) {
                oldestProjectState.brushes[b].setContext(
                    oldestProjectState.canvas.getLayerContext(oldestProjectState.focus),
                );
            }
        });

        let currentColor = new BB.RGB(0, 0, 0);
        let currentBrushUi: any; // todo
        let currentBrushId: string;
        let lastNonEraserBrushId: string;
        let currentLayerCtx = throwIfNull(
            this.klCanvas.getLayerContext(this.klCanvas.getLayerCount() - 1),
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
                currentColor = BB.copyObj(color);
            },
            onSetSize: (size) => {
                currentBrushUi.setSize(size);
                this.easelBrush.setBrush({ radius: size });
            },
            onSetOpacity: (opacity) => {
                currentBrushUi.setOpacity(opacity);
            },
            onGetColor: () => this.klColorSlider.getColor(),
            onGetSize: () => brushUiMap[currentBrushId].getSize(),
            onGetOpacity: () => brushUiMap[currentBrushId].getOpacity(),
            onGetSliderConfig: () => {
                return {
                    sizeSlider: KL.brushesUI[currentBrushId].sizeSlider,
                    opacitySlider: KL.brushesUI[currentBrushId].opacitySlider,
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
            this.uploadImage.Send();
            if (event.type === 'down') {
                this.toolspace.style.pointerEvents = 'none';
                currentBrushUi.startLine(event.x, event.y, event.pressure);
                this.easelBrush.setLastDrawEvent({ x: event.x, y: event.y });
                this.easel.requestRender();
            }
            if (event.type === 'move') {
                currentBrushUi.goLine(event.x, event.y, event.pressure, false, event.isCoalesced);
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
        const discardUncommitted = () => {
            if (this.easel.getTool() === 'select') {
                klAppSelect.discardTransform();
            }
        };

        const undo = (showMessage?: boolean) => {
            if (!tempHistory.canDecreaseIndex()) {
                discardUncommitted();
            }
            klHistoryExecutor.undo();
            if (showMessage) {
                this.statusOverlay.out(LANG('undo'), true);
            }
        };

        const redo = (showMessage?: boolean) => {
            /*if (!tempHistory.canIncreaseIndex()) {
                discardUncommitted();
            }*/
            klHistoryExecutor.redo();
            if (showMessage) {
                this.statusOverlay.out(LANG('redo'), true);
            }
        };

        this.statusOverlay = new KL.StatusOverlay();

        const klAppSelect = new KlAppSelect({
            klCanvas: this.klCanvas,
            getCurrentLayerCtx: () => currentLayerCtx,
            onUpdateProject: () => this.easelProjectUpdater.update(),
            klHistory,
            tempHistory,
            statusOverlay: this.statusOverlay,
            onFill: () => {
                this.klCanvas.layerFill(
                    throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas)),
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
                const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas));
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
                hand: new EaselHand({}),
                select: klAppSelect.getEaselSelect(),
                eyedropper: new EaselEyedropper({
                    onPick: (p) => {
                        const color = this.klCanvas.getColorAt(p.x, p.y);
                        brushSettingService.setColor(color);
                        return color;
                    },
                    onPickEnd: () => {
                        if (this.klColorSlider.getIsPicking()) {
                            this.klColorSlider.pickingDone();
                            this.easel.setTool(this.toolspaceToolRow.getActive());
                        }
                    },
                }),
                paintBucket: new EaselPaintBucket({
                    onFill: (p) => {
                        const layerIndex = throwIfNull(
                            this.klCanvas.getLayerIndex(currentLayerCtx.canvas),
                        );
                        this.klCanvas.floodFill(
                            layerIndex,
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
                        if (KL.dialogCounter.get() > 0) {
                            return;
                        }

                        KL.textToolDialog({
                            klCanvas: this.klCanvas,
                            layerIndex: throwIfNull(
                                this.klCanvas.getLayerIndex(currentLayerCtx.canvas),
                            ),
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
                                const layerIndex = throwIfNull(
                                    this.klCanvas.getLayerIndex(currentLayerCtx.canvas),
                                );
                                this.klCanvas.text(layerIndex, val);
                            },
                        });
                    },
                }),
                shape: new EaselShape({
                    onDown: (p, angleRad) => {
                        shapeTool.onDown(p.x, p.y, angleRad);
                    },
                    onMove: (p) => {
                        shapeTool.onMove(p.x, p.y);
                    },
                    onUp: (p) => {
                        shapeTool.onUp(p.x, p.y);
                    },
                }),
                rotate: new EaselRotate({}),
                zoom: new EaselZoom({}),
            },
            tool: 'brush',
            onTransformChange: (transform, isScaleOrAngleChanged) => {
                handUi.update(transform.scale, transform.angleDeg);
                this.toolspaceToolRow.setEnableZoomIn(transform.scale !== EASEL_MAX_SCALE);
                this.toolspaceToolRow.setEnableZoomOut(transform.scale !== EASEL_MIN_SCALE);

                if (isScaleOrAngleChanged) {
                    this.statusOverlay.out({
                        type: 'transform',
                        scale: transform.scale,
                        angleDeg: transform.angleDeg,
                    });
                }
            },
            onUndo: () => {
                undo(true);
            },
            onRedo: () => {
                redo(true);
            },
        });

        this.easel.fitTransform();


        BB.css(this.easel.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
        });
        this.easelProjectUpdater = new EaselProjectUpdater({
            klCanvas: this.klCanvas,
            easel: this.easel,
        });
        klHistory.addListener(() => {
            this.easelProjectUpdater.update();
        });
        KL.dialogCounter.subscribe((count) => {
            this.easel.setIsFrozen(count > 0);
        });

        BB.css(this.easel.getElement(), {
            position: 'absolute',
            left: '0',
            top: '0',
        });
        this.easelProjectUpdater = new EaselProjectUpdater({
            klCanvas: this.klCanvas,
            easel: this.easel,
        });
        klHistory.addListener(() => {
            this.easelProjectUpdater.update();
        });
        KL.dialogCounter.subscribe((count) => {
            this.easel.setIsFrozen(count > 0);
        });

        const updateMainTabVisibility = () => {
            if (!mainTabRow) {
                return;
            }

            const toolObj = this.simpleUi ? {
                brush: {}
            }
            :
            {
                brush: {},
                hand: {},
                fill: {},
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
                if (KL.dialogCounter.get() > 0 || BB.isInputFocused(true)) {
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
                        (async () => {
                            let success = true;
                            try {
                                await projectStore!.store(this.klCanvas.getProject());
                            } catch (e) {
                                success = false;
                                setTimeout(() => {
                                    throw new Error(
                                        'keyboard-shortcut: failed to store browser storage, ' + e,
                                    );
                                }, 0);
                                this.statusOverlay.out('❌ ' + LANG('file-storage-failed'), true);
                            }
                            if (success) {
                                p.saveReminder!.reset();
                                this.statusOverlay.out(LANG('file-storage-stored'), true);
                            }
                        })();
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
                            throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas)),
                            this.klColorSlider.getColor(),
                            undefined,
                            true,
                        );
                        this.statusOverlay.out(
                            this.klCanvas.getSelection()
                                ? LANG('filled-selected-area')
                                : LANG('filled'), // todo translation
                            true,
                        );
                    }
                }
                if (comboStr === 'esc') {
                    discardUncommitted();
                }
                if (['delete', 'backspace'].includes(comboStr)) {
                    applyUncommitted();
                    const layerIndex = throwIfNull(
                        this.klCanvas.getLayerIndex(currentLayerCtx.canvas),
                    );
                    this.klCanvas.eraseLayer({
                        layerIndex,
                        useAlphaLock:
                            layerIndex === 0 && !brushUiMap.eraserBrush.getIsTransparentBg(),
                        useSelection: true,
                    });
                    this.statusOverlay.out(
                        this.klCanvas.getSelection()
                            ? LANG('cleared-selected-area')
                            : LANG('cleared-layer'),
                        true,
                    );
                }
                if (comboStr === 'shift+e') {
                    event.preventDefault();
                    currentBrushUi.toggleEraser && currentBrushUi.toggleEraser();
                } else if (comboStr === 'e') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('brush');
                    this.toolspaceToolRow.setActive('brush');
                    mainTabRow && mainTabRow.open('brush');
                    updateMainTabVisibility();
                    brushTabRow.open('eraserBrush');
                }
                if (comboStr === 'b') {
                    event.preventDefault();
                    applyUncommitted();
                    const prevMode = this.easel.getTool();
                    this.easel.setTool('brush');
                    this.toolspaceToolRow.setActive('brush');
                    mainTabRow && mainTabRow.open('brush');
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
                    mainTabRow && mainTabRow.open(newMode);
                    updateMainTabVisibility();
                }
                if (comboStr === 't') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('text');
                    this.toolspaceToolRow.setActive('text');
                    mainTabRow && mainTabRow.open('text');
                    updateMainTabVisibility();
                }
                if (comboStr === 'u') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('shape');
                    this.toolspaceToolRow.setActive('shape');
                    mainTabRow && mainTabRow.open('shape');
                    updateMainTabVisibility();
                }
                if (comboStr === 'l') {
                    event.preventDefault();
                    applyUncommitted();
                    this.easel.setTool('select');
                    this.toolspaceToolRow.setActive('select');
                    mainTabRow && mainTabRow.open('select');
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
        Object.entries(KL.brushesUI).forEach(([b, brushUi]) => {
            const ui = new (brushUi.Ui as any)({
                history: klHistory,
                onSizeChange: sizeWatcher,
                onOpacityChange: (opacity: number) => {
                    brushSettingService.emitOpacity(opacity);
                },
                onConfigChange: () => {
                    brushSettingService.emitSliderConfig({
                        sizeSlider: KL.brushesUI[currentBrushId].sizeSlider,
                        opacitySlider: KL.brushesUI[currentBrushId].opacitySlider,
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
                display: 'flex',
                flexDirection: 'column'
            },
        });
        this.toolspaceInner = BB.el({
            parent: this.toolspace,
        });
        this.toolspace.oncontextmenu = () => {
            return false;
        };
        this.toolspace.onclick = BB.handleClick;

        this.toolspaceCollapser = new KL.ToolspaceCollapser({
            onChange: () => {
                this.updateCollapse();
            },
        });

        this.updateCollapse();

        let overlayToolspace;
        setTimeout(() => {
            overlayToolspace = new KL.OverlayToolspace({
                enabledTest: () => {
                    return KL.dialogCounter.get() === 0 && !this.easel.getIsLocked();
                },
                brushSettingService,
            });
            this.klRootEl.append(overlayToolspace.getElement());
        }, 0);

        BB.append(this.klRootEl, [
            this.easel.getElement(),
            // this.klCanvasWorkspace.getElement(),
            this.toolspace,
            this.toolspaceCollapser.getElement(),
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
                            target: this.klRootEl,
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
                        target: this.klRootEl,
                        message: LANG('submit-prompt'),
                        buttons: [LANG('submit'), 'Cancel'],
                        callback: async (result) => {
                            if (result !== LANG('submit')) {
                                return;
                            }

                            const overlay = BB.el({
                                parent: this.klRootEl,
                                className: 'upload-overlay',
                                content: '<div class="spinner"></div> ' + LANG('submit-submitting'),
                            });

                            this.embed!.onSubmit(
                                () => {
                                    p.saveReminder!.reset();
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
                    this.uiState = this.uiState === 'left' ? 'right' : 'left';
                    this.updateUi();
                },
            });
        } else {
            toolspaceTopRow = new KL.ToolspaceTopRow({
                simpleUi: p.simpleUi,
                logoImg: p.logoImg!,
                onLogo: () => {
                    return;
                    // showIframeModal('./home/', !!this.embed);
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
                onShare: async () => {
                    await shareImage();
                },
                onHelp: () => {
                    // Previously showStyleSelectDialog();
                    // Now, style selection is in settings.
                    // Consider if this help button should open settings or a different help modal.
                    // For now, let's make it open the settings tab.
                    if (mainTabRow) {
                        mainTabRow.open('settings');
                    }
                },
            });
        }
        toolspaceTopRow.getElement().style.marginBottom = '10px';
        this.toolspaceInner.append(toolspaceTopRow.getElement());

        this.toolspaceToolRow = new KL.ToolspaceToolRow({
            simpleUi: this.simpleUi,
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
                mainTabRow && mainTabRow.open(activeStr);
                updateMainTabVisibility();
                this.klColorSlider.pickingDone();
            },
            onZoomIn: () => {
                // const oldScale = this.easel.getTransform().scale;
                // const newScale = zoomByStep(
                //     oldScale,
                //     keyListener.isPressed('shift') ? 1 / 8 : 1 / 2,
                // );
                // this.easel.scale(newScale / oldScale);
            },
            onZoomOut: () => {
                // const oldScale = this.easel.getTransform().scale;
                // const newScale = zoomByStep(
                //     oldScale,
                //     keyListener.isPressed('shift') ? -1 / 8 : -1 / 2,
                // );
                // this.easel.scale(newScale / oldScale);
            },
            onUndo: () => {
                this.uploadImage.Send();
                undo();
            },
            onRedo: () => {
                this.uploadImage.Send();
                redo();
            },
        });
        this.toolspaceToolRow.setIsSmall(this.uiHeight < 540);
        this.toolspaceInner.append(this.toolspaceToolRow.getElement());

        const setBrushColor = (p_color: IRGB) => {
            currentColor = p_color;
            currentBrushUi.setColor(p_color);
            brushSettingService.emitColor(p_color);
            this.klColorSlider.pickingDone();
        };

        this.klColorSlider = new KL.KlColorSlider({
            simpleUi: true,
            width: 250,
            height: 30,
            svHeight: 100,
            startValue: new BB.RGB(0, 0, 0),
            onPick: setBrushColor,
            onEyedropper: (isActive) => {
                if (isActive) {
                    this.easel.setTool('eyedropper');
                } else {
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
            currentBrushUi.setContext(currentLayerCtx);
            this.easelBrush.setBrush({
                type: currentBrushId === 'pixelBrush' ? 'pixel-square' : 'round',
            });
            this.toolspaceToolRow.setActive('brush');
            updateMainTabVisibility();
        };

        const setCurrentLayer = (layer: TKlCanvasLayer) => {
            //BrushContext(p_context) {
            currentLayerCtx = layer.context;
            currentBrushUi.setContext(layer.context);
            this.layerPreview.setLayer(layer);
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
            simpleUi: this.simpleUi,
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
                        image: KL.brushesUI[keyStr].image,
                        title: KL.brushesUI[keyStr].tooltip,
                        onOpen: () => {
                            brushUiMap[keyStr].getElement().style.display = 'block';
                            setCurrentBrush(keyStr);
                            this.klColorSlider.pickingDone();
                            brushSettingService.emitSliderConfig({
                                sizeSlider: KL.brushesUI[keyStr].sizeSlider,
                                opacitySlider: KL.brushesUI[keyStr].opacitySlider,
                            });
                            sizeWatcher(brushUiMap[keyStr].getSize());
                            brushSettingService.emitOpacity(brushUiMap[keyStr].getOpacity());
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

        if(!this.simpleUi){
            BB.append(brushDiv, [
                brushTabRow.getElement(),
            ]);
        }
        BB.append(brushDiv, [
                ...Object.entries(KL.brushesUI).map(([b]) => brushUiMap[b].getElement()),
            ]);

        // Append StyleSelection UI to brushDiv
        if (this.styleSelectionUi) {
            this.toolspace.append(this.styleSelectionUi.getElement());
        }

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
        });

        const gradientTool = new KL.GradientTool({
            onGradient: (isDone, x1, y1, x2, y2, angleRad) => {
                const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas));
                const settings = gradientUi.getSettings();
                const gradientObj: IGradient = {
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
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawGradient(ctx, gradientObj);
                        },
                    });
                }

                this.easelProjectUpdater.update();
            },
        });

        const shapeTool = new KL.ShapeTool({
            onShape: (isDone, x1, y1, x2, y2, angleRad) => {
                const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas));

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
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawShape(ctx, shapeObj);
                        },
                    });
                }

                this.easelProjectUpdater.update();
            },
        });

        this.layersUi = new KL.LayersUi({
            klCanvas: this.klCanvas,
            onSelect: (val) => {
                setCurrentLayer(throwIfNull(this.klCanvas.getLayer(val)));
                klHistory.push({
                    tool: ['misc'],
                    action: 'focusLayer',
                    params: [val],
                } as TMiscFocusLayerHistoryEntry);
            },
            parentEl: this.klRootEl,
            uiState: this.uiState,
            applyUncommitted: () => applyUncommitted(),
            history: klHistory,
            onUpdateProject: () => this.easelProjectUpdater.update(),
        });
        this.layerPreview = new KL.LayerPreview({
            klRootEl: this.klRootEl,
            onClick: () => {
                mainTabRow && mainTabRow.open('layers');
            },
            uiState: this.uiState,
            history: klHistory,
        });
        this.layerPreview.setIsVisible(this.uiHeight >= 579);
        this.layerPreview.setLayer(
            this.klCanvas.getLayer(this.klCanvas.getLayerIndex(currentLayerCtx.canvas)!)!,
        );

        const filterUi = new KL.FilterUi({
            klRootEl: this.klRootEl,
            klColorSlider: this.klColorSlider,
            layersUi: this.layersUi,
            getCurrentColor: () => currentColor,
            getKlMaxCanvasSize: () => klMaxCanvasSize,
            klCanvas: this.klCanvas,
            getCurrentLayerCtx: () => currentLayerCtx,
            isEmbed: !!this.embed,
            statusOverlay: this.statusOverlay,
            onCanvasChanged: () => {
                this.easelProjectUpdater.update();
                this.easel.resetOrFitTransform();
            },
            applyUncommitted: () => applyUncommitted(),
            history: klHistory,
        });

        const klHistoryExecutor = new KlHistoryExecutor({
            history: klHistory,
            tempHistory,
            brushUiMap,
            getOldestProjectState: () => {
                return oldestProjectState;
            },
            klCanvas: this.klCanvas,
            getCurrentLayerCtx: () => currentLayerCtx,
            setCurrentLayerCtx: (ctx) => {
                currentLayerCtx = ctx;
            },
            onExecuted: (dimensionChanged, type) => {
                const currentLayerIndex = throwIfNull(
                    this.klCanvas.getLayerIndex(currentLayerCtx.canvas),
                );
                currentBrushUi.setContext(currentLayerCtx);
                this.easelBrush.setLastDrawEvent();
                this.layersUi.update(currentLayerIndex);
                this.layerPreview.setLayer(this.klCanvas.getLayer(currentLayerIndex)!);
                if (dimensionChanged) {
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform();
                }
                klAppSelect.onHistory(type);
            },
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
                maxCanvasSize: klMaxCanvasSize,
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
                    setCurrentLayer(throwIfNull(this.klCanvas.getLayer(0)));
                    this.easelProjectUpdater.update();
                    this.easel.fitTransform();
                },
                onCancel: () => {},
            });
        };

        // const showStyleSelectDialog = () => {
        //     KL.selectStyleDialog({selectedStyle: this.selectedStyle, styleOptions: this.styleOptions, onStyleSelect: (style) => {this.selectedStyle = style; this.uploadImage.setStyle(style); this.uploadImage.Send()}});
        // };

        const shareImage = (callback?: () => void) => {
            KL.shareDialog({image: this.uploadImage.getLatestGeneration(), imageId: this.uploadImage.getimageId(), backendUrl: this.backendUrl, getKlCanvas: () => this.klCanvas, session: this.session, printingEnabled: this.sessionSettings.printingEnabled});
        };

        this.saveToComputer = new KL.SaveToComputer(
            p.saveReminder,
            () => exportType,
            this.klCanvas,
        );

        this.uploadImage = new KL.UploadImage(
            () => this.klCanvas,
            this.backendUrl,
            this.session,
            this.selectedStyle
        );

        const copyToClipboard = (showCrop?: boolean) => {
            KL.clipboardDialog(
                this.klRootEl,
                this.klCanvas.getCompleteCanvas(1),
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
                    KL.filterLib.cropExtend.apply!({
                        context: currentLayerCtx,
                        klCanvas: this.klCanvas,
                        input: inputObj,
                        history: klHistory,
                    });
                    this.layersUi.update();
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform();
                },
                this.statusOverlay,
                showCrop || false,
            );
        };

        const fileUi = this.embed
            ? null
            : new KL.FileUi({
                  klRootEl: this.klRootEl,
                  projectStore: projectStore!,
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
                  onShareImage: () => {
                      applyUncommitted();
                      shareImage();
                  },
                  onUpload: () => {
                      // on upload
                      applyUncommitted();
                      KL.imgurUpload(
                          this.klCanvas,
                          this.klRootEl,
                          p.saveReminder!,
                          p.app && p.app.imgurKey ? p.app.imgurKey : '',
                      );
                  },
                  onCopyToClipboard: () => {
                      applyUncommitted();
                      copyToClipboard();
                  },
                  saveReminder: p.saveReminder,
                  applyUncommitted: () => applyUncommitted(),
              });

        const settingsUi = new KL.SettingsUi({
            onLeftRight: () => {
                this.uiState = this.uiState === 'left' ? 'right' : 'left';
                this.updateUi();
                if (!this.embed) {
                    LocalStorage.setItem('uiState', this.uiState);
                }
            },
            saveReminder: this.embed ? undefined : p.saveReminder,
            customAbout: p.aboutEl,
            // styleOptions, selectedStyle, onStyleSelect removed
        });

        // Fetch styles logic will be reused for the new StyleSelectionUi instance
        // The call to settingsUi.updateStyleSelection is removed from here.
        // This fetch will be modified later to update the new StyleSelectionUi
        fetch(`${this.backendUrl}/GenerateStyles/List/${p.session}?workflowType=PictureThis`, { credentials: 'include'}).then(async response => {
            if (!response.ok) {
                console.error("Failed to fetch styles:", response.status, await response.text());
                this.styleOptions = [];
                // Ensure fallback style also has an id
                this.selectedStyle = { id: 'error-style-id', name: 'Error', imageUrl: '' };
            } else {
                this.styleOptions = await response.json() as Style[];
                if (this.styleOptions && this.styleOptions.length > 0) {
                    this.selectedStyle = this.styleOptions[0]; // Assumes fetched styles have an id
                } else {
                    this.styleOptions = [];
                    // Ensure fallback style also has an id
                    this.selectedStyle = { id: 'default-fallback-style-id', name: 'Default', imageUrl: '' };
                    console.warn("No styles fetched or empty style list.");
                }
            }
            if (this.styleSelectionUi) {
                this.styleSelectionUi.updateStyleSelection(this.styleOptions, this.selectedStyle);
            }
            if (this.uploadImage && this.selectedStyle) { // Ensure uploadImage is initialized
                this.uploadImage.setStyle(this.selectedStyle); // Set initial style for upload manager
            }
        }).catch(error => {
            console.error("Error fetching styles:", error);
            this.styleOptions = [];
            this.selectedStyle = { name: 'Error', positivePrompt: '', negativePrompt: '', imageUrl: '' };
            if (this.styleSelectionUi) {
                this.styleSelectionUi.updateStyleSelection(this.styleOptions, this.selectedStyle);
            }
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
                ...!this.simpleUi ?
                [{
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
                    label: LANG('tab-edit'),
                    onOpen: () => {
                        filterUi.show();
                    },
                    onClose: () => {
                        filterUi.hide();
                    },
                    css: {
                        padding: '0 7px',
                    },
                }] : [],
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
            ...!this.simpleUi ? [
            this.layerPreview.getElement(),
            mainTabRow.getElement(),
            ] : [],
            brushDiv,
            // To be added after brushDiv: this.styleSelectionUi.getElement(),
            ...!this.simpleUi ? [
            handUi.getElement(),
            fillUi.getElement(),
            gradientUi.getElement(),
            textUi.getElement(),
            shapeUi.getElement(),
            klAppSelect.getSelectUi().getElement(),
            this.layersUi.getElement(),
            filterUi.getElement(),
            fileUi ? fileUi.getElement() : undefined,
            ] : [],
            BB.el({
                css: {
                    height: '10px', // a bit of spacing at the bottom
                },
            }),
            this.bottomBarWrapper ? this.bottomBarWrapper : undefined,
        ]);

        BB.append(this.toolspace, [settingsUi.getElement()]);

        this.toolspaceScroller = new KL.ToolspaceScroller({
            toolspace: this.toolspace,
            uiState: this.uiState,
        });

        if (!this.embed) {
            Object.defineProperty(window, 'KL', {
                value: createConsoleApi({
                    onDraw: (path: IVector2D[]): void => {
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
                klRootEl: this.klRootEl,
                klMaxCanvasSize,
                layersUi: this.layersUi,
                setCurrentLayer,
                klCanvas: this.klCanvas,
                onImportConfirm: () => {
                    this.easelProjectUpdater.update();
                    this.easel.resetOrFitTransform();
                },
            },
            {
                onColor: (rgb) => brushSettingService.setColor(rgb),
            },
        );

        if (!this.embed) {
            new KL.KlImageDropper({
                target: document.body,
                onDrop: (files, optionStr) => {
                    if (KL.dialogCounter.get() > 0) {
                        return;
                    }
                    applyUncommitted();
                    importHandler.handleFileSelect(files, optionStr);
                },
                enabledTest: () => {
                    return KL.dialogCounter.get() === 0;
                },
            });

            window.document.addEventListener(
                'paste',
                (e: ClipboardEvent) => importHandler.onPaste(e),
                false,
            );
        }

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
            // this.klRootEl.addEventListener(
            //     'wheel',
            //     (event) => {
            //         if (keyListener.isPressed('ctrl')) {
            //             event.preventDefault();
            //         }
            //     },
            //     { passive: false },
            // );
            //maybe prevent zooming on safari mac os - todo still needed?
            const prevent = (e: Event) => {
                e.preventDefault();
            };
            window.addEventListener('gesturestart', prevent, { passive: false });
            window.addEventListener('gesturechange', prevent, { passive: false });
            window.addEventListener('gestureend', prevent, { passive: false });

            const pinchZoomWatcher = new PinchZoomWatcher();
        }

        p.saveReminder.setHistory(klHistory);
    }

    // -------- interface --------

    getEl(): HTMLElement {
        return this.klRootEl;
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

    getPNG(): Blob {
        return base64ToBlob(this.klCanvas.getCompleteCanvas(1).toDataURL('image/png'));
    }

    getPSD = async (): Promise<Blob> => {
        return await klCanvasToPsdBlob(this.klCanvas);
    };

    getProject(): IKlProject {
        return this.klCanvas.getProject();
    }

    swapUiLeftRight(): void {
        this.uiState = this.uiState === 'left' ? 'right' : 'left';
        if (!this.embed) {
            LocalStorage.setItem('uiState', this.uiState);
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
export interface SessionSettings {
    printingEnabled: boolean;
}