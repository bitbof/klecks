import { createCanvas } from '../../bb/base/create-canvas';
import { BlendMode, Layer, Psd } from 'ag-psd/dist/psd';
import { IKlProject, IKlPsd, TKlPsdError, TKlPsdLayer, TMixMode } from '../kl-types';
import { LANG } from '../../language/language';
import { MAX_LAYERS } from '../canvas/kl-canvas';
import { BB } from '../../bb/bb';
import { throwIfUndefined } from '../../bb/base/base';

let kl2PsdMap: Record<TMixMode, BlendMode>;
let psd2KlMap: Record<BlendMode, TMixMode>;

function init(): void {
    if (kl2PsdMap) {
        return;
    }
    kl2PsdMap = {
        'source-over': 'normal',

        darken: 'darken',
        multiply: 'multiply',
        'color-burn': 'color burn',

        lighten: 'lighten',
        screen: 'screen',
        'color-dodge': 'color dodge',

        overlay: 'overlay',
        'soft-light': 'soft light',
        'hard-light': 'hard light',

        difference: 'difference',
        exclusion: 'exclusion',

        hue: 'hue',
        saturation: 'saturation',
        color: 'color',
        luminosity: 'luminosity',
    };
    psd2KlMap = Object.fromEntries(Object.entries(kl2PsdMap).map((a) => a.reverse()));
}

export function blendPsdToKl(str: BlendMode): TMixMode {
    init();
    return psd2KlMap[str];
}

export function blendKlToPsd(str: TMixMode): BlendMode {
    init();
    return kl2PsdMap[str];
}

/**
 * Converts ag-psd object into something that KlCanvas can represent
 * @param psdObj
 */
export function readPsd(psdObj: Psd): IKlPsd {
    if (!psdObj.canvas) {
        throw new Error('psdObj.canvas undefined');
    }
    const result: IKlPsd = {
        type: 'psd',
        canvas: psdObj.canvas,
        width: psdObj.width,
        height: psdObj.height,
    };

    function addWarning(warningStr: TKlPsdError): void {
        if (!result.warningArr) {
            result.warningArr = [];
        }
        if (result.warningArr.includes(warningStr)) {
            return;
        }
        result.warningArr.push(warningStr);
    }

    function getMixModeStr(blendMode: BlendMode): TMixMode {
        let mixModeStr: TMixMode = blendPsdToKl(blendMode);
        if (!mixModeStr) {
            addWarning('blend-mode');
            mixModeStr = 'source-over';
        }
        return mixModeStr;
    }

    if (psdObj.bitsPerChannel !== 8) {
        addWarning('bits-per-channel');
    }

    if (!psdObj.children) {
        result.error = true;
        return result;
    }

    // count resulting layers
    const maxLayers = MAX_LAYERS;
    let layerCount = 0;
    function countWithinGroup(groupObj: Layer): number {
        let result = 0;
        if (groupObj.blendMode) {
            const mixModeStr = blendPsdToKl(groupObj.blendMode);
            if (mixModeStr && mixModeStr !== 'source-over') {
                return 1;
            }
        }
        if (groupObj.children) {
            for (let i = 0; i < groupObj.children.length; i++) {
                const item = groupObj.children[i];
                if (item.clipping || item.adjustment) {
                    continue;
                }

                if (item.children) {
                    addWarning('group');
                    result += countWithinGroup(item);
                } else {
                    result++;
                }
            }
        }
        return result;
    }
    layerCount += countWithinGroup(psdObj);
    if (layerCount > maxLayers) {
        result.error = true;
        return result;
    }

    result.layers = [];

    function prepareMask(maskCanvas: HTMLCanvasElement, defaultColor: number): void {
        const groupMaskCtx = BB.ctx(maskCanvas);
        const imData = groupMaskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        if (defaultColor === 0) {
            for (let i = 0; i < imData.data.length; i += 4) {
                imData.data[i + 3] = imData.data[i];
            }
        } else {
            for (let i = 0; i < imData.data.length; i += 4) {
                imData.data[i + 3] = 255 - imData.data[i];
            }
        }
        groupMaskCtx.putImageData(imData, 0, 0);
    }

    function convertGroup(psdGroupObj: Layer): TKlPsdLayer[] {
        let resultArr: TKlPsdLayer[] = [];
        const groupIsVisible = !psdGroupObj.hidden;
        const groupOpacity = throwIfUndefined(psdGroupObj.opacity, 'groupOpacity is undefined');
        const groupMixModeStr = getMixModeStr(psdGroupObj.blendMode!);
        let groupCanvas;
        let groupCtx;
        if (groupMixModeStr !== 'source-over') {
            groupCanvas = createCanvas(result.width, result.height);
            groupCtx = BB.ctx(groupCanvas);
        }

        // prepare group mask
        if (psdGroupObj.mask) {
            addWarning('mask');
            prepareMask(psdGroupObj.mask.canvas!, psdGroupObj.mask.defaultColor!);
        }

        if (psdGroupObj.children) {
            for (let i = 0; i < psdGroupObj.children.length; i++) {
                const item = psdGroupObj.children[i];
                if (item.clipping) {
                    continue;
                }
                if (item.adjustment) {
                    addWarning('adjustment');
                    continue;
                }

                const hasClipping =
                    (item.children || item.canvas) &&
                    psdGroupObj.children[i + 1] &&
                    psdGroupObj.children[i + 1].clipping;
                if (hasClipping) {
                    addWarning('clipping');
                }

                if (item.children) {
                    const convertedChildGroupItems = convertGroup(item);

                    for (let e = 0; e < convertedChildGroupItems.length; e++) {
                        const innerItem = convertedChildGroupItems[e];
                        const innerCtx = BB.ctx(innerItem.image);

                        // clipping
                        if (hasClipping) {
                            const clippingCanvas = createCanvas(result.width, result.height);
                            const clippingCtx = BB.ctx(clippingCanvas);
                            clippingCtx.drawImage(innerItem.image, 0, 0);

                            for (
                                let f = i + 1;
                                f < psdGroupObj.children.length && psdGroupObj.children[f].clipping;
                                f++
                            ) {
                                const clippingItem = psdGroupObj.children[f];
                                if (clippingItem.opacity === 0 || clippingItem.hidden) {
                                    continue;
                                }
                                if (clippingItem.blendMode === undefined) {
                                    throw new Error('clippingItem.blendMode undefined');
                                }
                                if (clippingItem.opacity === undefined) {
                                    throw new Error('clippingItem.opacity undefined');
                                }
                                if (clippingItem.canvas === undefined) {
                                    throw new Error('clippingItem.canvas undefined');
                                }
                                if (clippingItem.left === undefined) {
                                    throw new Error('clippingItem.left undefined');
                                }
                                if (clippingItem.top === undefined) {
                                    throw new Error('clippingItem.top undefined');
                                }
                                clippingCtx.globalCompositeOperation = getMixModeStr(
                                    clippingItem.blendMode,
                                );
                                clippingCtx.globalAlpha = clippingItem.opacity;
                                clippingCtx.drawImage(
                                    clippingItem.canvas,
                                    clippingItem.left,
                                    clippingItem.top,
                                );
                            }

                            innerCtx.globalCompositeOperation = 'source-atop';
                            innerCtx.drawImage(clippingCanvas, 0, 0);
                        }

                        // group mask
                        if (psdGroupObj.mask) {
                            innerCtx.globalCompositeOperation =
                                psdGroupObj.mask.defaultColor === 0
                                    ? 'destination-in'
                                    : 'destination-out';
                            if (psdGroupObj.mask.canvas === undefined) {
                                throw new Error('psdGroupObj.mask.canvas undefined');
                            }
                            if (psdGroupObj.mask.left === undefined) {
                                throw new Error('psdGroupObj.mask.left undefined');
                            }
                            if (psdGroupObj.mask.top === undefined) {
                                throw new Error('psdGroupObj.mask.top undefined');
                            }
                            innerCtx.drawImage(
                                psdGroupObj.mask.canvas,
                                psdGroupObj.mask.left,
                                psdGroupObj.mask.top,
                            );
                        }

                        if (groupCanvas) {
                            if (groupCtx === undefined) {
                                throw new Error('groupCtx undefined');
                            }
                            groupCtx.globalCompositeOperation = innerItem.mixModeStr;
                            groupCtx.globalAlpha = innerItem.opacity;
                            groupCtx.drawImage(innerItem.image, 0, 0);
                        } else {
                            innerItem.opacity = innerItem.opacity * groupOpacity;
                            resultArr.push(innerItem);
                        }
                    }

                    continue;
                }

                const canvas = createCanvas(result.width, result.height);
                const ctx = BB.ctx(canvas);
                if (item.canvas) {
                    // if a layer is empty it has no canvas
                    if (item.top === undefined) {
                        throw new Error('item.top undefined');
                    }
                    if (item.left === undefined) {
                        throw new Error('item.left undefined');
                    }
                    ctx.drawImage(item.canvas, item.left, item.top);
                }

                // effects
                if (item.effects) {
                    addWarning('layer-effect');
                }

                // mask
                if (item.mask) {
                    addWarning('mask');
                    if (item.mask.canvas === undefined) {
                        throw new Error('item.mask.canvas undefined');
                    }
                    if (item.mask.defaultColor === undefined) {
                        throw new Error('item.mask.defaultColor undefined');
                    }
                    if (item.mask.left === undefined) {
                        throw new Error('item.mask.left undefined');
                    }
                    if (item.mask.top === undefined) {
                        throw new Error('item.mask.top undefined');
                    }
                    prepareMask(item.mask.canvas, item.mask.defaultColor);

                    ctx.globalCompositeOperation =
                        item.mask.defaultColor === 0 ? 'destination-in' : 'destination-out';
                    ctx.drawImage(item.mask.canvas, item.mask.left, item.mask.top);
                }

                // clipping
                if (hasClipping) {
                    if (item.right === undefined) {
                        throw new Error('item.right undefined');
                    }
                    if (item.left === undefined) {
                        throw new Error('item.left undefined');
                    }
                    if (item.bottom === undefined) {
                        throw new Error('item.bottom undefined');
                    }
                    if (item.top === undefined) {
                        throw new Error('item.top undefined');
                    }
                    if (item.canvas === undefined) {
                        throw new Error('item.canvas undefined');
                    }
                    const clippingCanvas = createCanvas(
                        item.right - item.left,
                        item.bottom - item.top,
                    );
                    const clippingCtx = BB.ctx(clippingCanvas);
                    clippingCtx.drawImage(item.canvas, 0, 0);

                    for (
                        let e = i + 1;
                        e < psdGroupObj.children.length && psdGroupObj.children[e].clipping;
                        e++
                    ) {
                        const clippingItem = psdGroupObj.children[e];
                        if (clippingItem.opacity === 0 || clippingItem.hidden) {
                            continue;
                        }
                        if (clippingItem.blendMode === undefined) {
                            throw new Error('clippingItem.blendMode undefined');
                        }
                        if (clippingItem.opacity === undefined) {
                            throw new Error('clippingItem.opacity undefined');
                        }
                        if (clippingItem.canvas === undefined) {
                            throw new Error('clippingItem.canvas undefined');
                        }
                        if (clippingItem.left === undefined) {
                            throw new Error('clippingItem.left undefined');
                        }
                        if (clippingItem.top === undefined) {
                            throw new Error('clippingItem.top undefined');
                        }
                        clippingCtx.globalCompositeOperation = getMixModeStr(
                            clippingItem.blendMode,
                        );
                        clippingCtx.globalAlpha = clippingItem.opacity;
                        clippingCtx.drawImage(
                            clippingItem.canvas,
                            clippingItem.left - item.left,
                            clippingItem.top - item.top,
                        );
                    }

                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.drawImage(clippingCanvas, item.left, item.top);
                }

                // group mask
                if (psdGroupObj.mask) {
                    ctx.globalCompositeOperation =
                        psdGroupObj.mask.defaultColor === 0 ? 'destination-in' : 'destination-out';
                    if (psdGroupObj.mask.canvas === undefined) {
                        throw new Error('psdGroupObj.mask.canvas undefined');
                    }
                    if (psdGroupObj.mask.left === undefined) {
                        throw new Error('psdGroupObj.mask.left undefined');
                    }
                    if (psdGroupObj.mask.top === undefined) {
                        throw new Error('psdGroupObj.mask.top undefined');
                    }
                    ctx.drawImage(
                        psdGroupObj.mask.canvas,
                        psdGroupObj.mask.left,
                        psdGroupObj.mask.top,
                    );
                }

                if (item.blendMode === undefined) {
                    throw new Error('item.blendMode undefined');
                }
                if (item.hidden === undefined) {
                    throw new Error('item.hidden  undefined');
                }
                if (item.opacity === undefined) {
                    throw new Error('item.opacity undefined');
                }

                if (groupCanvas && groupCtx) {
                    if (groupOpacity > 0) {
                        groupCtx.globalCompositeOperation = getMixModeStr(item.blendMode);
                        groupCtx.globalAlpha = item.hidden ? 0 : item.opacity;
                        groupCtx.drawImage(canvas, 0, 0);
                    }
                } else {
                    if (item.name === undefined) {
                        throw new Error('item.name undefined');
                    }
                    resultArr.push({
                        name: item.name,
                        isVisible: !item.hidden && groupIsVisible,
                        opacity: item.opacity * groupOpacity,
                        mixModeStr: getMixModeStr(item.blendMode),
                        image: canvas,
                    });
                }
            }
        }

        if (groupCanvas) {
            if (psdGroupObj.name === undefined) {
                throw new Error('psdGroupObj.name undefined');
            }
            resultArr = [
                {
                    name: psdGroupObj.name,
                    isVisible: groupIsVisible,
                    opacity: groupOpacity,
                    mixModeStr: groupMixModeStr,
                    image: groupCanvas,
                },
            ];
        }

        return resultArr;
    }

    result.layers = convertGroup({
        name: 'root',
        opacity: 1,
        blendMode: 'normal',
        children: psdObj.children,
    });

    return result;
}

export function klPsdToKlProject(klPsd: IKlPsd): IKlProject {
    // only share references to Canvas elements
    const result: IKlProject = {
        width: klPsd.width,
        height: klPsd.height,
        layers: [],
    };
    if (klPsd.layers) {
        result.layers = klPsd.layers.map((item) => {
            return {
                name: item.name,
                isVisible: item.isVisible,
                opacity: item.opacity,
                mixModeStr: item.mixModeStr,
                image: item.image,
            };
        });
    } else {
        // flattened
        result.layers = [
            {
                name: LANG('background'),
                isVisible: true,
                opacity: 1,
                mixModeStr: 'source-over',
                image: klPsd.canvas,
            },
        ];
    }
    return result;
}
