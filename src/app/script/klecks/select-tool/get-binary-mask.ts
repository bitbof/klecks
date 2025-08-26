import { MultiPolygon } from 'polygon-clipping';
import { BB } from '../../bb/bb';
import { drawSelectionMask } from '../../bb/base/canvas';

export function getBinaryMask(selection: MultiPolygon, width: number, height: number): Uint8Array {
    const result = new Uint8Array(new ArrayBuffer(width * height));
    const canvas = BB.canvas(width, height);
    const ctx = BB.ctx(canvas);
    drawSelectionMask(selection, ctx);
    const imageData = ctx.getImageData(0, 0, width, height);
    BB.freeCanvas(canvas);
    const len = width * height;
    for (let i = 0, e = 0; i < len; i++, e += 4) {
        result[i] = imageData.data[e] >>> 7;
    }
    return result;
}
