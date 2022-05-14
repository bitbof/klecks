import {KL} from '../klecks/kl';
import {klHistory} from '../klecks/history/kl-history';
import {BB} from '../bb/bb';
import {showIframePopup} from '../klecks/ui/modals/show-iframe-popup';
// @ts-ignore
import newImageImg from 'url:~/src/app/img/ui/new-image.svg';
// @ts-ignore
import exportImg from 'url:~/src/app/img/ui/export.svg';
// @ts-ignore
import shareImg from 'url:~/src/app/img/ui/share.svg';
// @ts-ignore
import uploadImg from 'url:~/src/app/img/ui/upload.svg';
// @ts-ignore
import importImg from 'url:~/src/app/img/ui/import.svg';
import {exportType} from '../klecks/ui/tool-tabs/file-tab';
import {ToolspaceTopRow} from "../embed/toolspace-top-row";
import {IInitState, IKlProject, IKlPsd} from '../klecks/kl.types';
import {importFilters} from '../klecks/filters/filters-lazy';
import {base64ToBlob} from '../klecks/storage/base-64-to-blob';
import {klCanvasToPsdBlob} from '../klecks/storage/kl-canvas-to-psd-blob';
import {ProjectStore} from '../klecks/storage/project-store';
import {SaveReminder} from "../klecks/ui/components/save-reminder";
import {KlCanvasWorkspace} from '../klecks/canvas-ui/kl-canvas-workspace';
import {KlCanvas} from '../klecks/canvas/kl-canvas';
import {LANG} from '../language/language';
// @ts-ignore
import toolPaintImg from 'url:~/src/app/img/ui/tool-paint.svg';
// @ts-ignore
import toolHandImg from 'url:~/src/app/img/ui/tool-hand.svg';
// @ts-ignore
import toolFillImg from 'url:~/src/app/img/ui/tool-fill.svg';
// @ts-ignore
import toolTextImg from 'url:~/src/app/img/ui/tool-text.svg';
// @ts-ignore
import toolShapeImg from 'url:~/src/app/img/ui/tool-shape.svg';
// @ts-ignore
import tabSettingsImg from 'url:~/src/app/img/ui/tab-settings.svg';
// @ts-ignore
import tabLayersImg from 'url:~/src/app/img/ui/tab-layers.svg';
import {LocalStorage} from '../bb/base/local-storage';


interface IKlAppOptions {
    saveReminder?: SaveReminder;
    projectStore?: ProjectStore;
    logoImg?: any; // app logo
    bottomBar?: HTMLElement; // row at bottom of toolspace
    embed?: {
        url: string;
        onSubmit: (onSuccess: () => void, onError: () => void) => void;
    };
    app?: {
        filenameBase?: string; // part of filename when downloading drawing
        imgurKey?: string; // for imgur uploads
    };
    aboutEl?: HTMLElement; // replaces info about Klecks in settings tab
}

importFilters();

export function KlApp(pProject: IKlProject | null, pOptions: IKlAppOptions) {
    // default 2048, unless your screen is bigger than that (that computer then probably has the horsepower for that)
    // but not larger than 4096 - a fairly arbitrary decision
    let klMaxCanvasSize = Math.min(4096, Math.max(2048, Math.max(window.screen.width, window.screen.height)));
    let collapseThreshold = 820;
    let uiState: 'left' | 'right' = (pOptions.embed ? 'left' : (LocalStorage.getItem('uiState') ? LocalStorage.getItem('uiState') : 'right')) as any;
    const filenameBase = pOptions.app?.filenameBase ? pOptions.app.filenameBase : 'Klecks';
    const projectStore = pOptions.projectStore;
    let klRootEl = document.createElement("div");
    klRootEl.className = 'g-root';
    let uiWidth: number = Math.max(0, window.innerWidth);
    let uiHeight: number = Math.max(0, window.innerHeight);
    const toolWidth = 271;
    let exportType: exportType = 'png';
    let klCanvas: KlCanvas = new KL.KlCanvas(
        pProject ? {
            projectObj: pProject
        } : {
            width: Math.max(10, Math.min(klMaxCanvasSize, window.innerWidth < collapseThreshold ? uiWidth : uiWidth - toolWidth)),
            height: Math.max(10, Math.min(klMaxCanvasSize, uiHeight)),
        }, pOptions.embed ? -1 : 0);
    klCanvas.setHistory(klHistory);
    let initState: IInitState = null;
    let mainTabRow;

    if (!pOptions.saveReminder) {
        pOptions.saveReminder = {init: () => {}, reset: () => {}} as SaveReminder;
    }

    function translateSmoothing(s: number): number {
        if (s == 1) {
            return 1 - 0.5;
        }
        if (s == 2) {
            return 1 - 0.16;
        }
        if (s == 3) {
            return 1 - 0.035;
        }
        if (s == 4) {
            return 1 - 0.0175;
        }
        if (s == 5) {
            return 1 - 0.00875;
        }
        return s;
    }

    let isFirstImage = true;

    if (pProject) {
        pProject.layers.forEach(layer => {
            layer.image = null;
        });
        pProject = null;
    } else {
        klHistory.pause(true);
        klCanvas.addLayer();
        klCanvas.layerFill(0, { r: 255, g: 255, b: 255});
        klHistory.pause(false);
    }
    try {
        initState = {
            canvas: new KL.KlCanvas({copy: klCanvas}, pOptions.embed ? -1 : 0),
            focus: klCanvas.getLayerCount() - 1,
            brushes: {},
        };
    } catch (e) {
        if (e.message === 'kl-create-canvas-error') {
            klCanvas.destroy();
        }
        throw e;
    }
    for (let b in KL.brushes) {
        if (KL.brushes.hasOwnProperty(b)) {
            initState.brushes[b] = new KL.brushes[b]();
            if (initState.canvas) {
                initState.brushes[b].setContext(initState.canvas.getLayerContext(initState.focus));
            }
        }
    }


    let currentColor = new BB.RGB(0, 0, 0);
    let currentBrush, currentBrushId;
    let lastNonEraserBrushId = 0;
    let currentLayerCtx = klCanvas.getLayerContext(klCanvas.getLayerCount() - 1);

    function sizeWatcher(val) {
        brushSettingService.emitSize(val);
        if (klCanvasWorkspace) {
            klCanvasWorkspace.setCursorSize(val * 2);
        }
    }

    const brushSettingService = new KL.BrushSettingService(
        (color) => {
            klColorSlider.setColor(color);
            currentBrush.setColor(color);
            currentColor = BB.copyObj(color);
        },
        (size) => {
            currentBrush.setSize(size);
            klCanvasWorkspace.setCursorSize(size * 2);
        },
        (opacity) => {
            currentBrush.setOpacity(opacity);
        },
        () => klColorSlider.getColor(),
        () => brushUiObj[currentBrushId].getSize(),
        () => brushUiObj[currentBrushId].getOpacity(),
        () => {
            return {
                sizeSlider: KL.brushesUI[currentBrushId].sizeSlider,
                opacitySlider: KL.brushesUI[currentBrushId].opacitySlider,
            };
        }
    );

    let lineSmoothing = new BB.EventChain.LineSmoothing({
        smoothing: translateSmoothing(1),
    });
    let lineSanitizer = new BB.EventChain.LineSanitizer();

    let drawEventChain = new BB.EventChain.EventChain({
        chainArr: [
            lineSanitizer,
            lineSmoothing
        ],
    });

    drawEventChain.setChainOut(function(event) {
        if (event.type === 'down') {
            toolspace.style.pointerEvents = 'none';
            currentBrush.startLine(event.x, event.y, event.pressure);
            klCanvasWorkspace.requestFrame();
        }
        if (event.type === 'move') {
            currentBrush.goLine(event.x, event.y, event.pressure, false, event.isCoalesced)
            klCanvasWorkspace.setLastDrawEvent(event.x, event.y, event.pressure);
            klCanvasWorkspace.requestFrame();
        }
        if (event.type === 'up') {
            toolspace.style.pointerEvents = '';
            currentBrush.endLine();
            klCanvasWorkspace.requestFrame();
        }
        if (event.type === 'line') {
            currentBrush.getBrush().drawLineSegment(event.x0, event.y0, event.x1, event.y1);
            klCanvasWorkspace.requestFrame();
        }
    });

    let textToolSettings = {
        size: 20,
        align: 'left' as ('left' | 'center' | 'right'),
        isBold: false,
        isItalic: false,
        font: 'sans-serif' as ('serif' | 'monospace' | 'sans-serif' | 'cursive' | 'fantasy'),
        opacity: 1
    };

    const klCanvasWorkspace: KlCanvasWorkspace = new KL.KlCanvasWorkspace({
        klCanvas: klCanvas,
        width: Math.max(0, uiWidth - toolWidth),
        height: uiHeight,
        onDraw: drawEventChain.chainIn,
        onPick: function(rgbObj, isDragDone) {
            brushSettingService.setColor(rgbObj);
            if (isDragDone) {
                klColorSlider.pickingDone();
                klCanvasWorkspace.setMode(toolspaceToolRow.getActive());
            }
        },
        onFill: function(canvasX, canvasY) {
            let layerIndex = klCanvas.getLayerIndex(currentLayerCtx.canvas);
            klCanvas.floodFill(layerIndex, canvasX, canvasY, klColorSlider.getColor(), fillUi.getOpacity(), fillUi.getTolerance(), fillUi.getSample(), fillUi.getGrow(), fillUi.getContiguous());
            klCanvasWorkspace.requestFrame();
        },
        onText: function(canvasX, canvasY, angleRad) {
            if (KL.dialogCounter.get() > 0) {
                return;
            }

            KL.textToolDialog({
                klCanvas: klCanvas,
                layerIndex: klCanvas.getLayerIndex(currentLayerCtx.canvas),
                x: canvasX,
                y: canvasY,
                angleRad: angleRad,
                color: klColorSlider.getColor(),
                secondaryColor: klColorSlider.getSecondaryRGB(),
                size: textToolSettings.size,
                align: textToolSettings.align,
                isBold: textToolSettings.isBold,
                isItalic: textToolSettings.isItalic,
                font: textToolSettings.font,
                opacity: textToolSettings.opacity,
                onConfirm: function(val) {

                    let colorRGBA = val.color;
                    colorRGBA.a = val.opacity;

                    textToolSettings.size = val.size;
                    textToolSettings.align = val.align;
                    textToolSettings.isBold = val.isBold;
                    textToolSettings.isItalic = val.isItalic;
                    textToolSettings.font = val.font;
                    textToolSettings.opacity = val.opacity;

                    let layerIndex = klCanvas.getLayerIndex(currentLayerCtx.canvas);
                    klCanvas.text(layerIndex, {
                        textStr: val.textStr,
                        x: val.x,
                        y: val.y,
                        size: val.size,
                        font: val.font,
                        align: val.align,
                        isBold: val.isBold,
                        isItalic: val.isItalic,
                        angleRad: angleRad,
                        color: BB.ColorConverter.toRgbaStr(colorRGBA)
                    });
                    klCanvasWorkspace.requestFrame();
                }
            });

        },
        onShape: function(typeStr, canvasX, canvasY, angleRad) {
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

        onViewChange: function(viewChangeObj) {

            if (viewChangeObj.changed.includes('scale')) {
                statusOverlay.out({
                    type: 'transform',
                    scale: viewChangeObj.scale,
                    angleDeg: viewChangeObj.angle * 180 / Math.PI
                });
            }

            toolspaceToolRow.setEnableZoomIn(viewChangeObj.scale !== klCanvasWorkspace.getMaxScale());
            toolspaceToolRow.setEnableZoomOut(viewChangeObj.scale !== klCanvasWorkspace.getMinScale());

            handUi.update(viewChangeObj.scale, viewChangeObj.angle * 180 / Math.PI);
        },
        onUndo: function() {
            if (klHistory.canUndo()) {
                if (undoRedoCatchup.undo()) {
                    statusOverlay.out(LANG('undo'), true);
                }
            }
        },
        onRedo: function() {
            if (klHistory.canRedo()) {
                if (undoRedoCatchup.redo()) {
                    statusOverlay.out(LANG('redo'), true);
                }
            }
        },
    });
    let keyListener = new BB.KeyListener({
        onDown: function(keyStr, event, comboStr) {
            if (KL.dialogCounter.get() > 0) {
                return;
            }
            if (BB.isInputFocused(true)) {
                return;
            }

            let isDrawing = lineSanitizer.getIsDrawing() || klCanvasWorkspace.getIsDrawing();
            if (isDrawing) {
                return;
            }

            if (comboStr === 'plus') {
                klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? 1/8 : 1/2);
            }
            if (comboStr === 'minus') {
                klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? -1/8 : -1/2);
            }
            if (comboStr === 'home') {
                klCanvasWorkspace.fitView();
            }
            if (comboStr === 'end') {
                klCanvasWorkspace.resetView(true);
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
            if (!pOptions.embed) {
                if (['ctrl+s', 'cmd+s'].includes(comboStr)) {
                    event.preventDefault();
                    saveToComputer.save();
                }
                if (['ctrl+shift+s', 'cmd+shift+s'].includes(comboStr)) {
                    event.preventDefault();

                    (async () => {
                        let success = true;
                        try {
                            await projectStore.store(klCanvas.getProject());
                        } catch (e) {
                            success = false;
                            setTimeout(() => {
                                throw new Error('keyboard-shortcut: failed to store browser storage, ' + e);
                            }, 0);
                            statusOverlay.out('❌ ' + LANG('file-storage-failed'), true);
                        }
                        if (success) {
                            pOptions.saveReminder.reset();
                            statusOverlay.out(LANG('file-storage-stored'), true);
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
                    klCanvasWorkspace.translateView(1, 0);
                }
                if (keyStr === 'right') {
                    klCanvasWorkspace.translateView(-1, 0);
                }
                if (keyStr === 'up') {
                    klCanvasWorkspace.translateView(0, 1);
                }
                if (keyStr === 'down') {
                    klCanvasWorkspace.translateView(0, -1);
                }
            }


            if (['r+left','r+right'].includes(comboStr)) {
                if (keyStr === 'left') {
                    klCanvasWorkspace.setAngle(-15, true);
                    handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());
                }
                if (keyStr === 'right') {
                    klCanvasWorkspace.setAngle(15, true);
                    handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());
                }
            }
            if (['r+up'].includes(comboStr)) {
                klCanvasWorkspace.setAngle(0);
                handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());
            }


            if (comboStr === 'sqbr_open') {
                currentBrush.decreaseSize(0.03 / klCanvasWorkspace.getScale());
            }
            if (comboStr === 'sqbr_close') {
                currentBrush.increaseSize(0.03 / klCanvasWorkspace.getScale());
            }
            if (comboStr === 'enter') {
                klCanvas.layerFill(klCanvas.getLayerIndex(currentLayerCtx.canvas), klColorSlider.getColor());
                statusOverlay.out(LANG('filled'), true);
            }
            if (['delete', 'backspace'].includes(comboStr)) {
                let layerIndex = klCanvas.getLayerIndex(currentLayerCtx.canvas);
                if (layerIndex === 0 && !brushUiObj.eraserBrush.getIsTransparentBg()) {
                    klCanvas.layerFill(layerIndex, {r: 255, g: 255, b: 255}, 'source-in');
                } else {
                    klCanvas.clearLayer(layerIndex);
                }
                statusOverlay.out(LANG('cleared-layer'), true);
            }
            if (comboStr === 'e') {
                event.preventDefault();
                klCanvasWorkspace.setMode('draw');
                toolspaceToolRow.setActive('draw');
                mainTabRow.open('draw');
                updateMainTabVisibility();
                brushTabRow.open('eraserBrush');
            }
            if (comboStr === 'b') {
                event.preventDefault();
                klCanvasWorkspace.setMode('draw');
                toolspaceToolRow.setActive('draw');
                mainTabRow.open('draw');
                updateMainTabVisibility();
                brushTabRow.open(lastNonEraserBrushId);
            }
            if (comboStr === 'g') {
                event.preventDefault();
                klCanvasWorkspace.setMode('fill');
                toolspaceToolRow.setActive('fill');
                mainTabRow.open('fill');
                updateMainTabVisibility();
            }
            if (comboStr === 't') {
                event.preventDefault();
                klCanvasWorkspace.setMode('text');
                toolspaceToolRow.setActive('text');
                mainTabRow.open('text');
                updateMainTabVisibility();
            }
            if (comboStr === 'u') {
                event.preventDefault();
                klCanvasWorkspace.setMode('shape');
                toolspaceToolRow.setActive('shape');
                mainTabRow.open('shape');
                updateMainTabVisibility();
            }
            if (comboStr === 'x') {
                event.preventDefault();
                klColorSlider.swapColors();
            }


        },
        onUp: function(keyStr, event) {
        }
    });

    /**
     *
     * @param importedImage - convertedPsd | {type: 'image', width: number, height: number, canvas: image | canvas}
     * @param filename - string e.g. 'drawing.psd'
     * @param optionStr? - 'default' | 'layer' | 'image'
     */
    function importFinishedLoading(
        importedImage: IKlPsd | {
            type: 'image';
            width: number;
            height: number;
            canvas: HTMLCanvasElement | HTMLImageElement;
        },
        filename: string,
        optionStr: 'default' | 'layer' | 'image',
    ) {
        if (!importedImage || isNaN(importedImage.width) || isNaN(importedImage.height) || importedImage.width <= 0 || importedImage.height <= 0) {
            KL.popup({
                target: klRootEl,
                type: "error",
                message: LANG('import-broken-file'),
                buttons: ["Ok"],
            });
            return;
        }

        function getResizedDimensions(width, height) {
            let w = parseInt(width);
            let h = parseInt(height);
            if (w > klMaxCanvasSize) {
                h = klMaxCanvasSize / w * h;
                w = klMaxCanvasSize;
            }
            if (h > klMaxCanvasSize) {
                w = klMaxCanvasSize / h * w;
                h = klMaxCanvasSize;
            }
            w = parseInt('' + w);
            h = parseInt('' + h);
            return {
                width: w,
                height: h
            }
        }

        function importAsImage(canvas) {
            let resizedDimensions = getResizedDimensions(canvas.width, canvas.height);

            //resize first
            let tempCanvas = BB.canvas(canvas.width, canvas.height);
            let tempCanvasCtx = tempCanvas.getContext('2d');
            tempCanvasCtx.drawImage(canvas, 0, 0);

            BB.resizeCanvas(tempCanvas, resizedDimensions.width, resizedDimensions.height);

            klCanvas.reset({
                width: resizedDimensions.width,
                height: resizedDimensions.height,
                image: tempCanvas,
                layerName: filename
            });

            layerManager.update(0);
            setCurrentLayer(klCanvas.getLayer(0));
            klCanvasWorkspace.resetView();
            handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());

            isFirstImage = false;
        }

        /**
         *
         * @param convertedPsdObj - if flattened then without layers
         * @param cropObj? - {x: number, y: number, width: number, height: number}
         */
        function importAsImagePsd(convertedPsdObj: IKlPsd, cropObj?) {

            // crop
            function crop(targetCanvas, cropCanvas, cropObj) {
                cropCanvas.width = cropCanvas.width;
                cropCanvas.getContext('2d').drawImage(targetCanvas, -cropObj.x, -cropObj.y);
                targetCanvas.width = cropObj.width;
                targetCanvas.height = cropObj.height;
                targetCanvas.getContext('2d').drawImage(cropCanvas, 0, 0);
            }
            if (cropObj && (cropObj.width !== convertedPsdObj.width ||cropObj.height !== convertedPsdObj.height)) {
                let cropCanvas = BB.canvas(cropObj.width, cropObj.height);
                convertedPsdObj.width = cropObj.width;
                convertedPsdObj.height = cropObj.height;

                if (!convertedPsdObj.layers) {
                    crop(convertedPsdObj.canvas, cropCanvas, cropObj);
                }
                if (convertedPsdObj.layers) {
                    for (let i = 0; i < convertedPsdObj.layers.length; i++) {
                        let item = convertedPsdObj.layers[i];
                        crop(item.image, cropCanvas, cropObj);
                    }
                }
            }

            // resize
            let resizedDimensions = getResizedDimensions(convertedPsdObj.width, convertedPsdObj.height);
            convertedPsdObj.width = resizedDimensions.width;
            convertedPsdObj.height = resizedDimensions.height;
            if (!convertedPsdObj.layers) {
                BB.resizeCanvas(convertedPsdObj.canvas, convertedPsdObj.width, convertedPsdObj.height);
            }
            if (convertedPsdObj.layers) {
                for (let i = 0; i < convertedPsdObj.layers.length; i++) {
                    let item = convertedPsdObj.layers[i];
                    BB.resizeCanvas(item.image, convertedPsdObj.width, convertedPsdObj.height);
                }
            }

            let layerIndex;
            if (convertedPsdObj.layers) {
                layerIndex = klCanvas.reset({
                    width: convertedPsdObj.width,
                    height: convertedPsdObj.height,
                    layers: convertedPsdObj.layers
                });
            } else {
                layerIndex = klCanvas.reset({
                    width: convertedPsdObj.width,
                    height: convertedPsdObj.height,
                    image: convertedPsdObj.canvas
                });
            }
            layerManager.update(layerIndex);
            setCurrentLayer(klCanvas.getLayer(layerIndex));
            klCanvasWorkspace.resetView();
            handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());

            isFirstImage = false;
        }

        function importAsLayer(canvas) {
            KL.showImportAsLayerDialog({
                target: klRootEl,
                klCanvas: klCanvas,
                importImage: canvas,
                callback: function(transformObj, isPixelated: boolean) {
                    if (!transformObj) {
                        return;
                    }

                    klHistory.pause(true);
                    klCanvas.addLayer();
                    let layers = klCanvas.getLayers();
                    let activeLayerIndex = layers.length - 1;
                    if (filename) {
                        klCanvas.renameLayer(activeLayerIndex, filename);
                    }
                    let activeLayerContext = klCanvas.getLayerContext(activeLayerIndex);
                    BB.drawTransformedImageWithBounds(activeLayerContext, canvas, transformObj, null, isPixelated);
                    setCurrentLayer(klCanvas.getLayer(activeLayerIndex));
                    layerManager.update(activeLayerIndex);

                    klHistory.pause(false);

                    klHistory.push({
                        tool: ["misc"],
                        action: "importImage",
                        params: [BB.copyCanvas(activeLayerContext.canvas), filename]
                    });
                }
            });
        }


        if (optionStr === 'default' || !optionStr) {
            KL.showImportImageDialog({
                image: importedImage,
                target: klRootEl,
                maxSize: klMaxCanvasSize,
                callback: function(res) {
                    if (res.type === 'as-image') {
                        importAsImage(res.image);
                    } else if (res.type === 'as-image-psd') {
                        importAsImagePsd(res.image, res.cropObj);
                    } else if (res.type === 'as-layer') {
                        importAsLayer(res.image);
                    } else if (res.type === 'cancel') {
                        // nothing to do
                    }
                }
            });
        }

        if (optionStr === 'layer') {
            importAsLayer(importedImage.canvas);
        }
        if (optionStr === 'image') {
            if (importedImage.type === 'psd') {
                importAsImagePsd(importedImage);
            } else {
                importAsImage(importedImage.canvas);
            }
        }

    }

    function onPaste(e) {
        if (KL.dialogCounter.get() > 0) {
            return;
        }

        function retrieveImageFromClipboardAsBlob(pasteEvent, callback) {
            if (pasteEvent.clipboardData == false) {
                if (typeof (callback) == "function") {
                    callback(undefined);
                }
            }

            let items = pasteEvent.clipboardData.items;

            if (items == undefined) {
                if (typeof (callback) == "function") {
                    callback(undefined);
                }
            } else {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") == -1) {
                        continue;
                    }
                    let blob = items[i].getAsFile();

                    if (typeof (callback) == "function") {
                        callback(blob);
                    }
                }
            }

        }

        e.stopPropagation();
        e.preventDefault();

        if (e.clipboardData.files[0]) {
            retrieveImageFromClipboardAsBlob(e, function (imageBlob) {
                // If there's an image, display it in the canvas
                if (imageBlob) {
                    let img = new Image();
                    img.onload = function () {
                        URL.revokeObjectURL(img.src);
                        importFinishedLoading({
                            type: 'image',
                            width: img.width,
                            height: img.height,
                            canvas: img
                        }, null, 'default');
                    };
                    let URLObj = window.URL || window.webkitURL;
                    img.src = URLObj.createObjectURL(imageBlob);
                }
            });
        } else if (e.clipboardData.items[0]) {
            e.clipboardData.items[0].getAsString(function(pasteStr) {
                pasteStr = pasteStr.trim();
                if (pasteStr.match(/^https?/)) {
                    // url
                    let img = new Image();
                    img.onload = function () {
                        importFinishedLoading({
                            type: 'image',
                            width: img.width,
                            height: img.height,
                            canvas: img
                        }, null, 'default');
                    };
                    img.onerror = function (e) {
                        console.log('error loading', e);
                    };
                    img.crossOrigin = 'Anonymous';
                    img.src = pasteStr;

                } else if (pasteStr.match(/^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)) {
                    // url
                    let rgbObj = BB.ColorConverter.hexToRGB(pasteStr.replace('#', ''));
                    brushSettingService.setColor(rgbObj);
                }
            });

        }
    }

    function handleFileSelect(files, optionStr) {

        function showWarningPsdFlattened() {
            KL.popup({
                target: klRootEl,
                type: "warning",
                message: LANG('import-psd-unsupported') + "<br /><br />",
                buttons: ["Ok"],
            });
        }

        let hasUnsupportedFile = false;
        for (let i = 0, file; file = files[i]; i++) {
            let extension = file.name.split(".");
            extension = extension[extension.length - 1].toLowerCase();
            if (extension === "psd") {

                (function(f) {
                    let loaderSizeBytes = 1024 * 1024 * 25; // 25mb
                    let maxSizeBytes = 1024 * 1024 * 1024; // 1gb
                    let maxResolution = 4096;

                    if (f.size >= maxSizeBytes) { // pretty likely to break stuff
                        KL.popup({
                            target: klRootEl,
                            type: "error",
                            message: "File too big. Unable to import.<br /><br />",
                            buttons: ["Ok"],
                        });
                        return;
                    }

                    let doShowLoader = files.length === 1 && f.size >= loaderSizeBytes;
                    let loaderIsOpen = true;
                    let closeLoader;

                    if (doShowLoader) {
                        KL.popup({
                            target: klRootEl,
                            message: LANG('import-opening'),
                            callback: function (result) {
                                loaderIsOpen = false;
                                closeLoader = null;
                            },
                            closefunc: function (f) {
                                closeLoader = f;
                            }
                        });
                    }


                    let reader = new FileReader();
                    reader.onload = function (readerResult) {

                        KL.loadAgPsd().then(function(agPsdLazy) {

                            if (doShowLoader && !loaderIsOpen) {
                                return;
                            }

                            try {
                                let psd;

                                // first pass, only read metadata
                                psd = agPsdLazy.readPsd(
                                    (readerResult.target.result as any),
                                    {
                                        skipLayerImageData: true,
                                        skipThumbnail: true,
                                        skipCompositeImageData: true
                                    });
                                if (psd.width > maxResolution || psd.height > maxResolution) {
                                    if (closeLoader) {
                                        closeLoader();
                                    }
                                    KL.popup({
                                        target: klRootEl,
                                        type: "error",
                                        //message: "Image exceeds maximum dimensions of " + maxResolution + " x " + maxResolution + " pixels. Unable to import."
                                        message: LANG('import-psd-too-large').replace(/{x}/g, '' + maxResolution)
                                            + "<br /><br />"
                                            + LANG('import-psd-size') + ": " + psd.width + " x " + psd.height + ' pixels'
                                            + "<br /><br />"
                                        ,
                                        buttons: ["Ok"],
                                    });
                                    return;
                                }


                                // second pass, now load actual data.
                                psd = null;

                                try {
                                    psd = agPsdLazy.readPsd((readerResult.target.result as any));
                                } catch (e) {
                                    //console.log('failed regular psd import', e);
                                }
                                if (psd) {
                                    //console.log('psd', psd);
                                    let convertedPsd = KL.PSD.readPsd(psd);
                                    //console.log('converted', convertedPsd);
                                    if (optionStr === 'image' && convertedPsd.error) {
                                        showWarningPsdFlattened();
                                    }

                                    if (closeLoader) {
                                        closeLoader();
                                    }
                                    importFinishedLoading(convertedPsd, f.name, optionStr);
                                } else {
                                    psd = agPsdLazy.readPsd((readerResult.target.result as any), { skipLayerImageData: true, skipThumbnail: true });
                                    if (optionStr === 'image') {
                                        showWarningPsdFlattened();
                                    }

                                    if (closeLoader) {
                                        closeLoader();
                                    }
                                    importFinishedLoading({
                                        type: 'psd',
                                        width: psd.width,
                                        height: psd.height,
                                        canvas: psd.canvas,
                                        error: true
                                    }, f.name, optionStr);
                                }


                            } catch (e) {
                                if (closeLoader) {
                                    closeLoader();
                                }
                                KL.popup({
                                    target: klRootEl,
                                    type: "error",
                                    message: "Failed to load PSD.<br /><br />",
                                    buttons: ["Ok"],
                                });
                            }
                        }).catch(() => {
                            closeLoader();
                            alert('Error: failed to load PSD library');
                        });

                    };
                    reader.readAsArrayBuffer(f);
                })(file);

            } else if (file.type.match('image.*')) {
                (function (f) {
                    window.URL = window.URL || window.webkitURL;
                    let url = window.URL.createObjectURL(f);
                    let im = new Image();
                    im.src = url;
                    BB.loadImage(im, function () {
                        importFinishedLoading({
                            type: 'image',
                            width: im.width,
                            height: im.height,
                            canvas: im
                        }, f.name, optionStr);
                    });
                })(file);
            } else {
                hasUnsupportedFile = true;
            }
        }
        if (hasUnsupportedFile) {
            KL.popup({
                target: klRootEl,
                message: LANG('import-unsupported-file'),
                type: 'error',
                buttons: ['OK'],
            });
        }
    }

    if (!pOptions.embed) {
        new KL.KlImageDropper({
            target: document.body,
            onDrop: function(files, optionStr) {
                if (KL.dialogCounter.get() > 0) {
                    return;
                }
                handleFileSelect(files, optionStr);
            },
            enabledTest: function() {
                return KL.dialogCounter.get() === 0;
            }
        });

        BB.addEventListener(window, 'paste', onPaste, false);
    }

    const brushUiObj: any = {};

    // create brush UIs
    for (let b in KL.brushesUI) {
        if (KL.brushesUI.hasOwnProperty(b)) {
            let ui = new KL.brushesUI[b].Ui({
                onSizeChange: sizeWatcher,
                onOpacityChange: function(opacity) {
                    brushSettingService.emitOpacity(opacity);
                },
                onConfigChange: () => {
                    brushSettingService.emitSliderConfig({
                        sizeSlider: KL.brushesUI[currentBrushId].sizeSlider,
                        opacitySlider: KL.brushesUI[currentBrushId].opacitySlider
                    });
                }
            });
            brushUiObj[b] = ui;
            ui.getElement().style.padding = 10 + 'px';
        }
    }


    BB.css(klRootEl, {
        position: 'absolute',
        left: '0',
        top: '0',
        right: '0',
        bottom: '0'
    });

    let statusOverlay = new KL.StatusOverlay();

    const toolspace = BB.el({});
    const toolspaceInner = BB.el({
        parent: toolspace,
    });
    toolspace.oncontextmenu = function () {
        return false;
    };
    toolspace.onclick = BB.handleClick;


    let toolspaceCollapser = new KL.ToolspaceCollapser({
        onChange: function() {
            updateCollapse();
        }
    });
    function updateCollapse() {

        //collapser
        if (uiWidth < collapseThreshold) {
            toolspaceCollapser.getElement().style.display = 'block';

            toolspaceCollapser.setDirection(uiState);
            if (toolspaceCollapser.isOpen()) {
                if (uiState === 'left') {
                    BB.css(toolspaceCollapser.getElement(), {
                        left: '271px',
                        right: '',
                    });
                    BB.css(klCanvasWorkspace.getElement(), {
                        left: '271px'
                    });
                } else {
                    BB.css(toolspaceCollapser.getElement(), {
                        left: '',
                        right: '271px'
                    });
                    BB.css(klCanvasWorkspace.getElement(), {
                        left: '0'
                    });
                }
                toolspace.style.display = 'block';
                klCanvasWorkspace.setSize(Math.max(0, uiWidth - toolWidth), uiHeight);
                statusOverlay.setWide(false);

            } else {
                if (uiState === 'left') {
                    BB.css(toolspaceCollapser.getElement(), {
                        left: '0',
                        right: '',
                    });
                    BB.css(klCanvasWorkspace.getElement(), {
                        left: '0'
                    });
                } else {
                    BB.css(toolspaceCollapser.getElement(), {
                        left: '',
                        right: '0'
                    });
                    BB.css(klCanvasWorkspace.getElement(), {
                        left: '0'
                    });
                }
                toolspace.style.display = 'none';
                klCanvasWorkspace.setSize(Math.max(0, uiWidth), uiHeight);
                statusOverlay.setWide(true);

            }

        } else {
            toolspaceCollapser.getElement().style.display = 'none';
            if (uiState === 'left') {
                BB.css(klCanvasWorkspace.getElement(), {
                    left: '271px'
                });
            } else {
                BB.css(klCanvasWorkspace.getElement(), {
                    left: '0'
                });
            }
            toolspace.style.display = 'block';
            klCanvasWorkspace.setSize(Math.max(0, uiWidth - toolWidth), uiHeight);
            statusOverlay.setWide(false);

        }
    }
    updateCollapse();

    function updateUi() {
        if (uiState === 'left') {
            BB.css(toolspace, {
                left: '0',
                right: '',
                borderLeft: 'none',
                borderRight: '1px solid rgb(135, 135, 135)'
            });
            BB.css(klCanvasWorkspace.getElement(), {
                left: '271px'
            });
        } else {
            BB.css(toolspace, {
                left: '',
                right: '0',
                borderLeft: '1px solid rgb(135, 135, 135)',
                borderRight: 'none'
            });
            BB.css(klCanvasWorkspace.getElement(), {
                left: '0'
            });
        }
        statusOverlay.setUiState(uiState);
        layerPreview.setUiState('' + uiState);
        layerManager.setUiState('' + uiState);
        updateCollapse();
        toolspaceScroller.updateUiState(uiState);
    }



    let overlayToolspace;
    setTimeout(function() {
        overlayToolspace = new KL.OverlayToolspace({
            enabledTest: function() {
                return KL.dialogCounter.get() === 0 && !lineSanitizer.getIsDrawing();
            },
            brushSettingService,
        });
        klRootEl.appendChild(overlayToolspace.getElement());
    }, 0);

    BB.append(klRootEl, [klCanvasWorkspace.getElement(), toolspace, toolspaceCollapser.getElement()]);

    BB.css(toolspace, {
        position: "absolute",
        right: '0',
        top: '0',
        bottom: '0',
        width: (toolWidth - 1) + "px",

        overflow: "hidden",
        backgroundColor: "#ddd",
        borderLeft: "1px solid rgb(135, 135, 135)",
        userSelect: 'none',
        touchAction: 'none'
    });

    let toolspaceTopRow;
    if (pOptions.embed) {
        toolspaceTopRow = new ToolspaceTopRow({
            onHelp: () => {
                showIframePopup(pOptions.embed.url + '/help.html', !!pOptions.embed);
            },
            onSubmit: () => {
                KL.popup({
                    target: klRootEl,
                    message: LANG('submit-prompt'),
                    buttons: [LANG('submit'), 'Cancel'],
                    callback: async (result) => {
                        if (result !== LANG('submit')) {
                            return;
                        }

                        let overlay = BB.el({
                            parent: klRootEl,
                            className: 'upload-overlay',
                            content: '<div class="spinner"></div> ' + LANG('submit-submitting'),
                        });

                        pOptions.embed.onSubmit(
                            () => {
                                pOptions.saveReminder.reset();
                                klRootEl.removeChild(overlay);
                            },
                            () => {
                                klRootEl.removeChild(overlay);
                            });
                    }
                });
            },
            onLeftRight: () => {
                uiState = uiState === 'left' ? 'right' : 'left';
                updateUi();
            },
        });
    } else {
        toolspaceTopRow = new KL.ToolspaceTopRow({
            logoImg: pOptions.logoImg,
            onLogo: function() {
                showIframePopup('./home/', !!pOptions.embed);
            },
            onNew: function() {
                showNewImageDialog();
            },
            onImport: function() {
                fileTab.triggerImport();
            },
            onSave: function() {
                saveToComputer.save();
            },
            onShare: function() {
                shareImage();
            },
            onHelp: function() {
                showIframePopup('./help/', !!pOptions.embed);
            },
        });
    }
    BB.addClassName(toolspaceTopRow.getElement(), 'toolspace-row-shadow');
    toolspaceTopRow.getElement().style.marginBottom = '10px';
    toolspaceInner.appendChild(toolspaceTopRow.getElement());

    let toolspaceToolRow = new KL.ToolspaceToolRow({
        onActivate: function(activeStr) {
            if (activeStr === 'draw') {
                klCanvasWorkspace.setMode('draw');
            } else if (activeStr === 'hand') {
                klCanvasWorkspace.setMode('hand');
            } else if (activeStr === 'fill') {
                klCanvasWorkspace.setMode('fill');
            } else if (activeStr === 'text') {
                klCanvasWorkspace.setMode('text');
            } else if (activeStr === 'shape') {
                klCanvasWorkspace.setMode('shape');
            } else {
                throw new Error('unknown activeStr');
            }
            mainTabRow.open(activeStr);
            updateMainTabVisibility();
            klColorSlider.pickingDone();
        },
        onZoomIn: function() {
            klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? 1/8 : 1/2);
        },
        onZoomOut: function() {
            klCanvasWorkspace.zoomByStep(keyListener.isPressed('shift') ? -1/8 : -1/2);
        },
        onUndo: function() {
            undoRedoCatchup.undo();
        },
        onRedo: function() {
            undoRedoCatchup.redo();
        }
    });
    toolspaceToolRow.setIsSmall(uiHeight < 540);
    klHistory.addListener(function() {
        toolspaceToolRow.setEnableUndo(klHistory.canUndo());
        toolspaceToolRow.setEnableRedo(klHistory.canRedo());
    });
    BB.addClassName(toolspaceToolRow.getElement(), 'toolspace-row-shadow');
    toolspaceInner.appendChild(toolspaceToolRow.getElement());

    let klColorSlider;

    function setCurrentBrush(brushId) {
        if (brushId !== 'eraserBrush') {
            lastNonEraserBrushId = brushId;
        }

        if (klColorSlider) {
            if (brushId === 'eraserBrush') {
                klColorSlider.enable(false);
            } else {
                klColorSlider.enable(true);
            }
        }

        currentBrushId = brushId;
        currentBrush = brushUiObj[brushId];
        currentBrush.setColor(currentColor);
        currentBrush.setContext(currentLayerCtx);
        klCanvasWorkspace.setMode('draw');
        toolspaceToolRow.setActive('draw');
        updateMainTabVisibility();
    }

    function setCurrentLayer(layer) { //BrushContext(p_context) {
        currentLayerCtx = layer.context;
        currentBrush.setContext(layer.context);
        layerPreview.setLayer(layer);
    }

    function setBrushColor(p_color) {
        currentColor = p_color;
        currentBrush.setColor(p_color);
        brushSettingService.emitColor(p_color);
        klColorSlider.pickingDone();
    }

    klColorSlider = new KL.KlColorSlider({
        width: 250,
        height: 30,
        svHeight: 100,
        startValue: new BB.RGB(0, 0, 0),
        onPick: setBrushColor
    });
    klColorSlider.setHeight(Math.max(163, Math.min(400, uiHeight - 505)));
    klColorSlider.setPickCallback(function (doPick) {

        if (doPick) {
            klCanvasWorkspace.setMode('pick');
        } else {
            klCanvasWorkspace.setMode(toolspaceToolRow.getActive());
            updateMainTabVisibility();
        }

    });
    let brushDiv = document.createElement("div");
    let colorDiv = document.createElement("div");
    BB.css(colorDiv, {
        margin: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-end'
    });
    let toolspaceStabilizerRow = new KL.ToolspaceStabilizerRow({
        smoothing: 1,
        onSelect: function(v) {
            lineSmoothing.setSmoothing(translateSmoothing(v));
        }
    });


    brushDiv.appendChild(colorDiv);
    BB.append(
        colorDiv,
        [klColorSlider.getElement(), klColorSlider.getOutputElement(), toolspaceStabilizerRow.getElement()]
    );

    let brushTabRow = new KL.TabRow({
        initialId: 'penBrush',
        useAccent: true,
        tabArr: (function () {
            let result = [];

            function createTab(keyStr) {
                return {
                    id: keyStr,
                    image: KL.brushesUI[keyStr].image,
                    title: KL.brushesUI[keyStr].tooltip,
                    onOpen: function() {
                        brushUiObj[keyStr].getElement().style.display = 'block';
                        setCurrentBrush(keyStr);
                        klColorSlider.pickingDone();
                        brushSettingService.emitSliderConfig({
                            sizeSlider: KL.brushesUI[keyStr].sizeSlider,
                            opacitySlider: KL.brushesUI[keyStr].opacitySlider
                        });
                        sizeWatcher(brushUiObj[keyStr].getSize());
                        brushSettingService.emitOpacity(brushUiObj[keyStr].getOpacity());
                    },
                    onClose: function() {
                        brushUiObj[keyStr].getElement().style.display = 'none';
                    }
                };
            }

            let keyArr = Object.keys(brushUiObj);
            for (let i = 0; i < keyArr.length; i++) {
                result.push(createTab(keyArr[i]));
            }
            return result;
        })()
    });
    brushDiv.appendChild(brushTabRow.getElement());
    for (let b in KL.brushesUI) {
        if (KL.brushesUI.hasOwnProperty(b)) {
            brushDiv.appendChild(brushUiObj[b].getElement());
        }
    }

    const handUi = new KL.HandUi({
        scale: 1,
        angleDeg: 0,
        onReset: function() {
            klCanvasWorkspace.resetView(true);
            handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());
        },
        onFit: function() {
            klCanvasWorkspace.fitView();
            handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());
        },
        onAngleChange: function(angleDeg, isRelative) {
            klCanvasWorkspace.setAngle(angleDeg, isRelative);
            handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());
        },
    });

    let fillUi = new KL.FillUi({
        colorSlider: klColorSlider
    });

    let textUi = new KL.TextUi({
        colorSlider: klColorSlider
    });

    let shapeUi = new KL.ShapeUi({
        colorSlider: klColorSlider
    });

    let shapeTool = new KL.ShapeTool({
        onShape: function(isDone, x1, y1, x2, y2, angleRad) {

            let layerIndex = klCanvas.getLayerIndex(currentLayerCtx.canvas);

            let shapeObj: any = {
                type: shapeUi.getShape(),
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                angleRad: angleRad,
                isOutwards: shapeUi.getIsOutwards(),
                opacity: shapeUi.getOpacity(),
                isEraser: shapeUi.getIsEraser()
            };
            if (shapeUi.getShape() === 'line') {
                shapeObj.strokeRgb = klColorSlider.getColor();
                shapeObj.lineWidth = shapeUi.getLineWidth();
                shapeObj.isAngleSnap = shapeUi.getIsSnap() || keyListener.isPressed('shift');
            } else {
                shapeObj.isFixedRatio = shapeUi.getIsFixed() || keyListener.isPressed('shift');
                if (shapeUi.getMode() === 'stroke') {
                    shapeObj.strokeRgb = klColorSlider.getColor();
                    shapeObj.lineWidth = shapeUi.getLineWidth();
                } else {
                    shapeObj.fillRgb = klColorSlider.getColor();
                }
            }

            if (isDone) {
                klCanvas.setComposite(layerIndex, null);
                klCanvas.drawShape(layerIndex, shapeObj);
            } else {
                klCanvas.setComposite(layerIndex, {
                    draw: function(ctx) {
                        KL.drawShape(ctx, shapeObj);
                    }
                });
            }
            klCanvasWorkspace.requestFrame();

        }
    });

    const layerManager = KL.klLayerManager(klCanvas, function (val) {
        setCurrentLayer(klCanvas.getLayer(val));
        klHistory.push({
            tool: ["misc"],
            action: "focusLayer",
            params: [val]
        });
    }, klRootEl) as any;
    const layerPreview = new KL.LayerPreview({
        klRootEl: klRootEl,
        onClick: function () {
            mainTabRow.open('layers');
        }
    });
    layerPreview.setIsVisible(uiHeight >= 579);
    layerPreview.setLayer(klCanvas.getLayer(klCanvas.getLayerIndex(currentLayerCtx.canvas)));

    const filterTab = new KL.FilterTab(
        klRootEl,
        klColorSlider,
        layerManager,
        setCurrentLayer,
        klCanvasWorkspace,
        handUi,
        () => { //get current color
            return currentColor;
        },
        () => { // get max canvas size
            return klMaxCanvasSize;
        },
        () => { // get kl canvas
            return klCanvas;
        },
        () => { // get current layer ctx
            return currentLayerCtx;
        },
        !!pOptions.embed,
        statusOverlay,
    );

    const undoRedoCatchup = new KL.UndoRedoCatchup(
        brushUiObj,
        layerPreview,
        layerManager,
        handUi,
        klCanvasWorkspace,
        () => {
            if (!initState) {
                throw new Error('initState not initialized');
            }
            return initState;
        },
        () => klCanvas,
        () => currentLayerCtx,
        (clctx) => {
            currentLayerCtx = clctx;
        },
        () => currentBrush,
    );
    klHistory.addListener((p) => {
        undoRedoCatchup.catchup(p);
    });

    function showNewImageDialog() {
        KL.newImageDialog({
            currentColor: currentColor,
            secondaryColor: klColorSlider.getSecondaryRGB(),
            maxCanvasSize: klMaxCanvasSize,
            canvasWidth: klCanvas.getWidth(),
            canvasHeight: klCanvas.getHeight(),
            workspaceWidth: window.innerWidth < collapseThreshold ? uiWidth : uiWidth - toolWidth,
            workspaceHeight: uiHeight,
            onConfirm: function(width, height, color) {
                klCanvas.reset({
                    width: width,
                    height: height,
                    color: color.a === 1 ? color : null
                });

                layerManager.update(0);
                setCurrentLayer(klCanvas.getLayer(0));
                klCanvasWorkspace.resetView();
                handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());

                isFirstImage = false;
            },
            onCancel: function() {}
        });
    }

    function shareImage(callback?) {
        BB.shareCanvas({
            canvas: klCanvas.getCompleteCanvas(1),
            fileName: BB.getDate() + filenameBase + '.png',
            title: BB.getDate() + filenameBase + '.png',
            callback: callback ? callback : function() {}
        });
    }

    const saveToComputer = new KL.SaveToComputer(
        pOptions.saveReminder,
        klRootEl,
        () => exportType,
        () => klCanvas,
        filenameBase,
    );

    const fileTab = pOptions.embed ? null : new KL.FileTab(
        klRootEl,
        projectStore,
        () => klCanvas.getProject(),
        exportType,
        (type) => {
            exportType = type;
        },
        handleFileSelect,
        () => {
            saveToComputer.save();
        },
        showNewImageDialog,
        shareImage,
        () => { // on upload
            KL.imgurUpload(klCanvas, klRootEl, pOptions.saveReminder, pOptions.app && pOptions.app.imgurKey ? pOptions.app.imgurKey : null, );
        },
        copyToClipboard,
        pOptions.saveReminder,
    );

    const settingsTab = new KL.SettingsTab(
        () => {
            uiState = uiState === 'left' ? 'right' : 'left';
            updateUi();
            if (!pOptions.embed) {
                LocalStorage.setItem('uiState', uiState);
            }
        },
        pOptions.aboutEl
    );

    mainTabRow = new KL.TabRow({
        initialId: 'draw',
        tabArr: [
            {
                id: 'draw',
                title: LANG('tool-brush'),
                image: toolPaintImg,
                onOpen: function() {
                    if (currentBrushId === 'eraserBrush') {
                        klColorSlider.enable(false);
                    }
                    BB.append(
                        colorDiv,
                        [klColorSlider.getElement(), klColorSlider.getOutputElement(), toolspaceStabilizerRow.getElement()]
                    );
                    brushDiv.style.display = 'block';
                },
                onClose: function() {
                    brushDiv.style.display = 'none';
                },
                css: {
                    minWidth: '45px',
                }
            },
            {
                id: 'hand',
                title: LANG('tool-hand'),
                image: toolHandImg,
                isVisible: false,
                onOpen: function() {
                    handUi.setIsVisible(true);
                },
                onClose: function() {
                    handUi.setIsVisible(false);
                },
                css: {
                    minWidth: '45px',
                }
            },
            {
                id: 'fill',
                title: LANG('tool-paint-bucket'),
                image: toolFillImg,
                isVisible: false,
                onOpen: function() {
                    klColorSlider.enable(true);
                    fillUi.setIsVisible(true);
                },
                onClose: function() {
                    fillUi.setIsVisible(false);
                },
                css: {
                    minWidth: '45px',
                }
            },
            {
                id: 'text',
                title: LANG('tool-text'),
                image: toolTextImg,
                isVisible: false,
                onOpen: function() {
                    klColorSlider.enable(true);
                    textUi.setIsVisible(true);
                },
                onClose: function() {
                    textUi.setIsVisible(false);
                },
                css: {
                    minWidth: '45px',
                }
            },
            {
                id: 'shape',
                title: LANG('tool-shape'),
                image: toolShapeImg,
                isVisible: false,
                onOpen: function() {
                    klColorSlider.enable(true);
                    shapeUi.setIsVisible(true);
                },
                onClose: function() {
                    shapeUi.setIsVisible(false);
                },
                css: {
                    minWidth: '45px',
                }
            },
            {
                id: 'layers',
                title: LANG('tab-layers'),
                image: tabLayersImg,
                onOpen: function() {
                    layerManager.update();
                    layerManager.style.display = 'block';
                },
                onClose: function() {
                    layerManager.style.display = 'none';
                },
                css: {
                    minWidth: '45px',
                }
            },
            {
                id: 'edit',
                label: LANG('tab-edit'),
                onOpen: function() {
                    filterTab.show();
                },
                onClose: function() {
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
                onOpen: function() {
                    if (!fileTab) {
                        return;
                    }
                    fileTab.getElement().style.display = 'block';
                    fileTab.setIsVisible(true);
                },
                onClose: function() {
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
                onOpen: function() {
                    settingsTab.getElement().style.display = 'block';
                    // settingsTab.setIsVisible(true);
                },
                onClose: function() {
                    settingsTab.getElement().style.display = 'none';
                    // settingsTab.setIsVisible(false);
                },
                css: {
                    minWidth: '45px',
                }
            }
        ]
    });
    function updateMainTabVisibility() {
        if (!mainTabRow) {
            return;
        }

        let toolObj = {
            'draw': {},
            'hand': {},
            'fill': {},
            'text': {},
            'shape': {}
        };

        let activeStr = toolspaceToolRow.getActive();
        let oldTabId = mainTabRow.getOpenedTabId();

        let keysArr = Object.keys(toolObj);
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

    }

    function copyToClipboard(showCrop?) {
        KL.clipboardDialog(klRootEl, klCanvas.getCompleteCanvas(1), function (inputObj) {
            if (inputObj.left === 0 && inputObj.right === 0 && inputObj.top === 0 && inputObj.bottom === 0) {
                return;
            }
            //do a crop
            let p = {
                context: currentLayerCtx,
                canvas: klCanvas,
                input: inputObj, //{left,right,top,bottom}
                history: klHistory
            };
            KL.filterLib.cropExtend.apply(p);
            layerManager.update();
            klCanvasWorkspace.resetView();
            handUi.update(klCanvasWorkspace.getScale(), klCanvasWorkspace.getAngleDeg());
        }, statusOverlay, showCrop);
    }

    const bottomBarWrapper = BB.el({
        css: {
            width: "270px",
            position: "absolute",
            bottom: '0',
            left: '0'
        },
    });
    if (pOptions.bottomBar) {
        bottomBarWrapper.append(pOptions.bottomBar);
        const observer = new MutationObserver(() => updateBottomBar());
        observer.observe(
            toolspaceInner,
            {
                attributes: true,
                childList: true,
                subtree: true,
            }
        );
    }
    function updateBottomBar() {
        if (!pOptions.bottomBar) {
            return;
        }
        const threshold = 617; //590
        const isVisible = (
            threshold < window.innerHeight &&
            toolspaceInner.scrollHeight + 50 < window.innerHeight
        );
        bottomBarWrapper.style.display = isVisible ? '' : 'none';
    }



    BB.append(toolspaceInner, [
        layerPreview.getElement(),
        mainTabRow.getElement(),
        brushDiv,
        handUi.getElement(),
        fillUi.getElement(),
        textUi.getElement(),
        shapeUi.getElement(),
        layerManager,
        filterTab.getElement(),
        fileTab ? fileTab.getElement() : null,
        settingsTab.getElement(),
        BB.el({
            css: {
                height: '10px', // a bit of spacing at the bottom
            }
        }),
        bottomBarWrapper ? bottomBarWrapper : null
    ]);

    const toolspaceScroller = new KL.ToolspaceScroller({
        toolspace,
        uiState,
    });

    // --- interface ---

    this.getEl = () => {
        return klRootEl;
    };

    this.resize = (w, h) => {

        // iPad scrolls down when increasing text zoom
        if (window.scrollY > 0) {
            window.scrollTo(0, 0);
        }

        if (uiWidth === Math.max(0, w) && uiHeight === Math.max(0, h)) {
            return;
        }

        uiWidth = Math.max(0, w);
        uiHeight = Math.max(0, h);

        updateCollapse();
        updateBottomBar();

        layerPreview.setIsVisible(uiHeight >= 579);
        klColorSlider.setHeight(Math.max(163, Math.min(400, uiHeight - 505)));
        toolspaceToolRow.setIsSmall(uiHeight < 540);
    };

    this.out = (msg) => {
        statusOverlay.out(msg);
    };

    this.getPNG = function(): Blob {
        return base64ToBlob(klCanvas.getCompleteCanvas(1).toDataURL('image/png'));
    };

    this.getPSD = async function() {
        return await klCanvasToPsdBlob(klCanvas);
    };

    this.getProject = () => klCanvas.getProject();

    this.swapUiLeftRight = () => {
        uiState = uiState === 'left' ? 'right' : 'left';
        if (!pOptions.embed) {
            LocalStorage.setItem('uiState', uiState);
        }
        updateUi();
    };

    this.saveAsPsd = () => {
        saveToComputer.save('psd');
    };

    this.isDrawing = () => {
        return lineSanitizer.getIsDrawing() || klCanvasWorkspace.getIsDrawing();
    };

    // --- end interface ---

    this.resize(uiWidth, uiHeight);
    updateUi();

    {
        BB.addEventListener(window, 'resize', () => {
            this.resize(window.innerWidth, window.innerHeight);
        });
        BB.addEventListener(window, 'orientationchange', () => {
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
            }
        });
        try {
            // Not all browsers support ResizeObserver. Not critical though.
            const observer = new ResizeObserver(() => this.resize(window.innerWidth, window.innerHeight));
            observer.observe(windowResizeWatcher);
        } catch (e) {
            windowResizeWatcher.parentNode.removeChild(windowResizeWatcher);
        }

        // prevent ctrl scroll -> zooming page
        BB.addEventListener(this.getEl(), 'wheel', (event) => {
            event.preventDefault();
        });
        //maybe prevent zooming on safari mac os - I can't test it
        const prevent = (e) => {
            e.preventDefault();
        }
        window.addEventListener('gesturestart', prevent);
        window.addEventListener('gesturechange', prevent);
        window.addEventListener('gestureend', prevent);
    }
}