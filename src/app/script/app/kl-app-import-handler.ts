import { TDropOption, TKlPsd, TRgb } from '../klecks/kl-types';
import { KL } from '../klecks/kl';
import { LANG } from '../language/language';
import { BB } from '../bb/bb';
import { changeCanvasDimensions } from '../bb/base/change-canvas-dimensions';
import { KlCanvas } from '../klecks/canvas/kl-canvas';
import { LayersUi } from '../klecks/ui/tool-tabs/layers-ui/layers-ui';
import { TRect, TSize2D } from '../bb/bb-types';
import { asyncThrow, attempt, AttemptError, throwIfNull, throwIfUndefined } from '../bb/base/base';
import { loadImage, loadImageFromBlob } from '../bb/base/load-image';
import { getNextLayerId } from '../klecks/history/get-next-layer-id';
import { detectFiletype } from '../klecks/storage/file-header-detection';
import { showError, showModal } from '../klecks/ui/modals/base/show-modal';

// todo later:
// onImage: (project: IKlProject) => void
// onLayer: (index: number, canvas: HMTLCanvasElement,layerName: string) => void

export class KlAppImportHandler {
    private readonly klRootEl: HTMLElement;
    private readonly klMaxCanvasSize: number;
    private readonly layersUi: LayersUi;
    private readonly setCurrentLayer: (index: number) => void;
    private readonly klCanvas: KlCanvas;
    private readonly onImportConfirm: () => void;
    private readonly applyUncommitted: () => void;

    private readonly onColor: (rgb: TRgb) => void;

    private importFinishedLoading(
        importedImage: // convertedPsd | {type: 'image', width: number, height: number, canvas: image | canvas}
        | TKlPsd
            | {
                  type: 'image';
                  width: number;
                  height: number;
                  canvas: HTMLCanvasElement | HTMLImageElement;
              },
        filename: string | undefined, // string e.g. 'drawing.psd'
        optionStr: 'default' | 'layer' | 'image',
    ): void {
        if (
            !importedImage ||
            isNaN(importedImage.width) ||
            isNaN(importedImage.height) ||
            importedImage.width <= 0 ||
            importedImage.height <= 0
        ) {
            showError(LANG('import-broken-file'));
            return;
        }

        const getResizedDimensions = (width: number, height: number): TSize2D => {
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
            this.applyUncommitted();
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
            this.setCurrentLayer(0);
            this.onImportConfirm();
        };

        /**
         * convertedPsdObj has no layers if flattened
         */
        const importAsImagePsd = (convertedPsdObj: TKlPsd, cropObj?: TRect) => {
            this.applyUncommitted();
            // crop
            const crop = (
                targetCanvas: HTMLCanvasElement,
                cropCanvas: HTMLCanvasElement,
                cropObj: TRect,
            ): void => {
                const cropCtx = BB.ctx(cropCanvas);
                cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
                cropCtx.drawImage(targetCanvas, -cropObj.x, -cropObj.y);
                changeCanvasDimensions(targetCanvas, cropObj.width, cropObj.height, {
                    ensureCleared: true,
                });
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
                    layers: convertedPsdObj.layers.map((layer) => {
                        return {
                            id: getNextLayerId(),
                            name: layer.name,
                            isVisible: layer.isVisible,
                            opacity: layer.opacity,
                            mixModeStr: layer.mixModeStr,
                            hasClipping: layer.hasClipping,
                            image: layer.image,
                        };
                    }),
                });
            } else {
                layerIndex = this.klCanvas.reset({
                    width: convertedPsdObj.width,
                    height: convertedPsdObj.height,
                    image: convertedPsdObj.canvas,
                });
            }
            this.layersUi.update(layerIndex);
            this.setCurrentLayer(layerIndex);
            this.onImportConfirm();
        };

        const importAsLayer = (canvas: HTMLCanvasElement | HTMLImageElement) => {
            this.applyUncommitted();
            KL.showImportAsLayerDialog({
                target: this.klRootEl,
                klCanvas: this.klCanvas,
                importImage: canvas,
                callback: (transformObj, isPixelated?: boolean) => {
                    if (!transformObj) {
                        return;
                    }
                    const operation = (ctx: CanvasRenderingContext2D) => {
                        BB.drawTransformedImageWithBounds(
                            ctx,
                            canvas,
                            transformObj,
                            undefined,
                            isPixelated,
                        );
                    };
                    if (
                        !this.klCanvas.addLayer(undefined, {
                            name: filename,
                            mixModeStr: 'source-over',
                            isVisible: true,
                            opacity: 1,
                            image: operation,
                        })
                    ) {
                        this.klCanvas.drawOperation(
                            this.klCanvas.getLayers().length - 1,
                            operation,
                        );
                    }
                    const layers = this.klCanvas.getLayers();
                    const activeLayerIndex = layers.length - 1;
                    this.setCurrentLayer(activeLayerIndex);
                    this.layersUi.update(activeLayerIndex);
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
            maxCanvasSize: number;
            layersUi: LayersUi;
            setCurrentLayer: (index: number) => void;
            klCanvas: KlCanvas;
            onImportConfirm: () => void;
            applyUncommitted: () => void;
        },
        callback: {
            onColor: (rgb: TRgb) => void;
        },
    ) {
        this.klRootEl = input.klRootEl;
        this.klMaxCanvasSize = input.maxCanvasSize;
        this.layersUi = input.layersUi;
        this.setCurrentLayer = input.setCurrentLayer;
        this.klCanvas = input.klCanvas;
        this.onImportConfirm = input.onImportConfirm;
        this.applyUncommitted = input.applyUncommitted;

        this.onColor = callback.onColor;
    }

    // ---- interface ----

    async readClipboard(): Promise<void> {
        try {
            // May freeze the app until it read the clipboard
            // But if you show a loading indicator on this line, it will show up too early.
            const clipboardItems = await navigator.clipboard.read();
            // On this line it's already done freezing.

            let hasImage = false;
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image')) {
                        hasImage = true;
                        const blob = await item.getType(type);
                        const img = await loadImageFromBlob(blob);
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
                        return;
                    }
                }
            }
            if (!hasImage) {
                showError(LANG('clipboard-no-image'));
            }
        } catch (error) {
            showError(LANG('clipboard-read-fail'));
        }
    }

    onPaste(e: ClipboardEvent): void {
        if (KL.DIALOG_COUNTER.get() > 0 || BB.isInputFocused(true)) {
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
                if (!items[i].type.includes('image')) {
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
                void loadImageFromBlob(imageBlob)
                    .then((img) => {
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
                    })
                    .catch(() => showError(LANG('clipboard-read-fail')));
            });
        } else if (e.clipboardData.items[0]) {
            e.clipboardData.items[0].getAsString((pasteStr) => {
                pasteStr = pasteStr.trim();
                if (pasteStr.match(/^https?/)) {
                    // url
                    void loadImage(pasteStr, { crossOrigin: 'anonymous' })
                        .then((img) => {
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
                        })
                        .catch((error) => console.log('error loading', error));
                } else if (pasteStr.match(/^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)) {
                    // url
                    const rgbObj = BB.ColorConverter.hexToRGB(pasteStr.replace('#', ''));
                    rgbObj && this.onColor(rgbObj);
                }
            });
        }
    }

    async handleFileSelect(files: FileList, optionStr: TDropOption): Promise<void> {
        const showWarningPsdFlattened = () => {
            showModal({
                type: 'warning',
                message: LANG('import-psd-unsupported') + '<br /><br />',
                buttons: ['Ok'],
            });
        };

        // files need to be copied, because the input is reset
        const fileArr = [...files];
        if (fileArr.length > 1) {
            const shouldImport = await new Promise<boolean>((resolve) => {
                showModal({
                    type: 'warning',
                    message: LANG('import-many-files-warning', {
                        x: '' + fileArr.length,
                    }),
                    buttons: [
                        {
                            id: 'import',
                            label: LANG('import-many-files-confirm', {
                                x: '' + fileArr.length,
                            }),
                        },
                        'Cancel',
                    ],
                    callback: (result) => {
                        resolve(result === 'import');
                    },
                });
            });
            if (!shouldImport) {
                return;
            }
        }

        let hasUnsupportedFile = false;

        for (let i = 0; i < fileArr.length; i++) {
            const file = fileArr[i];
            const fileType = await detectFiletype(file);
            if (fileType === 'image') {
                loadImageFromBlob(file)
                    .then((image) => {
                        this.importFinishedLoading(
                            {
                                type: 'image',
                                width: image.width,
                                height: image.height,
                                canvas: image,
                            },
                            file.name,
                            optionStr,
                        );
                    })
                    .catch(() => showError(LANG('import-broken-file')));
            } else if (fileType === 'psd') {
                const loaderSizeBytes = 1024 * 1024 * 25; // 25mb
                const maxSizeBytes = 1024 * 1024 * 1024; // 1gb
                const maxResolution = 4096;

                if (file.size >= maxSizeBytes) {
                    // pretty likely to break stuff
                    showError('File too big. Unable to import.');
                    return;
                }

                const doShowLoader = fileArr.length === 1 && file.size >= loaderSizeBytes;
                let loaderIsOpen = true;
                let closeLoader: (() => void) | null;

                if (doShowLoader) {
                    showModal({
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
                                    showError(
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
                                            ' pixels',
                                    );
                                    return;
                                }

                                // second pass, now load actual data.
                                psd = null;

                                const parsed = attempt(() =>
                                    agPsdLazy.readPsd(target.result as any),
                                );
                                psd = parsed instanceof AttemptError ? undefined : parsed;
                                if (psd) {
                                    //console.log('psd', psd);
                                    const convertedPsd = KL.PSD.psdToKlPsd(psd);
                                    //console.log('converted', convertedPsd);
                                    if (optionStr === 'image' && convertedPsd.error) {
                                        showWarningPsdFlattened();
                                    }

                                    if (closeLoader) {
                                        closeLoader();
                                    }
                                    this.importFinishedLoading(convertedPsd, file.name, optionStr);
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
                                        file.name,
                                        optionStr,
                                    );
                                }
                            } catch (e) {
                                closeLoader?.();
                                showError('Failed to load PSD.');
                                asyncThrow(e);
                            }
                        })
                        .catch((e) => {
                            closeLoader?.();
                            showError('Error: failed to load PSD library');
                        });
                };
                reader.readAsArrayBuffer(file);
            } else {
                hasUnsupportedFile = true;
            }
        }
        if (hasUnsupportedFile) {
            showError(LANG('import-unsupported-file'));
        }
    }
}
