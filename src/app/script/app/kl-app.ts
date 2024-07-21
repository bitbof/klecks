import {KL} from '../klecks/kl';
import {klHistory, TMiscFocusLayerHistoryEntry} from '../klecks/history/kl-history';
import {BB} from '../bb/bb';
import {showIframeModal} from '../klecks/ui/modals/show-iframe-modal';
import {EmbedToolspaceTopRow} from '../embed/embed-toolspace-top-row';
import {
    IGradient,
    IInitState,
    IKlProject, IRGB,
    TDrawEvent,
    TExportType,
    TKlCanvasLayer,
    TUiLayout,
} from '../klecks/kl-types';
import {importFilters} from '../klecks/filters/filters-lazy';
import {base64ToBlob} from '../klecks/storage/base-64-to-blob';
import {klCanvasToPsdBlob} from '../klecks/storage/kl-canvas-to-psd-blob';
import {ProjectStore} from '../klecks/storage/project-store';
import {SaveReminder} from '../klecks/ui/components/save-reminder';
import {KlCanvasWorkspace} from '../klecks/canvas-ui/kl-canvas-workspace';
import {KlCanvas} from '../klecks/canvas/kl-canvas';
import {LANG} from '../language/language';
import {LocalStorage} from '../bb/base/local-storage';
import {LineSmoothing} from '../klecks/events/line-smoothing';
import {LineSanitizer} from '../klecks/events/line-sanitizer';
import {TabRow} from '../klecks/ui/components/tab-row';
import {LayerPreview} from '../klecks/ui/components/layer-preview';
import {KlColorSlider} from '../klecks/ui/components/kl-color-slider';
import {ToolspaceToolRow} from '../klecks/ui/components/toolspace-tool-row';
import {StatusOverlay} from '../klecks/ui/components/status-overlay';
import {SaveToComputer} from '../klecks/storage/save-to-computer';
import {ToolspaceCollapser} from '../klecks/ui/components/toolspace-collapser';
import {ToolspaceScroller} from '../klecks/ui/components/toolspace-scroller';
import {translateSmoothing} from '../klecks/utils/translate-smoothing';
import {ImportHandler} from './import-handler';

import toolPaintImg from '/src/app/img/ui/tool-paint.svg';
import toolHandImg from '/src/app/img/ui/tool-hand.svg';
import toolFillImg from '/src/app/img/ui/tool-fill.svg';
import toolGradientImg from '/src/app/img/ui/tool-gradient.svg';
import toolTextImg from '/src/app/img/ui/tool-text.svg';
import toolShapeImg from '/src/app/img/ui/tool-shape.svg';
import tabSettingsImg from '/src/app/img/ui/tab-settings.svg';
import tabLayersImg from '/src/app/img/ui/tab-layers.svg';
import {LayerManager} from '../klecks/ui/tool-tabs/layer-manager/layer-manager';
import {IVector2D} from '../bb/bb-types';
import {createConsoleApi} from './console-api';
import {ERASE_COLOR} from '../klecks/brushes/erase-color';
import {throwIfNull} from '../bb/base/base';
import {klConfig} from '../klecks/kl-config';
import {TRenderTextParam} from '../klecks/image-operations/render-text';

type KlAppOptionsEmbed = {
    url: string;
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
};

interface IKlAppOptions {
    saveReminder?: SaveReminder;
    projectStore?: ProjectStore;
    logoImg?: string; // app logo
    bottomBar?: HTMLElement; // row at bottom of toolspace
    embed?: KlAppOptionsEmbed;
    app?: {
        imgurKey?: string; // for imgur uploads
    };
    aboutEl?: HTMLElement; // replaces info about Klecks in settings tab
}

importFilters();

export class KlApp {

    private readonly klRootEl: HTMLElement;
    private uiWidth: number;
    private uiHeight: number;
    private readonly layerPreview: LayerPreview;
    private readonly klColorSlider: KlColorSlider;
    private readonly toolspaceToolRow: ToolspaceToolRow;
    private readonly statusOverlay: StatusOverlay;
    private readonly klCanvas: KlCanvas;
    private uiState: TUiLayout;
    private readonly embed: undefined | KlAppOptionsEmbed;
    private readonly saveToComputer: SaveToComputer;
    private readonly lineSanitizer: LineSanitizer;
    private readonly klCanvasWorkspace: KlCanvasWorkspace;
    private readonly collapseThreshold: number = 820;
    private readonly toolspaceCollapser: ToolspaceCollapser;
    private readonly toolspace: HTMLElement;
    private readonly toolspaceInner: HTMLElement;
    private readonly toolWidth: number = 271;
    private readonly bottomBar: HTMLElement | undefined;
    private readonly layerManager: LayerManager;
    private readonly toolspaceScroller: ToolspaceScroller;
    private readonly bottomBarWrapper: HTMLElement;

    private updateCollapse (): void {

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
                    BB.css(this.klCanvasWorkspace.getElement(), {
                        left: '271px',
                    });
                } else {
                    BB.css(this.toolspaceCollapser.getElement(), {
                        left: '',
                        right: '271px',
                    });
                    BB.css(this.klCanvasWorkspace.getElement(), {
                        left: '0',
                    });
                }
                this.toolspace.style.display = 'block';
                this.klCanvasWorkspace.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
                this.statusOverlay.setWide(false);

            } else {
                if (this.uiState === 'left') {
                    BB.css(this.toolspaceCollapser.getElement(), {
                        left: '0',
                        right: '',
                    });
                    BB.css(this.klCanvasWorkspace.getElement(), {
                        left: '0',
                    });
                } else {
                    BB.css(this.toolspaceCollapser.getElement(), {
                        left: '',
                        right: '0',
                    });
                    BB.css(this.klCanvasWorkspace.getElement(), {
                        left: '0',
                    });
                }
                this.toolspace.style.display = 'none';
                this.klCanvasWorkspace.setSize(Math.max(0, this.uiWidth), this.uiHeight);
                this.statusOverlay.setWide(true);

            }

        } else {
            this.toolspaceCollapser.getElement().style.display = 'none';
            if (this.uiState === 'left') {
                BB.css(this.klCanvasWorkspace.getElement(), {
                    left: '271px',
                });
            } else {
                BB.css(this.klCanvasWorkspace.getElement(), {
                    left: '0',
                });
            }
            this.toolspace.style.display = 'block';
            this.klCanvasWorkspace.setSize(Math.max(0, this.uiWidth - this.toolWidth), this.uiHeight);
            this.statusOverlay.setWide(false);
        }
    }

    private updateBottomBar (): void {
        if (!this.bottomBar) {
            return;
        }
        const isVisible = (this.toolspaceInner.scrollHeight + 40 < window.innerHeight);
        const newDisplay = isVisible ? '' : 'none';
        // check to prevent infinite MutationObserver loop in Pale Moon
        if (newDisplay !== this.bottomBarWrapper.style.display) {
            this.bottomBarWrapper.style.display = newDisplay;
        }
    }

    private updateUi (): void {
        this.toolspace.classList.toggle('kl-toolspace--left', this.uiState === 'left');
        this.toolspace.classList.toggle('kl-toolspace--right', this.uiState === 'right');
        if (this.uiState === 'left') {
            BB.css(this.toolspace, {
                left: '0',
                right: '',
            });
            BB.css(this.klCanvasWorkspace.getElement(), {
                left: '271px',
            });
        } else {
            BB.css(this.toolspace, {
                left: '',
                right: '0',
            });
            BB.css(this.klCanvasWorkspace.getElement(), {
                left: '0',
            });
        }
        this.statusOverlay.setUiState(this.uiState);
        this.layerPreview.setUiState(this.uiState);
        this.layerManager.setUiState(this.uiState);
        this.updateCollapse();
        this.toolspaceScroller.updateUiState(this.uiState);
    }

    // -------- public --------
    constructor (
        pProject: IKlProject | null,
        pOptions: IKlAppOptions,
    ) {
        this.embed = pOptions.embed;
        // default 2048, unless your screen is bigger than that (that computer then probably has the horsepower for that)
        // but not larger than 4096 - a fairly arbitrary decision
        const klMaxCanvasSize = Math.min(4096, Math.max(2048, Math.max(window.screen.width, window.screen.height)));
        this.uiState = (this.embed ? 'left' : (LocalStorage.getItem('uiState') ? LocalStorage.getItem('uiState') : 'right')) as TUiLayout;
        const projectStore = pOptions.projectStore;
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
            pProject ? {
                projectObj: pProject,
            } : {
                width: Math.max(10, Math.min(klMaxCanvasSize, window.innerWidth < this.collapseThreshold ? this.uiWidth : this.uiWidth - this.toolWidth)),
                height: Math.max(10, Math.min(klMaxCanvasSize, this.uiHeight)),
            }, this.embed ? -1 : 0);
        this.klCanvas.setHistory(klHistory);
        let initState: IInitState;
        let mainTabRow: TabRow | undefined = undefined;

        if (!pOptions.saveReminder) {
            pOptions.saveReminder = {init: () => {}, reset: () => {}} as SaveReminder;
        }

        if (pProject) {
            // attempt at freeing memory
            pProject.layers.forEach(layer => {
                layer.image = null as any;
            });
            pProject = null;
        } else {
            klHistory.pause(true);
            this.klCanvas.addLayer();
            this.klCanvas.layerFill(0, {r: ERASE_COLOR, g: ERASE_COLOR, b: ERASE_COLOR});
            klHistory.pause(false);
        }
        try {
            initState = {
                canvas: new KL.KlCanvas({copy: this.klCanvas}, this.embed ? -1 : 0),
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
            initState.brushes[b] = new Brush();
            if (initState.canvas) {
                initState.brushes[b].setContext(initState.canvas.getLayerContext(initState.focus));
            }
        });


        let currentColor = new BB.RGB(0, 0, 0);
        let currentBrushUi: any; // todo
        let currentBrushId: string;
        let lastNonEraserBrushId: string;
        let currentLayerCtx = throwIfNull(this.klCanvas.getLayerContext(this.klCanvas.getLayerCount() - 1));

        // when cycling through brushes you need to know the next non-eraser brush
        const getNextBrushId = (): string => {
            if (currentBrushId === 'eraserBrush') {
                return lastNonEraserBrushId;
            }
            const keyArr = Object.keys(brushUiMap).filter(item => item !== 'eraserBrush');
            const i = keyArr.findIndex(item => item === currentBrushId);
            return keyArr[(i + 1) % keyArr.length];
        };

        const sizeWatcher = (val: number) => {
            brushSettingService.emitSize(val);
            if (this.klCanvasWorkspace) {
                this.klCanvasWorkspace.setCursorSize(val * 2);
            }
        };

        const brushSettingService = new KL.BrushSettingService(
            (color) => {
                this.klColorSlider.setColor(color);
                currentBrushUi.setColor(color);
                currentColor = BB.copyObj(color);
            },
            (size) => {
                currentBrushUi.setSize(size);
                this.klCanvasWorkspace.setCursorSize(size * 2);
            },
            (opacity) => {
                currentBrushUi.setOpacity(opacity);
            },
            () => this.klColorSlider.getColor(),
            () => brushUiMap[currentBrushId].getSize(),
            () => brushUiMap[currentBrushId].getOpacity(),
            () => {
                return {
                    sizeSlider: KL.brushesUI[currentBrushId].sizeSlider,
                    opacitySlider: KL.brushesUI[currentBrushId].opacitySlider,
                };
            }
        );

        const lineSmoothing = new LineSmoothing({
            smoothing: translateSmoothing(1),
        });
        this.lineSanitizer = new LineSanitizer();

        const drawEventChain = new BB.EventChain({
            chainArr: [
                this.lineSanitizer as any,
                lineSmoothing as any,
            ],
        });

        drawEventChain.setChainOut(((event: TDrawEvent) => {
            if (event.type === 'down') {
                this.toolspace.style.pointerEvents = 'none';
                currentBrushUi.startLine(event.x, event.y, event.pressure);
                this.klCanvasWorkspace.requestFrame();
            }
            if (event.type === 'move') {
                currentBrushUi.goLine(event.x, event.y, event.pressure, false, event.isCoalesced);
                this.klCanvasWorkspace.setLastDrawEvent(event.x, event.y, event.pressure);
                this.klCanvasWorkspace.requestFrame();
            }
            if (event.type === 'up') {
                this.toolspace.style.pointerEvents = '';
                currentBrushUi.endLine();
                this.klCanvasWorkspace.requestFrame();
            }
            if (event.type === 'line') {
                currentBrushUi.getBrush().drawLineSegment(event.x0, event.y0, event.x1, event.y1);
                this.klCanvasWorkspace.requestFrame();
            }
        }) as any);

        let textToolSettings = {
            size: 20,
            align: 'left' as ('left' | 'center' | 'right'),
            isBold: false,
            isItalic: false,
            font: 'sans-serif',
            letterSpacing: 0,
            lineHeight: 1,
            fill: {
                color: {r: 0, g: 0, b: 0, a: 1},
            },
        } as TRenderTextParam;

        this.klCanvasWorkspace = new KL.KlCanvasWorkspace({
            klCanvas: this.klCanvas,
            width: Math.max(0, this.uiWidth - this.toolWidth),
            height: this.uiHeight,
            onDraw: (e) => drawEventChain.chainIn(e as any),
            onPick: (rgbObj, isDragDone) => {
                brushSettingService.setColor(rgbObj);
                if (isDragDone) {
                    this.klColorSlider.pickingDone();
                    this.klCanvasWorkspace.setMode(this.toolspaceToolRow.getActive());
                }
            },
            onFill: (canvasX, canvasY) => {
                const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas));
                this.klCanvas.floodFill(
                    layerIndex,
                    canvasX,
                    canvasY,
                    fillUi.getIsEraser() ? null : this.klColorSlider.getColor(),
                    fillUi.getOpacity(),
                    fillUi.getTolerance(),
                    fillUi.getSample(),
                    fillUi.getGrow(),
                    fillUi.getContiguous()
                );
                this.klCanvasWorkspace.requestFrame();
            },
            onGradient: (typeStr, canvasX, canvasY, angleRad) => {
                if (typeStr === 'down') {
                    gradientTool.onDown(canvasX, canvasY, angleRad);
                }
                if (typeStr === 'move') {
                    gradientTool.onMove(canvasX, canvasY);
                }
                if (typeStr === 'up') {
                    gradientTool.onUp(canvasX, canvasY);
                }
            },
            onText: (canvasX, canvasY, angleRad) => {
                if (KL.dialogCounter.get() > 0) {
                    return;
                }

                KL.textToolDialog({
                    klCanvas: this.klCanvas,
                    layerIndex: throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas)),
                    primaryColor: this.klColorSlider.getColor(),
                    secondaryColor: this.klColorSlider.getSecondaryRGB(),

                    text: {
                        ...textToolSettings,
                        text: '',
                        x: canvasX,
                        y: canvasY,
                        angleRad: angleRad,
                        fill : textToolSettings.fill ? {
                            color: {
                                ...this.klColorSlider.getColor(),
                                a: textToolSettings.fill.color.a,
                            },
                        } : undefined,
                        stroke : textToolSettings.stroke ? {
                            ...textToolSettings.stroke,
                            color: {
                                ...this.klColorSlider.getSecondaryRGB(),
                                a: textToolSettings.stroke.color.a,
                            },
                        } : undefined,
                    },

                    onConfirm: (val) => {
                        textToolSettings = {
                            ...val,
                            text: '',
                        };
                        const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas));
                        this.klCanvas.text(layerIndex, val);
                        this.klCanvasWorkspace.requestFrame();
                    },
                });

            },
            onShape: (typeStr, canvasX, canvasY, angleRad) => {
                if (typeStr === 'down') {
                    shapeTool.onDown(canvasX, canvasY, angleRad);
                }
                if (typeStr === 'move') {
                    shapeTool.onMove(canvasX, canvasY);
                }
                if (typeStr === 'up') {
                    shapeTool.onUp(canvasX, canvasY);
                }
            },

            onViewChange: (viewChangeObj) => {

                if (viewChangeObj.changed.includes('scale')) {
                    this.statusOverlay.out({
                        type: 'transform',
                        scale: viewChangeObj.scale,
                        angleDeg: viewChangeObj.angle * 180 / Math.PI,
                    });
                }

                this.toolspaceToolRow.setEnableZoomIn(viewChangeObj.scale !== this.klCanvasWorkspace.getMaxScale());
                this.toolspaceToolRow.setEnableZoomOut(viewChangeObj.scale !== this.klCanvasWorkspace.getMinScale());

                handUi.update(viewChangeObj.scale, viewChangeObj.angle * 180 / Math.PI);
            },
            onUndo: () => {
                if (klHistory.canUndo()) {
                    if (undoRedoCatchup.undo()) {
                        this.statusOverlay.out(LANG('undo'), true);
                    }
                }
            },
            onRedo: () => {
                if (klHistory.canRedo()) {
                    if (undoRedoCatchup.redo()) {
                        this.statusOverlay.out(LANG('redo'), true);
                    }
                }
            },
        });

        const updateMainTabVisibility = () => {
            if (!mainTabRow) {
                return;
            }

            const toolObj = {
                'draw': {},
                'hand': {},
                'fill': {},
                'gradient': {},
                'text': {},
                'shape': {},
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

                const isDrawing = this.lineSanitizer.getIsDrawing() || this.klCanvasWorkspace.getIsDrawing();
                if (isDrawing) {
                    return;
                }

                if (comboStr === 'plus') {
                    this.klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? 1/8 : 1/2);
                }
                if (comboStr === 'minus') {
                    this.klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? -1/8 : -1/2);
                }
                if (comboStr === 'home') {
                    this.klCanvasWorkspace.fitView(true);
                }
                if (comboStr === 'end') {
                    this.klCanvasWorkspace.resetView(true);
                }
                if (['ctrl+z', 'cmd+z'].includes(comboStr)) {
                    event.preventDefault();
                    undoRedoCatchup.undo();
                }
                if (
                    ['ctrl+y', 'cmd+y'].includes(comboStr) ||
                    (
                        (
                            BB.sameKeys('ctrl+shift+z', comboStr) ||
                            BB.sameKeys('cmd+shift+z', comboStr)
                        ) && keyStr === 'z'
                    )
                ) {
                    event.preventDefault();
                    undoRedoCatchup.redo();
                }
                if (!this.embed) {
                    if (['ctrl+s', 'cmd+s'].includes(comboStr)) {
                        event.preventDefault();
                        this.saveToComputer.save();
                    }
                    if (['ctrl+shift+s', 'cmd+shift+s'].includes(comboStr)) {
                        event.preventDefault();

                        (async () => {
                            let success = true;
                            try {
                                await projectStore!.store(this.klCanvas.getProject());
                            } catch (e) {
                                success = false;
                                setTimeout(() => {
                                    throw new Error('keyboard-shortcut: failed to store browser storage, ' + e);
                                }, 0);
                                this.statusOverlay.out('❌ ' + LANG('file-storage-failed'), true);
                            }
                            if (success) {
                                pOptions.saveReminder!.reset();
                                this.statusOverlay.out(LANG('file-storage-stored'), true);
                            }
                        })();
                    }
                    if (['ctrl+c', 'cmd+c'].includes(comboStr)) {
                        event.preventDefault();
                        copyToClipboard(true);
                    }
                }
                if (['ctrl+a', 'cmd+a'].includes(comboStr)) {
                    event.preventDefault();
                }


                if (keyListener.comboOnlyContains(['left', 'right', 'up', 'down'])) {
                    if (keyStr === 'left') {
                        this.klCanvasWorkspace.translateView(1, 0);
                    }
                    if (keyStr === 'right') {
                        this.klCanvasWorkspace.translateView(-1, 0);
                    }
                    if (keyStr === 'up') {
                        this.klCanvasWorkspace.translateView(0, 1);
                    }
                    if (keyStr === 'down') {
                        this.klCanvasWorkspace.translateView(0, -1);
                    }
                }


                if (['r+left','r+right'].includes(comboStr)) {
                    if (keyStr === 'left') {
                        this.klCanvasWorkspace.setAngle(-15, true);
                        handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
                    }
                    if (keyStr === 'right') {
                        this.klCanvasWorkspace.setAngle(15, true);
                        handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
                    }
                }
                if (['r+up'].includes(comboStr)) {
                    this.klCanvasWorkspace.setAngle(0);
                    handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
                }


                if (comboStr === 'sqbr_open') {
                    currentBrushUi.decreaseSize(Math.max(0.005, 0.03 / this.klCanvasWorkspace.getScale()));
                }
                if (comboStr === 'sqbr_close') {
                    currentBrushUi.increaseSize(Math.max(0.005, 0.03 / this.klCanvasWorkspace.getScale()));
                }
                if (comboStr === 'enter') {
                    this.klCanvas.layerFill(
                        throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas)),
                        this.klColorSlider.getColor(),
                    );
                    this.statusOverlay.out(LANG('filled'), true);
                }
                if (['delete', 'backspace'].includes(comboStr)) {
                    const layerIndex = throwIfNull(this.klCanvas.getLayerIndex(currentLayerCtx.canvas));
                    if (layerIndex === 0 && !brushUiMap.eraserBrush.getIsTransparentBg()) {
                        this.klCanvas.layerFill(layerIndex, {r: 255, g: 255, b: 255}, 'source-in');
                    } else {
                        this.klCanvas.clearLayer(layerIndex);
                    }
                    this.statusOverlay.out(LANG('cleared-layer'), true);
                }
                if (comboStr === 'shift+e') {
                    event.preventDefault();
                    currentBrushUi.toggleEraser && currentBrushUi.toggleEraser();

                } else if (comboStr === 'e') {
                    event.preventDefault();
                    this.klCanvasWorkspace.setMode('draw');
                    this.toolspaceToolRow.setActive('draw');
                    mainTabRow && mainTabRow.open('draw');
                    updateMainTabVisibility();
                    brushTabRow.open('eraserBrush');
                }
                if (comboStr === 'b') {
                    event.preventDefault();
                    const prevMode = this.klCanvasWorkspace.getMode();
                    this.klCanvasWorkspace.setMode('draw');
                    this.toolspaceToolRow.setActive('draw');
                    mainTabRow && mainTabRow.open('draw');
                    updateMainTabVisibility();
                    brushTabRow.open(prevMode === 'draw' ? getNextBrushId() : currentBrushId);
                }
                if (comboStr === 'g') {
                    event.preventDefault();
                    const newMode = this.klCanvasWorkspace.getMode() === 'fill' ? 'gradient' : 'fill';
                    this.klCanvasWorkspace.setMode(newMode);
                    this.toolspaceToolRow.setActive(newMode);
                    mainTabRow && mainTabRow.open(newMode);
                    updateMainTabVisibility();
                }
                if (comboStr === 't') {
                    event.preventDefault();
                    this.klCanvasWorkspace.setMode('text');
                    this.toolspaceToolRow.setActive('text');
                    mainTabRow && mainTabRow.open('text');
                    updateMainTabVisibility();
                }
                if (comboStr === 'u') {
                    event.preventDefault();
                    this.klCanvasWorkspace.setMode('shape');
                    this.toolspaceToolRow.setActive('shape');
                    mainTabRow && mainTabRow.open('shape');
                    updateMainTabVisibility();
                }
                if (comboStr === 'x') {
                    event.preventDefault();
                    this.klColorSlider.swapColors();
                }


            },
            onUp: (keyStr, event) => {
            },
        });

        const brushUiMap: {
            [key: string]: any;
        } = {};
        // create brush UIs
        Object.entries(KL.brushesUI).forEach(([b, brushUi]) => {
            const ui = new (brushUi.Ui as any)({
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

        this.statusOverlay = new KL.StatusOverlay();

        this.toolspace = BB.el({
            className: 'kl-toolspace',
            css: {
                position: 'absolute',
                right: '0',
                top: '0',
                bottom: '0',
                width: (this.toolWidth) + 'px',
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
                    return KL.dialogCounter.get() === 0 && !this.lineSanitizer.getIsDrawing();
                },
                brushSettingService,
            });
            this.klRootEl.append(overlayToolspace.getElement());
        }, 0);

        BB.append(
            this.klRootEl,
            [
                this.klCanvasWorkspace.getElement(),
                this.toolspace,
                this.toolspaceCollapser.getElement(),
            ]
        );

        let toolspaceTopRow;
        if (this.embed) {
            toolspaceTopRow = new EmbedToolspaceTopRow({
                onHelp: () => {
                    showIframeModal(this.embed!.url + '/help.html', !!this.embed);
                },
                onSubmit: () => {
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
                                    pOptions.saveReminder!.reset();
                                    overlay.remove();
                                },
                                () => {
                                    overlay.remove();
                                    onFailure();
                                });
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
                logoImg: pOptions.logoImg!,
                onLogo: () => {
                    showIframeModal('./home/', !!this.embed);
                },
                onNew: () => {
                    showNewImageDialog();
                },
                onImport: () => {
                    fileTab!.triggerImport();
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
                if (activeStr === 'draw') {
                    this.klCanvasWorkspace.setMode('draw');
                } else if (activeStr === 'hand') {
                    this.klCanvasWorkspace.setMode('hand');
                } else if (activeStr === 'fill') {
                    this.klCanvasWorkspace.setMode('fill');
                } else if (activeStr === 'gradient') {
                    this.klCanvasWorkspace.setMode('gradient');
                } else if (activeStr === 'text') {
                    this.klCanvasWorkspace.setMode('text');
                } else if (activeStr === 'shape') {
                    this.klCanvasWorkspace.setMode('shape');
                } else {
                    throw new Error('unknown activeStr');
                }
                mainTabRow && mainTabRow.open(activeStr);
                updateMainTabVisibility();
                this.klColorSlider.pickingDone();
            },
            onZoomIn: () => {
                this.klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? 1/8 : 1/2);
            },
            onZoomOut: () => {
                this.klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? -1/8 : -1/2);
            },
            onUndo: () => {
                undoRedoCatchup.undo();
            },
            onRedo: () => {
                undoRedoCatchup.redo();
            },
        });
        this.toolspaceToolRow.setIsSmall(this.uiHeight < 540);
        klHistory.addListener(() => {
            this.toolspaceToolRow.setEnableUndo(klHistory.canUndo());
            this.toolspaceToolRow.setEnableRedo(klHistory.canRedo());
        });
        this.toolspaceInner.append(this.toolspaceToolRow.getElement());

        const setBrushColor = (p_color: IRGB) => {
            currentColor = p_color;
            currentBrushUi.setColor(p_color);
            brushSettingService.emitColor(p_color);
            this.klColorSlider.pickingDone();
        };

        this.klColorSlider = new KL.KlColorSlider({
            width: 250,
            height: 30,
            svHeight: 100,
            startValue: new BB.RGB(0, 0, 0),
            onPick: setBrushColor,
        });
        this.klColorSlider.setHeight(Math.max(163, Math.min(400, this.uiHeight - 505)));
        this.klColorSlider.setPickCallback((doPick) => {

            if (doPick) {
                this.klCanvasWorkspace.setMode('pick');
            } else {
                this.klCanvasWorkspace.setMode(this.toolspaceToolRow.getActive());
                updateMainTabVisibility();
            }

        });

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
            this.klCanvasWorkspace.setMode('draw');
            this.toolspaceToolRow.setActive('draw');
            updateMainTabVisibility();
        };

        const setCurrentLayer = (layer: TKlCanvasLayer) => { //BrushContext(p_context) {
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
            smoothing: 1,
            onSelect: (v) => {
                lineSmoothing.setSmoothing(translateSmoothing(v));
            },
        });


        brushDiv.append(colorDiv);
        BB.append(
            colorDiv,
            [this.klColorSlider.getElement(), this.klColorSlider.getOutputElement(), toolspaceStabilizerRow.getElement()]
        );

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
        BB.append(brushDiv, [
            brushTabRow.getElement(),
            ...Object.entries(KL.brushesUI).map(([b]) => brushUiMap[b].getElement()),
        ]);

        const handUi = new KL.HandUi({
            scale: this.klCanvasWorkspace.getScale(),
            angleDeg: 0,
            onReset: () => {
                this.klCanvasWorkspace.resetView(true);
                handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
            },
            onFit: () => {
                this.klCanvasWorkspace.fitView(true);
                handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
            },
            onAngleChange: (angleDeg, isRelative) => {
                this.klCanvasWorkspace.setAngle(angleDeg, isRelative);
                handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
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
                    this.klCanvas.setComposite(layerIndex, null);
                    this.klCanvas.drawGradient(layerIndex, gradientObj);
                } else {
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawGradient(ctx, gradientObj);
                        },
                    });
                }
                this.klCanvasWorkspace.requestFrame();
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
                    this.klCanvas.setComposite(layerIndex, null);
                    this.klCanvas.drawShape(layerIndex, shapeObj);
                } else {
                    this.klCanvas.setComposite(layerIndex, {
                        draw: (ctx) => {
                            KL.drawShape(ctx, shapeObj);
                        },
                    });
                }
                this.klCanvasWorkspace.requestFrame();

            },
        });

        this.layerManager = new KL.LayerManager(
            this.klCanvas,
            (val) => {
                setCurrentLayer(throwIfNull(this.klCanvas.getLayer(val)));
                klHistory.push({
                    tool: ['misc'],
                    action: 'focusLayer',
                    params: [val],
                } as TMiscFocusLayerHistoryEntry);
            },
            this.klRootEl,
            this.uiState,
        );
        this.layerPreview = new KL.LayerPreview({
            klRootEl: this.klRootEl,
            onClick: () => {
                mainTabRow && mainTabRow.open('layers');
            },
            uiState: this.uiState,
        });
        this.layerPreview.setIsVisible(this.uiHeight >= 579);
        this.layerPreview.setLayer(this.klCanvas.getLayer(this.klCanvas.getLayerIndex(currentLayerCtx.canvas)!)!);

        const filterTab = new KL.FilterTab(
            this.klRootEl,
            this.klColorSlider,
            this.layerManager,
            this.klCanvasWorkspace,
            handUi,
            () => currentColor,
            () => klMaxCanvasSize,
            () => this.klCanvas,
            () => currentLayerCtx,
            !!this.embed,
            this.statusOverlay,
        );

        const undoRedoCatchup = new KL.UndoRedoCatchup(
            brushUiMap,
            this.layerPreview,
            this.layerManager,
            handUi,
            this.klCanvasWorkspace,
            () => {
                if (!initState) {
                    throw new Error('initState not initialized');
                }
                return initState;
            },
            () => this.klCanvas,
            () => currentLayerCtx,
            (ctx) => {
                currentLayerCtx = ctx;
            },
            () => currentBrushUi,
        );
        klHistory.addListener((p) => {
            undoRedoCatchup.catchup(p);
        });

        const showNewImageDialog = () => {
            KL.newImageDialog({
                currentColor: currentColor,
                secondaryColor: this.klColorSlider.getSecondaryRGB(),
                maxCanvasSize: klMaxCanvasSize,
                canvasWidth: this.klCanvas.getWidth(),
                canvasHeight: this.klCanvas.getHeight(),
                workspaceWidth: window.innerWidth < this.collapseThreshold ? this.uiWidth : this.uiWidth - this.toolWidth,
                workspaceHeight: this.uiHeight,
                onConfirm: (width, height, color) => {
                    this.klCanvas.reset({
                        width: width,
                        height: height,
                        color: color.a === 1 ? color : undefined,
                    });

                    this.layerManager.update(0);
                    setCurrentLayer(throwIfNull(this.klCanvas.getLayer(0)));
                    this.klCanvasWorkspace.resetOrFitView();
                    handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
                },
                onCancel: () => {},
            });
        };

        const shareImage = (callback?: () => void) => {
            BB.shareCanvas({
                canvas: this.klCanvas.getCompleteCanvas(1),
                fileName: BB.getDate() + klConfig.filenameBase + '.png',
                title: BB.getDate() + klConfig.filenameBase + '.png',
                callback: callback ? callback : () => {},
            });
        };

        this.saveToComputer = new KL.SaveToComputer(
            pOptions.saveReminder,
            () => exportType,
            () => this.klCanvas,
        );

        const copyToClipboard = (showCrop?: boolean) => {
            KL.clipboardDialog(
                this.klRootEl,
                this.klCanvas.getCompleteCanvas(1),
                (inputObj) => {
                    if (inputObj.left === 0 && inputObj.right === 0 && inputObj.top === 0 && inputObj.bottom === 0) {
                        return;
                    }
                    //do a crop
                    KL.filterLib.cropExtend.apply!({
                        context: currentLayerCtx,
                        klCanvas: this.klCanvas,
                        input: inputObj,
                        history: klHistory,
                    });
                    this.layerManager.update();
                    this.klCanvasWorkspace.resetOrFitView();
                    handUi.update(this.klCanvasWorkspace.getScale(), this.klCanvasWorkspace.getAngleDeg());
                },
                this.statusOverlay,
                showCrop || false,
            );
        };

        const fileTab = this.embed ? null : new KL.FileTab(
            this.klRootEl,
            projectStore!,
            () => this.klCanvas.getProject(),
            exportType,
            (type) => {
                exportType = type;
            },
            (files, optionsStr) => importHandler.handleFileSelect(files, optionsStr),
            () => this.saveToComputer.save(),
            showNewImageDialog,
            shareImage,
            () => { // on upload
                KL.imgurUpload(
                    this.klCanvas,
                    this.klRootEl,
                    pOptions.saveReminder!,
                    pOptions.app && pOptions.app.imgurKey ? pOptions.app.imgurKey : '',
                );
            },
            copyToClipboard,
            pOptions.saveReminder,
        );

        const settingsTab = new KL.SettingsTab(
            () => {
                this.uiState = this.uiState === 'left' ? 'right' : 'left';
                this.updateUi();
                if (!this.embed) {
                    LocalStorage.setItem('uiState', this.uiState);
                }
            },
            this.embed ? undefined : pOptions.saveReminder,
            pOptions.aboutEl,
        );

        mainTabRow = new KL.TabRow({
            initialId: 'draw',
            tabArr: [
                {
                    id: 'draw',
                    title: LANG('tool-brush'),
                    image: toolPaintImg,
                    onOpen: () => {
                        if (currentBrushId === 'eraserBrush') {
                            this.klColorSlider.enable(false);
                        }
                        BB.append(
                            colorDiv,
                            [this.klColorSlider.getElement(), this.klColorSlider.getOutputElement(), toolspaceStabilizerRow.getElement()]
                        );
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
                    id: 'fill',
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
                    id: 'layers',
                    title: LANG('layers'),
                    image: tabLayersImg,
                    onOpen: () => {
                        this.layerManager.update();
                        this.layerManager.getElement().style.display = 'block';
                    },
                    onClose: () => {
                        this.layerManager.getElement().style.display = 'none';
                    },
                    css: {
                        minWidth: '45px',
                    },
                },
                {
                    id: 'edit',
                    label: LANG('tab-edit'),
                    onOpen: () => {
                        filterTab.show();
                    },
                    onClose: () => {
                        filterTab.hide();
                    },
                    css: {
                        padding: '0 7px',
                    },
                },
                {
                    id: 'file',
                    label: LANG('tab-file'),
                    isVisible: !!fileTab,
                    onOpen: () => {
                        if (!fileTab) {
                            return;
                        }
                        fileTab.getElement().style.display = 'block';
                        fileTab.setIsVisible(true);
                    },
                    onClose: () => {
                        if (!fileTab) {
                            return;
                        }
                        fileTab.getElement().style.display = 'none';
                        fileTab.setIsVisible(false);
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
                        settingsTab.getElement().style.display = 'block';
                        // settingsTab.setIsVisible(true);
                    },
                    onClose: () => {
                        settingsTab.getElement().style.display = 'none';
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
        if (pOptions.bottomBar) {
            this.bottomBar = pOptions.bottomBar;
            this.bottomBarWrapper.append(this.bottomBar);
            const observer = new MutationObserver(() => this.updateBottomBar());
            observer.observe(
                this.toolspaceInner,
                {
                    attributes: true,
                    childList: true,
                    subtree: true,
                }
            );
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
            this.layerManager.getElement(),
            filterTab.getElement(),
            fileTab ? fileTab.getElement() : undefined,
            settingsTab.getElement(),
            BB.el({
                css: {
                    height: '10px', // a bit of spacing at the bottom
                },
            }),
            this.bottomBarWrapper ? this.bottomBarWrapper : undefined,
        ]);

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
                        this.klCanvasWorkspace.requestFrame();
                    },
                }),
                writable: false,
            });
        }

        this.resize(this.uiWidth, this.uiHeight);
        this.updateUi();

        const importHandler = new ImportHandler({
            klRootEl: this.klRootEl,
            klMaxCanvasSize,
            layerManager: this.layerManager,
            setCurrentLayer,
            klCanvas: this.klCanvas,
            klCanvasWorkspace: this.klCanvasWorkspace,
            handUi,
        }, {
            onColor: (rgb) => brushSettingService.setColor(rgb),
        });

        if (!this.embed) {
            new KL.KlImageDropper({
                target: document.body,
                onDrop: (files, optionStr) => {
                    if (KL.dialogCounter.get() > 0) {
                        return;
                    }
                    importHandler.handleFileSelect(files, optionStr);
                },
                enabledTest: () => {
                    return KL.dialogCounter.get() === 0;
                },
            });

            window.document.addEventListener(
                'paste',
                (e: ClipboardEvent) => importHandler.onPaste(e),
                false
            );
        }

        {
            window.addEventListener('resize', () => {
                this.resize(window.innerWidth, window.innerHeight);
            });
            window.addEventListener('orientationchange', () => {
                this.resize(window.innerWidth, window.innerHeight);
            });

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
                const observer = new ResizeObserver(() => this.resize(window.innerWidth, window.innerHeight));
                observer.observe(windowResizeWatcher);
            } catch (e) {
                windowResizeWatcher.remove();
            }

            // prevent ctrl scroll -> zooming page
            this.klRootEl.addEventListener('wheel', (event) => {
                if (keyListener.isPressed('ctrl')) {
                    event.preventDefault();
                }
            });
            //maybe prevent zooming on safari mac os - todo still needed?
            const prevent = (e: Event) => {
                e.preventDefault();
            };
            window.addEventListener('gesturestart', prevent);
            window.addEventListener('gesturechange', prevent);
            window.addEventListener('gestureend', prevent);
        }
    }

    // -------- interface --------

    getEl (): HTMLElement {
        return this.klRootEl;
    }

    resize (w: number, h: number): void {

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

    out (msg: string): void {
        this.statusOverlay.out(msg);
    }

    getPNG (): Blob {
        return base64ToBlob(this.klCanvas.getCompleteCanvas(1).toDataURL('image/png'));
    }

    getPSD = async ():  Promise<Blob> => {
        return await klCanvasToPsdBlob(this.klCanvas);
    };

    getProject (): IKlProject {
        return this.klCanvas.getProject();
    }

    swapUiLeftRight (): void {
        this.uiState = this.uiState === 'left' ? 'right' : 'left';
        if (!this.embed) {
            LocalStorage.setItem('uiState', this.uiState);
        }
        this.updateUi();
    }

    saveAsPsd (): void {
        this.saveToComputer.save('psd');
    }

    isDrawing (): boolean {
        return this.lineSanitizer.getIsDrawing() || this.klCanvasWorkspace.getIsDrawing();
    }
}
