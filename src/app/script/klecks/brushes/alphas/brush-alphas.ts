import { BB } from '../../../bb/bb';
import { noise } from '../../../bb/math/perlin';
import { IVector2D } from '../../../bb/bb-types';

// chalk
export function genBrushAlpha01(w: number): HTMLCanvasElement {
    const scaleFac = w / 500;
    const h = w;
    const canvas = BB.canvas(w, h);
    const ctx = BB.ctx(canvas);
    const imData = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const i = (y * w + x) * 4;

            // base noise
            const sFac2 = scaleFac + noise.simplex2(x / 50 / scaleFac, y / 50 / scaleFac) * 0.04;
            let noisePattern =
                100 + ((noise.simplex2(x / 50 / sFac2, y / 50 / sFac2) + 1) / 2) * 100;
            noisePattern -= ((noise.simplex2(x / 10 / scaleFac, y / 10 / scaleFac) + 1) / 2) * 100;

            // fade out in circular shape
            const centerDist = BB.dist(w / 2, h / 2, x, y);
            const falloff = BB.clamp(
                1 -
                    ((centerDist - w / 2.5) / (w / 14) +
                        noise.simplex2(x / 22 / sFac2, y / 22 / sFac2)),
                0,
                1,
            );
            noisePattern = noisePattern * falloff;

            // make the middle darker
            const falloff2 = BB.clamp(1 - centerDist / w, 0, 1) * 2;
            noisePattern = noisePattern * falloff2;

            imData.data[i] = 0;
            imData.data[i + 1] = 0;
            imData.data[i + 2] = 0;
            imData.data[i + 3] = BB.clamp(noisePattern, 0, 255);
        }
    }

    ctx.putImageData(imData, 0, 0);
    return canvas;
}

// https://www.shadertoy.com/view/3tdSDj
function udSegment(p: IVector2D, a: IVector2D, b: IVector2D): number {
    const ba = BB.Vec2.sub(b, a);
    const pa = BB.Vec2.sub(p, a);
    const h = BB.clamp(BB.Vec2.dot(pa, ba) / BB.Vec2.dot(ba, ba), 0.0, 1.0);
    return BB.Vec2.len(BB.Vec2.sub(pa, BB.Vec2.mul(ba, h)));
}

// calligraphy
export function genBrushAlpha02(w: number): HTMLCanvasElement {
    const pDist = 1 / 4;
    let centerSize = 2 / 3;
    let transitionSize = 1 / 3;
    centerSize *= pDist;
    transitionSize *= pDist;
    const p1 = { x: pDist * w, y: w - w * pDist };
    const p2 = { x: w - w * pDist, y: pDist * w };

    const h = w;
    const canvas = BB.canvas(w, h);
    const ctx = BB.ctx(canvas);
    const imData = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const i = (y * w + x) * 4;

            let col = udSegment({ x: x, y: y }, p1, p2);

            col = BB.clamp(255 - ((col - w * centerSize) / (w * transitionSize)) * 255, 0, 255);

            imData.data[i] = 0;
            imData.data[i + 1] = 0;
            imData.data[i + 2] = 0;
            imData.data[i + 3] = col;
        }
    }

    ctx.putImageData(imData, 0, 0);
    return canvas;
}
