import { KlCanvas } from './kl-canvas';
import { Matrix } from 'transformation-matrix';
import {
    getSelectionBoundsFromSample,
    getSelectionSampleBounds,
} from '../transform/get-selection-sample-bounds';
import { MultiPolygon } from 'polygon-clipping';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';
import { setContextAlgorithm } from '../utils/set-context-algorithm';
import { freeTransformToMatrix, transformSelection } from '../transform/composed-transformation';
import { TFreeTransform } from '../transform/transform-types';
import { TSelectionSample } from '../transform/selection-sample';
import { indexBoundsInArea } from '../../bb/math/math';
import {
    createHistoryEntryFromChanges,
    TChangeListEntry,
} from '../history/push-helpers/create-history-entry-from-changes';
import { TInterpolationAlgorithm } from '../kl-types';

function drawTransformedSelectionSample(
    algorithm: TInterpolationAlgorithm,
    selectionSample: TSelectionSample,
    ctx: CanvasRenderingContext2D,
    transformation: Matrix,
): void {
    ctx.save();
    ctx.setTransform(...matrixToTuple(transformation));
    setContextAlgorithm(ctx, algorithm);
    ctx.drawImage(selectionSample.image, selectionSample.x, selectionSample.y);
    ctx.restore();
}

/**
 * Transforms the selected region in klCanvas and sets the new selection.
 */
export function klCanvasTransform(p: {
    klCanvas: KlCanvas;
    selectionSample: TSelectionSample;
    // you can transform without an active selection
    selection?: MultiPolygon;
    // in relation to selection sample, selection bounds
    freeTransform: TFreeTransform;
    // erases selected/sample region on this layer
    eraseLayerIndex?: number;
    // sample will be transformed/cloned on this layer
    targetLayerIndex: number;
    algorithm: TInterpolationAlgorithm;
    backgroundIsTransparent?: boolean; // default false
}): void {
    const backgroundIsTransparent = p.backgroundIsTransparent ?? false;
    const klHistory = p.klCanvas.getKlHistory();
    const layers = p.klCanvas.getLayersReference();
    const targetLayer = layers[p.targetLayerIndex];
    const matrix = freeTransformToMatrix(
        p.freeTransform,
        getSelectionBoundsFromSample(p.selectionSample),
    );

    let transformedSelection: MultiPolygon | undefined;
    klHistory.pause(true);
    try {
        if (p.eraseLayerIndex !== undefined) {
            p.klCanvas.eraseLayer({
                layerIndex: p.eraseLayerIndex,
                useSelection: true,
                useAlphaLock: p.eraseLayerIndex === 0 && !backgroundIsTransparent,
            });
        }
        drawTransformedSelectionSample(p.algorithm, p.selectionSample, targetLayer.context, matrix);
        transformedSelection = p.selection
            ? transformSelection({ type: 'free', freeTransform: p.freeTransform }, p.selection)
            : undefined;
        p.klCanvas.setSelection(transformedSelection);
    } finally {
        klHistory.pause(false);
    }

    if (!klHistory.isPaused()) {
        const eraseLayer = p.eraseLayerIndex !== undefined ? layers[p.eraseLayerIndex!] : undefined;
        const targetBounds = indexBoundsInArea(
            getSelectionSampleBounds(p.selectionSample, matrix),
            p.klCanvas.getWidth(),
            p.klCanvas.getHeight(),
        );
        const changes: TChangeListEntry[] = [];
        transformedSelection && changes.push({ selection: transformedSelection });
        eraseLayer &&
            changes.push({
                layerId: eraseLayer.id,
                bounds: getSelectionSampleBounds(p.selectionSample),
            });
        targetBounds && changes.push({ layerId: targetLayer.id, bounds: targetBounds });
        klHistory.push(createHistoryEntryFromChanges(layers, changes));
    }
}
