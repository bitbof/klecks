import type { Psd } from 'ag-psd/dist/psd';
import { loadAgPsd } from './load-ag-psd';

export async function psdToBlob(psd: Psd): Promise<Blob> {
    const agPsd = await loadAgPsd();
    const buffer = agPsd.writePsdBuffer(psd);
    return new Blob([buffer], { type: 'image/vnd.adobe.photoshop' });
}
