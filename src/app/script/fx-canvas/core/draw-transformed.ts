import type { Matrix } from 'transformation-matrix';
import { inverse } from 'transformation-matrix';
import type { TFxCanvas, TWrappedTexture } from '../fx-canvas-types';
import { FxShader } from './fx-shader';
import { simpleShader } from './simple-shader';
import { fxGl } from './gl';

export type TDrawTransformed = (
    this: TFxCanvas,
    texture: TWrappedTexture,
    transformMatrix: Matrix,
) => TFxCanvas;

/**
 * Draws a texture onto the FX canvas using an affine transform.
 * The transform maps texture coordinates to canvas coordinates.
 * Texture coordinates outside the source are clamped to its edge.
 */
export const drawTransformed: TDrawTransformed = function (texture, transformMatrix): TFxCanvas {
    fxGl.drawTransformed =
        fxGl.drawTransformed ||
        new FxShader(
            null,
            `
uniform sampler2D texture;
uniform mat3 matrix;
uniform vec2 texSize;
varying vec2 texCoord;
void main() {
    vec2 coord = texCoord * texSize;
    vec3 transformedCoord = matrix * vec3(coord, 1.0);
    coord = transformedCoord.xy / transformedCoord.z;
    gl_FragColor = texture2D(texture, coord / texSize);
}
            `,
            'drawTransformed',
        );

    const inverseTransform = inverse(transformMatrix);
    simpleShader.call(
        this,
        fxGl.drawTransformed,
        {
            matrix: [
                inverseTransform.a,
                inverseTransform.b,
                0,
                inverseTransform.c,
                inverseTransform.d,
                0,
                inverseTransform.e,
                inverseTransform.f,
                1,
            ],
            texSize: [this.canvas.width, this.canvas.height],
        },
        texture._,
    );

    return this;
};
