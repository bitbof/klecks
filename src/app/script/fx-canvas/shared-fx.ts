import { fxCanvas } from './fx-canvas';
import { TFxCanvas } from './fx-canvas-types';
import { asyncThrow } from '../bb/base/base';

let failed = false;
let fx: TFxCanvas | null = null;

export function getSharedFx(): TFxCanvas | null {
    // failed previously, don't need to try again.
    if (failed) {
        return fx;
    }

    if (!fx || fx.isContextLost()) {
        try {
            fx = fxCanvas();
        } catch (e) {
            failed = true;
            fx = null;
            asyncThrow(e);
        }
    }
    return fx;
}
