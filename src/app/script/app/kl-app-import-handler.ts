import { IKlPsd, IRGB, TDropOption, TKlCanvasLayer } from '../klecks/kl-types';
import { KL } from '../klecks/kl';
import { LANG } from '../language/language';
import { BB } from '../bb/bb';
import { TMiscImportImageHistoryEntry } from '../klecks/history/kl-history';
import { KlCanvas } from '../klecks/canvas/kl-canvas';
import { LayersUi } from '../klecks/ui/tool-tabs/layers-ui/layers-ui';
import { IRect, ISize2D } from '../bb/bb-types';
import { throwIfNull, throwIfUndefined } from '../bb/base/base';

// todo later:
// onImage: (project: IKlProject) => void
// onLayer: (index: number, canvas: HMTLCanvasElement,layerName: string) => void

export class KlAppImportHandler {
    private readonly klRootEl: HTMLElement;
    private readonly klMaxCanvasSize: number;
    private readonly layersUi: LayersUi;
    private readonly setCurrentLayer: (layer: TKlCanvasLayer) => void;
    private readonly klCanvas: KlCanvas;
    private readonly onImportConfirm: () => void;

    private readonly onColor: (rgb: IRGB) => void;

    /**
     *
     * @param importedImage - convertedPsd | {type: 'image', width: number, height: number, canvas: image | canvas}
     * @param filename - string e.g. 'drawing.psd'
     * @param optionStr? - 'default' | 'layer' | 'image'
     */
    private importFinishedLoading(
        importedImage:
            | IKlPsd
            | {
                  type: 'image';
                  width: number;
                  height: number;
                  canvas: HTMLCanvasElement | HTMLImageElement;
              },
        filename: string | undefined,
        optionStr: 'default' | 'layer' | 'image',
    ): void {
        if (
            !importedImage ||
            isNaN(importedImage.width) ||
            isNaN(importedImage.height) ||
            importedImage.width <= 0 ||
            importedImage.height <= 0
        ) {
            KL.popup({
                target: this.klRootEl,
                type: 'error',
                message: LANG('import-broken-file'),
                buttons: ['Ok'],
            });
            return;
        }

        const getResizedDimensions = (width: number, height: number): ISize2D => {
            let w = parseInt('' + width);
            let h = parseInt('' + height);
            if (w > this.klMaxCanvasSize) {
                h = (this.klMaxCanvasSize / w) * h;
                w = this.klMaxCanvasSize;
            }
            if (h > this.klMaxCanvasSize) {
                w = (this.klMaxCanvasSize / h) * w;
                h = this.klMaxCanvasSize;
            }
            w = parseInt('' + w);
            h = parseInt('' + h);
            return {
                width: w,
                height: h,
            };
        };

        const importAsImage = (canvas: HTMLCanvasElement | HTMLImageElement) => {
            const resizedDimensions = getResizedDimensions(canvas.width, canvas.height);

            //resize first
            const tempCanvas = BB.canvas(canvas.width, canvas.height);
            const tempCanvasCtx = BB.ctx(tempCanvas);
            tempCanvasCtx.drawImage(canvas, 0, 0);

            BB.resizeCanvas(tempCanvas, resizedDimensions.width, resizedDimensions.height);

            this.klCanvas.reset({
                width: resizedDimensions.width,
                height: resizedDimensions.height,
                image: tempCanvas,
                layerName: filename,
            });

            this.layersUi.update(0);
            this.setCurrentLayer(this.klCanvas.getLayer(0)!);
            this.onImportConfirm();
        };

        /**
         *
         * @param convertedPsdObj - if flattened then without layers
         * @param cropObj? - {x: number, y: number, width: number, height: number}
         */
        const importAsImagePsd = (convertedPsdObj: IKlPsd, cropObj?: IRect) => {
            // crop
            const crop = (
                targetCanvas: HTMLCanvasElement,
                cropCanvas: HTMLCanvasElement,
                cropObj: IRect,
            ): void => {
                // eslint-disable-next-line no-self-assign
                cropCanvas.width = cropCanvas.width;
                BB.ctx(cropCanvas).drawImage(targetCanvas, -cropObj.x, -cropObj.y);
                targetCanvas.width = cropObj.width;
                targetCanvas.height = cropObj.height;
                BB.ctx(targetCanvas).drawImage(cropCanvas, 0, 0);
            };
            if (
                cropObj &&
                (cropObj.width !== convertedPsdObj.width ||
                    cropObj.height !== convertedPsdObj.height)
            ) {
                const cropCanvas = BB.canvas(cropObj.width, cropObj.height);
                convertedPsdObj.width = cropObj.width;
                convertedPsdObj.height = cropObj.height;

                if (!convertedPsdObj.layers) {
                    crop(convertedPsdObj.canvas, cropCanvas, cropObj);
                }
                if (convertedPsdObj.layers) {
                    for (let i = 0; i < convertedPsdObj.layers.length; i++) {
                        const item = convertedPsdObj.layers[i];
                        crop(item.image, cropCanvas, cropObj);
                    }
                }
            }

            // resize
            const resizedDimensions = getResizedDimensions(
                convertedPsdObj.width,
                convertedPsdObj.height,
            );
            convertedPsdObj.width = resizedDimensions.width;
            convertedPsdObj.height = resizedDimensions.height;
            if (!convertedPsdObj.layers) {
                BB.resizeCanvas(
                    convertedPsdObj.canvas,
                    convertedPsdObj.width,
                    convertedPsdObj.height,
                );
            }
            if (convertedPsdObj.layers) {
                for (let i = 0; i < convertedPsdObj.layers.length; i++) {
                    const item = convertedPsdObj.layers[i];
                    BB.resizeCanvas(item.image, convertedPsdObj.width, convertedPsdObj.height);
                }
            }

            let layerIndex;
            if (convertedPsdObj.layers) {
                layerIndex = this.klCanvas.reset({
                    width: convertedPsdObj.width,
                    height: convertedPsdObj.height,
                    layers: convertedPsdObj.layers,
                });
            } else {
                layerIndex = this.klCanvas.reset({
                    width: convertedPsdObj.width,
                    height: convertedPsdObj.height,
                    image: convertedPsdObj.canvas,
                });
            }
            this.layersUi.update(layerIndex);
            this.setCurrentLayer(throwIfNull(this.klCanvas.getLayer(layerIndex)));
            this.onImportConfirm();
        };

        const importAsLayer = (canvas: HTMLCanvasElement | HTMLImageElement) => {
            KL.showImportAsLayerDialog({
                target: this.klRootEl,
                klCanvas: this.klCanvas,
                importImage: canvas,
                callback: (transformObj, isPixelated?: boolean) => {
                    if (!transformObj) {
                        return;
                    }

                    this.klCanvas.getHistory()?.pause(true);
                    this.klCanvas.addLayer();
                    const layers = this.klCanvas.getLayers();
                    const activeLayerIndex = layers.length - 1;
                    if (filename) {
                        this.klCanvas.renameLayer(activeLayerIndex, filename);
                    }
                    const activeLayerContext = throwIfNull(
                        this.klCanvas.getLayerContext(activeLayerIndex),
                    );
                    BB.drawTransformedImageWithBounds(
                        activeLayerContext,
                        canvas,
                        transformObj,
                        undefined,
                        isPixelated,
                    );
                    this.setCurrentLayer(throwIfNull(this.klCanvas.getLayer(activeLayerIndex)));
                    this.layersUi.update(activeLayerIndex);

                    this.klCanvas.getHistory()?.pause(false);

                    this.klCanvas.getHistory()?.push({
                        tool: ['misc'],
                        action: 'importImage',
                        params: [BB.copyCanvas(activeLayerContext.canvas), filename],
                    } as TMiscImportImageHistoryEntry);
                },
            });
        };

        if (optionStr === 'default' || !optionStr) {
            KL.showImportImageDialog({
                image: importedImage,
                target: this.klRootEl,
                maxSize: this.klMaxCanvasSize,
                callback: (res) => {
                    if (res.type === 'as-image') {
                        importAsImage(res.image);
                    } else if (res.type === 'as-image-psd') {
                        importAsImagePsd(res.image, res.cropObj);
                    } else if (res.type === 'as-layer') {
                        importAsLayer(res.image);
                    } else if (res.type === 'cancel') {
                        // nothing to do
                    }
                },
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

    // ----------------------------------- public -----------------------------------
    constructor(
        input: {
            klRootEl: HTMLElement;
            klMaxCanvasSize: number;
            layersUi: LayersUi;
            setCurrentLayer: (layer: TKlCanvasLayer) => void;
            klCanvas: KlCanvas;
            onImportConfirm: () => void;
        },
        callback: {
            onColor: (rgb: IRGB) => void;
        },
    ) {
        this.klRootEl = input.klRootEl;
        this.klMaxCanvasSize = input.klMaxCanvasSize;
        this.layersUi = input.layersUi;
        this.setCurrentLayer = input.setCurrentLayer;
        this.klCanvas = input.klCanvas;
        this.onImportConfirm = input.onImportConfirm;

        this.onColor = callback.onColor;
    }

    // ---- interface ----

    onPaste(e: ClipboardEvent): void {
        if (KL.dialogCounter.get() > 0) {
            return;
        }

        const retrieveImageFromClipboardAsBlob = (
            items: DataTransferItemList,
            callback: (file: File) => void,
        ) => {
            if (!items) {
                return;
            }
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') == -1) {
                    continue;
                }
                const file = items[i].getAsFile();
                file && callback(file);
            }
        };

        e.stopPropagation();
        e.preventDefault();

        if (!e.clipboardData) {
            return;
        }

        if (e.clipboardData.files[0]) {
            retrieveImageFromClipboardAsBlob(e.clipboardData.items, (imageBlob) => {
                // If there's an image, display it in the canvas
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(img.src);
                    this.importFinishedLoading(
                        {
                            type: 'image',
                            width: img.width,
                            height: img.height,
                            canvas: img,
                        },
                        undefined,
                        'default',
                    );
                };
                const URLObj = window.URL || window.webkitURL;
                img.src = URLObj.createObjectURL(imageBlob);
            });
        } else if (e.clipboardData.items[0]) {
            e.clipboardData.items[0].getAsString((pasteStr) => {
                pasteStr = pasteStr.trim();
                if (pasteStr.match(/^https?/)) {
                    // url
                    const img = new Image();
                    img.onload = () => {
                        this.importFinishedLoading(
                            {
                                type: 'image',
                                width: img.width,
                                height: img.height,
                                canvas: img,
                            },
                            undefined,
                            'default',
                        );
                    };
                    img.onerror = (e) => {
                        console.log('error loading', e);
                    };
                    img.crossOrigin = 'Anonymous';
                    img.src = pasteStr;
                } else if (pasteStr.match(/^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)) {
                    // url
                    const rgbObj = BB.ColorConverter.hexToRGB(pasteStr.replace('#', ''));
                    rgbObj && this.onColor(rgbObj);
                }
            });
        }
    }

    handleFileSelect(files: FileList, optionStr: TDropOption): void {
        const showWarningPsdFlattened = () => {
            KL.popup({
                target: this.klRootEl,
                type: 'warning',
                message: LANG('import-psd-unsupported') + '<br /><br />',
                buttons: ['Ok'],
            });
        };

        let hasUnsupportedFile = false;
        // eslint-disable-next-line no-cond-assign
        for (let i = 0, file; (file = files[i]); i++) {
            const nameSplit = file.name.split('.');
            const extension = nameSplit[nameSplit.length - 1].toLowerCase();
            if (extension === 'psd') {
                ((f) => {
                    const loaderSizeBytes = 1024 * 1024 * 25; // 25mb
                    const maxSizeBytes = 1024 * 1024 * 1024; // 1gb
                    const maxResolution = 4096;

                    if (f.size >= maxSizeBytes) {
                        // pretty likely to break stuff
                        KL.popup({
                            target: this.klRootEl,
                            type: 'error',
                            message: 'File too big. Unable to import.<br /><br />',
                            buttons: ['Ok'],
                        });
                        return;
                    }

                    const doShowLoader = files.length === 1 && f.size >= loaderSizeBytes;
                    let loaderIsOpen = true;
                    let closeLoader: (() => void) | null;

                    if (doShowLoader) {
                        KL.popup({
                            target: this.klRootEl,
                            message: LANG('import-opening'),
                            callback: (result) => {
                                loaderIsOpen = false;
                                closeLoader = null;
                            },
                            closeFunc: (f) => {
                                closeLoader = f;
                            },
                        });
                    }

                    const reader = new FileReader();
                    reader.onload = (readerResult) => {
                        const target = throwIfNull(readerResult.target);

                        KL.loadAgPsd()
                            .then((agPsdLazy) => {
                                if (doShowLoader && !loaderIsOpen) {
                                    return;
                                }

                                try {
                                    let psd;

                                    // first pass, only read metadata
                                    psd = agPsdLazy.readPsd(target.result as any, {
                                        skipLayerImageData: true,
                                        skipThumbnail: true,
                                        skipCompositeImageData: true,
                                    });
                                    if (psd.width > maxResolution || psd.height > maxResolution) {
                                        if (closeLoader) {
                                            closeLoader();
                                        }
                                        KL.popup({
                                            target: this.klRootEl,
                                            type: 'error',
                                            message:
                                                LANG('import-psd-too-large').replace(
                                                    /{x}/g,
                                                    '' + maxResolution,
                                                ) +
                                                '<br /><br />' +
                                                LANG('import-psd-size') +
                                                ': ' +
                                                psd.width +
                                                ' x ' +
                                                psd.height +
                                                ' pixels' +
                                                '<br /><br />',
                                            buttons: ['Ok'],
                                        });
                                        return;
                                    }

                                    // second pass, now load actual data.
                                    psd = null;

                                    try {
                                        psd = agPsdLazy.readPsd(target.result as any);
                                    } catch (e) {
                                        //console.log('failed regular psd import', e);
                                    }
                                    if (psd) {
                                        //console.log('psd', psd);
                                        const convertedPsd = KL.PSD.readPsd(psd);
                                        //console.log('converted', convertedPsd);
                                        if (optionStr === 'image' && convertedPsd.error) {
                                            showWarningPsdFlattened();
                                        }

                                        if (closeLoader) {
                                            closeLoader();
                                        }
                                        this.importFinishedLoading(convertedPsd, f.name, optionStr);
                                    } else {
                                        psd = agPsdLazy.readPsd(target.result as any, {
                                            skipLayerImageData: true,
                                            skipThumbnail: true,
                                        });

                                        if (optionStr === 'image') {
                                            showWarningPsdFlattened();
                                        }

                                        if (closeLoader) {
                                            closeLoader();
                                        }
                                        this.importFinishedLoading(
                                            {
                                                type: 'psd',
                                                width: psd.width,
                                                height: psd.height,
                                                canvas: throwIfUndefined(psd.canvas),
                                                error: true,
                                            },
                                            f.name,
                                            optionStr,
                                        );
                                    }
                                } catch (e) {
                                    closeLoader && closeLoader();
                                    KL.popup({
                                        target: this.klRootEl,
                                        type: 'error',
                                        message: 'Failed to load PSD.<br /><br />',
                                        buttons: ['Ok'],
                                    });
                                    console.log(e);
                                    setTimeout(() => {
                                        throw new Error('psd load error');
                                    });
                                }
                            })
                            .catch((e) => {
                                closeLoader && closeLoader();
                                alert('Error: failed to load PSD library');
                            });
                    };
                    reader.readAsArrayBuffer(f);
                })(file);
            } else if (file.type.match('image.*')) {
                ((f) => {
                    window.URL = window.URL || window.webkitURL;
                    const url = window.URL.createObjectURL(f);
                    const im = new Image();
                    im.src = url;
                    BB.loadImage(im, () => {
                        this.importFinishedLoading(
                            {
                                type: 'image',
                                width: im.width,
                                height: im.height,
                                canvas: im,
                            },
                            f.name,
                            optionStr,
                        );
                    });
                })(file);
            } else {
                hasUnsupportedFile = true;
            }
        }
        if (hasUnsupportedFile) {
            KL.popup({
                target: this.klRootEl,
                message: LANG('import-unsupported-file'),
                type: 'error',
                buttons: ['OK'],
            });
        }
    }
}
