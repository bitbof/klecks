import { TFxGl } from '../fx-canvas-types';

export let gl: WebGLRenderingContext;
export let fxGl: TFxGl;

export function setGl(newGl: TFxGl): void {
    fxGl = newGl;
    gl = newGl.gl;
}
