import { KlCanvas } from './kl-canvas';
import { compose, identity, Matrix, translate } from 'transformation-matrix';
import { getSelectionSampleBounds } from './get-selection-sample-bounds';
import { createLayerMap } from '../history/push-helpers/create-layer-map';
import { BB } from '../../bb/bb';
import { getSelectionBounds } from '../select-tool/get-selection-bounds';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';
import { setContextAlgorithm } from '../utils/set-context-algorithm';

/*
Transforming via selection creates a selection sample, which is the area of a layer which got selected.
This way consecutive transformations don't resample each time.
It preserves the originally sampled pixels.
*/

export type TSelectionSample = {
    image: HTMLCanvasElement | undefined; // undefined if all pixels transparent
    // transformation lines up with position of selection path
    transformation: Matrix;
};

/**
 * Create selection sample from the current selection. If none, will create of entire layer.
 */
function createSelectionSample(layerIndex: number, klCanvas: KlCanvas): TSelectionSample {
    const srcLayer = klCanvas.getLayersRaw()[layerIndex];
    const selection = klCanvas.getSelectionOrFallback();
    const sampleBounds = getSelectionBounds(selection, srcLayer.context);

    // empty
    if (!sampleBounds) {
        return {
            image: undefined,
            transformation: identity(),
        };
    }

    const sampleCanvas = BB.canvas(sampleBounds.width, sampleBounds.height);
    const sampleCtx = BB.ctx(sampleCanvas);
    sampleCtx.save();
    sampleCtx.translate(-sampleBounds.x, -sampleBounds.y);
    sampleCtx.drawImage(srcLayer.canvas, 0, 0);
    sampleCtx.restore();

    return {
        image: sampleCanvas,
        transformation: translate(sampleBounds.x, sampleBounds.y),
    };
}

/**
 * transforms selection and selectionSample
 */
function transformSelectionAndSample(
    transformation: Matrix,
    selectionSample: TSelectionSample,
    selection?: MultiPolygon,
): { selection?: MultiPolygon; selectionSample: TSelectionSample } {
    return {
        selection: selection ? transformMultiPolygon(selection, transformation) : undefined,
        selectionSample: {
            ...selectionSample,
            transformation: compose([transformation, selectionSample.transformation]),
        },
    };
}

/**
 * draws selectionSample on layer[layerIndex] of klCanvas
 */
function drawSelectionSample(
    layerIndex: number,
    isPixelated: boolean,
    selectionSample: TSelectionSample,
    klCanvas: KlCanvas,
): void {
    if (!selectionSample.image) {
        // selection sample, but it's empty. noop
        return;
    }

    const layers = klCanvas.getLayersRaw();
    const targetLayer = layers[layerIndex];
    const targetCtx = BB.ctx(targetLayer.canvas);

    const selection = klCanvas.getSelectionOrFallback();
    const selectionPath = getSelectionPath2d(selection);

    targetCtx.save();
    targetCtx.clip(selectionPath);
    targetCtx.setTransform(...matrixToTuple(selectionSample.transformation));
    setContextAlgorithm(targetCtx, isPixelated ? 'pixelated' : 'smooth');
    targetCtx.drawImage(selectionSample.image, 0, 0);
    targetCtx.restore();
}

/**
 * Transforms (move, not clone) the selected region (or the entire canvas if no selection)
 * in klCanvas. Also transforms the selection, unless there is no selection.
 * Creates a new selection sample.
 */
export function klCanvasTransformViaSelection(p: {
    klCanvas: KlCanvas;

    sourceLayer: number;
    targetLayer?: number;
    transformation: Matrix; // relative to (0,0) of canvas
    isPixelated?: boolean; // default false
    backgroundIsTransparent?: boolean;
}): TSelectionSample {
    const klHistory = p.klCanvas.getKlHistory();
    const layers = p.klCanvas.getLayersRaw();

    klHistory.pause(true);
    let selectionSample: TSelectionSample = createSelectionSample(p.sourceLayer, p.klCanvas);

    const srcBounds = getSelectionSampleBounds(selectionSample);
    p.klCanvas.eraseLayer({
        layerIndex: p.sourceLayer,
        useSelection: true,
        useAlphaLock: p.sourceLayer === 0 && !p.backgroundIsTransparent,
    });
    const transformationResult = transformSelectionAndSample(
        p.transformation,
        selectionSample,
        p.klCanvas.getSelection(),
    );
    selectionSample = transformationResult.selectionSample;
    p.klCanvas.setSelection(transformationResult.selection);

    const targetBounds = getSelectionSampleBounds(selectionSample);
    drawSelectionSample(
        p.targetLayer ?? p.sourceLayer,
        p.isPixelated ?? false,
        selectionSample,
        p.klCanvas,
    );
    klHistory.pause(false);

    const srcAndTargetEqual = !p.targetLayer || p.sourceLayer === p.targetLayer;

    // if (srcBounds) {
    //     const layerCtx = layers[p.sourceLayer].context;
    //     layerCtx.save();
    //     layerCtx.fillStyle = 'rgba(255,0,0,0.2)';
    //     layerCtx.fillRect(
    //         srcBounds.x1,
    //         srcBounds.y1,
    //         srcBounds.x2 - srcBounds.x1,
    //         srcBounds.y2 - srcBounds.y1,
    //     );
    //     layerCtx.restore();
    // }
    //
    // if (targetBounds) {
    //     const layerCtx = layers[p.targetLayer ?? p.sourceLayer].context;
    //     layerCtx.save();
    //     layerCtx.fillStyle = 'rgba(0,0,255,0.2)';
    //     layerCtx.fillRect(
    //         targetBounds.x1,
    //         targetBounds.y1,
    //         targetBounds.x2 - targetBounds.x1,
    //         targetBounds.y2 - targetBounds.y1,
    //     );
    //     layerCtx.restore();
    // }

    if (!klHistory.isPaused()) {
        const srcLayer = layers[p.sourceLayer];
        const targetLayer =
            p.targetLayer !== undefined && p.targetLayer !== p.sourceLayer
                ? layers[p.targetLayer]
                : undefined;
        klHistory.push({
            selection: {
                value: p.klCanvas.getSelection(),
            },
            layerMap: createLayerMap(
                layers,
                {
                    layerId: srcLayer.id,
                    attributes: ['tiles'],
                    bounds: srcAndTargetEqual
                        ? BB.updateBounds(srcBounds, targetBounds)
                        : srcBounds,
                },
                targetLayer
                    ? {
                          layerId: targetLayer.id,
                          attributes: ['tiles'],
                          bounds: targetBounds,
                      }
                    : undefined,
            ),
        });
    }

    return selectionSample;
}

/**
 * Transforms the selection sample (creates one if there's none, same way as in transformViaSelection)
 * and draws a clone on target layer.
 * Also transforms the selection, unless there is no selection.
 */
export function klCanvasTransformCloneViaSelection(p: {
    klCanvas: KlCanvas;
    selectionSample?: TSelectionSample;

    // source layer optional if there already is a selectionSample
    sourceLayer?: number;
    targetLayer: number;
    transformation: Matrix; // relative to (0,0) of canvas
    isPixelated?: boolean; // default false
}): TSelectionSample {
    const klHistory = p.klCanvas.getKlHistory();
    const layers = p.klCanvas.getLayersRaw();
    let selectionSample = p.selectionSample;

    klHistory.pause(true);
    if (!selectionSample) {
        if (p.sourceLayer === undefined) {
            throw new Error('no source layer');
        }
        selectionSample = createSelectionSample(p.sourceLayer, p.klCanvas);
    }
    const transformationResult = transformSelectionAndSample(
        p.transformation,
        selectionSample,
        p.klCanvas.getSelection(),
    );
    selectionSample = transformationResult.selectionSample;
    p.klCanvas.setSelection(transformationResult.selection);

    drawSelectionSample(p.targetLayer, p.isPixelated ?? false, selectionSample, p.klCanvas);
    const targetBounds = getSelectionSampleBounds(selectionSample);
    klHistory.pause(false);

    // if (targetBounds) {
    //     const layerCtx = layers[p.targetLayer ?? p.sourceLayer].context;
    //     layerCtx.save();
    //     layerCtx.fillStyle = 'rgba(0,0,255,0.2)';
    //     layerCtx.fillRect(
    //         targetBounds.x1,
    //         targetBounds.y1,
    //         targetBounds.x2 - targetBounds.x1,
    //         targetBounds.y2 - targetBounds.y1,
    //     );
    //     layerCtx.restore();
    // }

    if (!klHistory.isPaused() && targetBounds) {
        const targetLayer = layers[p.targetLayer];
        klHistory.push({
            selection: {
                value: p.klCanvas.getSelection(),
            },
            layerMap: createLayerMap(layers, {
                layerId: targetLayer.id,
                attributes: ['tiles'],
                bounds: targetBounds,
            }),
        });
    }

    return selectionSample;
}
