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
    (textureIn || this._.texture).use();
    this._.spareTexture.drawTo(function () {
        shader.uniforms(uniforms).drawRect();
    });
    this._.spareTexture.swapWith(textureOut || this._.texture);
}
