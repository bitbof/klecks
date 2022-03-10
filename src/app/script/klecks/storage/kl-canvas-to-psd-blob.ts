import {KL} from '../kl';
import {KlCanvas} from '../canvas/kl-canvas';

export async function klCanvasToPsdBlob(klCanvas: KlCanvas): Promise<Blob> {
    let layerArr = klCanvas.getLayersFast();

    let psdConfig = {
        width: klCanvas.getWidth(),
        height: klCanvas.getHeight(),
        //canvas: klCanvas.getCompleteCanvas(1), // preview, can be skipped
        children: []
    };
    for (let i = 0; i < layerArr.length; i++) {
        // todo - can be optimized if layer mostly empty
        let item = layerArr[i];
        psdConfig.children.push({
            name: item.name,
            opacity: item.opacity,
            canvas: item.canvas,
            blendMode: KL.PSD.blendKlToPsd(item.mixModeStr),
            left: 0,
            top: 0
        });
    }

    let agPsd = await import('ag-psd');
    let buffer = agPsd.writePsdBuffer(psdConfig);
    return new Blob([buffer], { type: 'application/octet-stream' });
}