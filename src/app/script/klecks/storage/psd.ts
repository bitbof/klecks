import {createCanvas} from '../../bb/base/create-canvas';
import {Psd} from 'ag-psd/dist/psd';
import {IKlProject, IKlPsd, IMixMode} from '../kl.types';
import {LANG} from '../../language/language';
import {MAX_LAYERS} from '../canvas/kl-canvas';

let kl2PsdMap;
let psd2KlMap;

function init() {
    if (kl2PsdMap) {
        return;
    }

    kl2PsdMap = {
        'source-over': 'normal',

        'darken': 'darken',
        'multiply': 'multiply',
        'color-burn': 'color burn',

        'lighten': 'lighten',
        'screen': 'screen',
        'color-dodge': 'color dodge',

        'overlay': 'overlay',
        'soft-light': 'soft light',
        'hard-light': 'hard light',

        'difference': 'difference',
        'exclusion': 'exclusion',

        'hue': 'hue',
        'saturation': 'saturation',
        'color': 'color',
        'luminosity': 'luminosity',
    };

    psd2KlMap = {};
    let keys = Object.keys(kl2PsdMap);
    for (let i = 0; i < keys.length; i++) {
        psd2KlMap[kl2PsdMap[keys[i]]] = keys[i];
    }
}

export function blendPsdToKl(str: string): IMixMode {
    init();
    return psd2KlMap[str];
}

export function blendKlToPsd(str: string): string {
    init();
    return kl2PsdMap[str];
}


/**
 * Converts ag-psd object into something that KlCanvas can represent
 * @param psdObj
 */
export function readPsd(psdObj: Psd): IKlPsd {
    let result: IKlPsd = {
        type: 'psd',
        canvas: psdObj.canvas,
        width: psdObj.width,
        height: psdObj.height
    };

    function addWarning(warningStr) {
        if (!result.warningArr) {
            result.warningArr = [];
        }
        if (result.warningArr.includes(warningStr)) {
            return;
        }
        result.warningArr.push(warningStr);
    }

    function getMixModeStr(blendMode): IMixMode {
        let mixModeStr: IMixMode = blendPsdToKl(blendMode);
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
    let maxLayers = MAX_LAYERS;
    let layerCount = 0;
    function countWithinGroup(groupObj) {
        let result = 0;
        if (groupObj.blendMode) {
            let mixModeStr = blendPsdToKl(groupObj.blendMode);
            if (mixModeStr && mixModeStr !== 'source-over') {
                return 1;
            }
        }
        for (let i = 0; i < groupObj.children.length; i++) {
            let item = groupObj.children[i];
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
        return result;
    }
    layerCount += countWithinGroup(psdObj);
    if (layerCount > maxLayers) {
        result.error = true;
        return result;
    }

    result.layers = [];

    function prepareMask(maskCanvas, defaultColor) {
        const groupMaskCtx = maskCanvas.getContext('2d');
        let imData = groupMaskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
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

    function convertGroup(psdGroupObj): {
        name: string;
        mixModeStr: IMixMode;
        opacity: number;
        image: HTMLCanvasElement;
    }[] {

        let resultArr: {
            name: string;
            mixModeStr: IMixMode;
            opacity: number;
            image: HTMLCanvasElement;
        }[] = [];
        let groupOpacity = psdGroupObj.hidden ? 0 : psdGroupObj.opacity;
        let groupMixModeStr = getMixModeStr(psdGroupObj.blendMode);
        let groupCanvas;
        let groupCtx;
        if (groupMixModeStr !== 'source-over') {
            groupCanvas = createCanvas(result.width, result.height);
            groupCtx = groupCanvas.getContext('2d');
        }


        // prepare group mask
        if (psdGroupObj.mask) {
            addWarning('mask');
            prepareMask(psdGroupObj.mask.canvas, psdGroupObj.mask.defaultColor);
        }


        for (let i = 0; i < psdGroupObj.children.length; i++) {
            let item = psdGroupObj.children[i];
            if (item.clipping) {
                continue;
            }
            if (item.adjustment) {
                addWarning('adjustment');
                continue;
            }

            let hasClipping = (item.children || item.canvas) && psdGroupObj.children[i + 1] && psdGroupObj.children[i + 1].clipping;
            if (hasClipping) {
                addWarning('clipping');
            }

            if (item.children) {
                let innerArr = convertGroup(item);

                for (let e = 0; e < innerArr.length; e++) {
                    let innerItem = innerArr[e];
                    let innerCtx = innerItem.image.getContext('2d');

                    // clipping
                    if (hasClipping) {
                        let clippingCanvas = createCanvas(result.width, result.height);
                        let clippingCtx = clippingCanvas.getContext('2d');
                        clippingCtx.drawImage(innerItem.image, 0, 0);

                        for (let f = i + 1; f < psdGroupObj.children.length && psdGroupObj.children[f].clipping; f++) {
                            let clippingItem = psdGroupObj.children[f];
                            if (clippingItem.opacity === 0 || clippingItem.hidden) {
                                continue;
                            }
                            clippingCtx.globalCompositeOperation = getMixModeStr(clippingItem.blendMode);
                            clippingCtx.globalAlpha = clippingItem.opacity;
                            clippingCtx.drawImage(clippingItem.canvas, clippingItem.left, clippingItem.top);
                        }

                        innerCtx.globalCompositeOperation = 'source-atop';
                        innerCtx.drawImage(clippingCanvas, 0, 0);
                    }



                    // group mask
                    if (psdGroupObj.mask) {
                        innerCtx.globalCompositeOperation = psdGroupObj.mask.defaultColor === 0 ? 'destination-in' : 'destination-out';
                        innerCtx.drawImage(psdGroupObj.mask.canvas, psdGroupObj.mask.left, psdGroupObj.mask.top);
                    }

                    if (groupCanvas) {
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

            let canvas = createCanvas(result.width, result.height);
            let ctx = canvas.getContext('2d');
            if (item.canvas) { // if a layer is empty it has no canvas
                ctx.drawImage(item.canvas, item.left, item.top);
            }

            // effects
            if (item.effects) {
                addWarning('layer-effect');
            }

            // mask
            if (item.mask) {
                addWarning('mask');
                prepareMask(item.mask.canvas, item.mask.defaultColor);

                ctx.globalCompositeOperation = item.mask.defaultColor === 0 ? 'destination-in' : 'destination-out';
                ctx.drawImage(item.mask.canvas, item.mask.left, item.mask.top);
            }

            // clipping
            if (hasClipping) {
                let clippingCanvas = createCanvas(item.right - item.left, item.bottom - item.top);
                let clippingCtx = clippingCanvas.getContext('2d');
                clippingCtx.drawImage(item.canvas, 0, 0);

                for (let e = i + 1; e < psdGroupObj.children.length && psdGroupObj.children[e].clipping; e++) {
                    let clippingItem = psdGroupObj.children[e];
                    if (clippingItem.opacity === 0 || clippingItem.hidden) {
                        continue;
                    }
                    clippingCtx.globalCompositeOperation = getMixModeStr(clippingItem.blendMode);
                    clippingCtx.globalAlpha = clippingItem.opacity;
                    clippingCtx.drawImage(clippingItem.canvas, clippingItem.left - item.left, clippingItem.top - item.top);
                }

                ctx.globalCompositeOperation = 'source-atop';
                ctx.drawImage(clippingCanvas, item.left, item.top);
            }

            // group mask
            if (psdGroupObj.mask) {
                ctx.globalCompositeOperation = psdGroupObj.mask.defaultColor === 0 ? 'destination-in' : 'destination-out';
                ctx.drawImage(psdGroupObj.mask.canvas, psdGroupObj.mask.left, psdGroupObj.mask.top);
            }

            if (groupCanvas) {
                if (groupOpacity > 0) {
                    groupCtx.globalCompositeOperation = getMixModeStr(item.blendMode);
                    groupCtx.globalAlpha = item.hidden ? 0 : item.opacity;
                    groupCtx.drawImage(canvas, 0, 0);
                }

            } else {
                resultArr.push({
                    name: item.name,
                    opacity: (item.hidden ? 0 : item.opacity) * groupOpacity,
                    mixModeStr: getMixModeStr(item.blendMode),
                    image: canvas,
                });
            }
        }

        if (groupCanvas) {
            resultArr = [
                {
                    name: psdGroupObj.name,
                    opacity: groupOpacity,
                    mixModeStr: groupMixModeStr,
                    image: groupCanvas,
                }
            ];
        }

        return resultArr;
    }

    result.layers = convertGroup({
        name: 'root',
        opacity: 1,
        blendMode: 'normal',
        children: psdObj.children
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
        result.layers = result.layers.concat(klPsd.layers.map(item => {
            return {
                name: item.name,
                opacity: item.opacity,
                mixModeStr: item.mixModeStr,
                image: item.image,
            };
        }));
    } else {
        // flattened
        result.layers.push({
            name: LANG('background'),
            opacity: 1,
            mixModeStr: 'source-over',
            image: klPsd.canvas,
        });
    }
    return result;
}