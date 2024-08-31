import { KL } from '../kl';
import { KlCanvas } from '../canvas/kl-canvas';
import { Psd } from 'ag-psd/dist/psd';
import { loadAgPsd } from './load-ag-psd';

export async function klCanvasToPsdBlob(klCanvas: KlCanvas): Promise<Blob> {
    const layerArr = klCanvas.getLayersFast();

    const psdConfig: Psd = {
        width: klCanvas.getWidth(),
        height: klCanvas.getHeight(),
        //canvas: klCanvas.getCompleteCanvas(1), // preview, can be skipped
        children: layerArr.map((item) => {
            // todo - can be optimized if layer mostly empty
            return {
                name: item.name,
                hidden: !item.isVisible,
                opacity: item.opacity,
                canvas: item.canvas,
                blendMode: KL.PSD.blendKlToPsd(item.mixModeStr),
                left: 0,
                top: 0,
            };
        }),
    };

    const agPsd = await loadAgPsd();
    const buffer = agPsd.writePsdBuffer(psdConfig);
    return new Blob([buffer], { type: 'application/octet-stream' });
}
