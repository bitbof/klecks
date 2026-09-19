import { KlCanvas } from './kl-canvas';
import { getSelectionSampleBounds } from '../transform/get-selection-sample-bounds';
import { MultiPolygon } from 'polygon-clipping';
import {
    createHistoryEntryFromChanges,
    TChangeListEntry,
} from '../history/push-helpers/create-history-entry-from-changes';
import { createFfdMeshForSelectionSample, TFfdLattice } from '../transform/ffd';
import { FfdRenderer } from '../transform/ffd-renderer';
import {
    RENDERED_FFD_MESH_RESOLUTION,
    transformSelection,
} from '../transform/composed-transformation';
import { TSelectionSample } from '../transform/selection-sample';
import { TInterpolationAlgorithm } from '../kl-types';
import { getFfdMeshBoundsInArea } from '../transform/ffd-utils';

function drawWarpedSelectionSample(
    algorithm: TInterpolationAlgorithm,
    selectionSample: TSelectionSample,
    ctx: CanvasRenderingContext2D,
    ffdLattice: TFfdLattice,
    ffdRenderer: FfdRenderer,
): void {
    ffdRenderer.render({
        ffdLattice,
        selectionSample,
        algorithm: algorithm,
        outputWidth: ctx.canvas.width,
        outputHeight: ctx.canvas.height,
    });
    const outputCanvas = ffdRenderer.getCanvas();
    if (outputCanvas) {
        ctx.save();
        ctx.drawImage(outputCanvas, 0, 0);
        ctx.restore();
    }
}

/**
 * Warps (FFD) the selected region in klCanvas and sets the new selection.
 */
export function klCanvasFfd(p: {
    klCanvas: KlCanvas;
    selectionSample: TSelectionSample;
    selection?: MultiPolygon;
    // in relation to selection sample
    ffd: TFfdLattice;
    // erases selected region on this layer
    eraseLayerIndex?: number;
    targetLayerIndex: number;
    algorithm: TInterpolationAlgorithm;
    backgroundIsTransparent?: boolean;
    ffdRenderer: FfdRenderer;
}): void {
    const backgroundIsTransparent = p.backgroundIsTransparent ?? false;
    const klHistory = p.klCanvas.getKlHistory();
    const layers = p.klCanvas.getLayersReference();
    const targetLayer = layers[p.targetLayerIndex];

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
        drawWarpedSelectionSample(
            p.algorithm,
            p.selectionSample,
            targetLayer.context,
            p.ffd,
            p.ffdRenderer,
        );
        transformedSelection = p.selection
            ? transformSelection({ type: 'ffd', ffd: p.ffd }, p.selection)
            : undefined;
        p.klCanvas.setSelection(transformedSelection);
    } finally {
        klHistory.pause(false);
    }

    if (!klHistory.isPaused()) {
        const ffdMesh = createFfdMeshForSelectionSample(
            RENDERED_FFD_MESH_RESOLUTION,
            RENDERED_FFD_MESH_RESOLUTION,
            p.ffd,
            p.selectionSample,
            1,
            1,
            true,
        );
        const width = p.klCanvas.getWidth();
        const height = p.klCanvas.getHeight();
        const targetBounds = getFfdMeshBoundsInArea(ffdMesh, width, height);
        const eraseLayer = p.eraseLayerIndex !== undefined ? layers[p.eraseLayerIndex] : undefined;
        const changes: TChangeListEntry[] = [];
        transformedSelection && changes.push({ selection: transformedSelection });
        eraseLayer &&
            changes.push({
                layerId: eraseLayer.id,
                bounds: getSelectionSampleBounds(p.selectionSample),
            });
        targetBounds &&
            changes.push({
                layerId: targetLayer.id,
                bounds: targetBounds,
            });
        klHistory.push(createHistoryEntryFromChanges(layers, changes));
    }
}
