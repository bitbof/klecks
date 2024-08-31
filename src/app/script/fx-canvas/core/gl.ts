import { TFxGl } from '../fx-canvas-types';

export let gl: TFxGl;

export function setGl(newGl: TFxGl | null): void {
    // more problems setting type to null
    gl = newGl as TFxGl;
}
