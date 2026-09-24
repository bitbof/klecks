import { KlCanvas } from '../canvas/kl-canvas';
import type { Psd } from 'ag-psd/dist/psd';
import { blendKlToPsd } from './psd';
import { psdToBlob } from './psd-to-blob';
import { attempt, AttemptError } from '../../bb/base/base';

export async function klCanvasToPsdBlob(
    klCanvas: KlCanvas,
    isPreviewIncluded: boolean = true,
): Promise<Blob> {
    const layerArr = klCanvas.getLayers();

    let canvas: HTMLCanvasElement | undefined;
    if (isPreviewIncluded) {
        // makes saving less likely to fail
        const c = attempt(() => klCanvas.getCanvas());
        if (!(c instanceof AttemptError)) {
            canvas = c;
        }
    }

    const psdConfig: Psd = {
        width: klCanvas.getWidth(),
        height: klCanvas.getHeight(),
        canvas,
        children: layerArr.map((item) => {
            // todo - can be optimized if layer mostly empty
            return {
                name: item.name,
                hidden: !item.isVisible,
                opacity: item.opacity,
                canvas: item.canvas,
                blendMode: blendKlToPsd(item.mixModeStr),
                clipping: item.hasClipping,
                left: 0,
                top: 0,
            };
        }),
    };

    return await psdToBlob(psdConfig);
}
