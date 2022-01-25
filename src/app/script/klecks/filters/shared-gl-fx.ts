import {fx} from '../../../script-vendor/glfx';

let fxCanvas = null
try {
    fxCanvas = fx.canvas();
} catch (e) {
}

export function getSharedFx() {
    if (!fxCanvas || fxCanvas._.gl.isContextLost()) {
        try {
            fxCanvas = fx.canvas();
        } catch (e) {
        }
    }
    return fxCanvas;
}