import {fxCanvas} from './fx-canvas';
import {TFxCanvas} from './fx-canvas-types';

let fx: TFxCanvas | null = null;
try {
    fx = fxCanvas();
} catch (e) {
}

export function getSharedFx (): TFxCanvas | null {
    if (!fx || fx._.gl.isContextLost()) {
        try {
            fx = fxCanvas();
        } catch (e) {
            // console.log(e);
        }
    }
    return fx;
}