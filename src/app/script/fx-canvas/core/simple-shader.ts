import { TFxCanvas, TUniforms } from '../fx-canvas-types';
import { FxTexture } from './fx-texture';
import { FxShader } from './fx-shader';

export function simpleShader(
    this: TFxCanvas,
    shader: FxShader,
    uniforms: TUniforms<number | number[]>,
    textureIn?: FxTexture,
    textureOut?: FxTexture,
): void {
    const texture = this._.texture;
    const spareTexture = this._.spareTexture;
    if (texture === undefined || spareTexture === undefined) {
        throw new Error('FX canvas is not initialized');
    }
    (textureIn || texture).use();
    spareTexture.drawTo(function () {
        shader.uniforms(uniforms).drawRect();
    });
    spareTexture.swapWith(textureOut || texture);
}
