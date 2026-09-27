import { inverse } from 'transformation-matrix';
import type { Matrix } from 'transformation-matrix';
import type { TFxCanvas } from '../fx-canvas-types';
import { fxGl } from './gl';
import { FxShader } from './fx-shader';
import { simpleShader } from './simple-shader';

export type TMaskRect = (this: TFxCanvas, transformMatrix: Matrix) => TFxCanvas;

/**
 * Clears pixels outside the rectangle produced by the affine transform.
 * The transform maps the current canvas rectangle to the masked rectangle.
 */
export const maskRect: TMaskRect = function (transformMatrix): TFxCanvas {
    fxGl.maskRect =
        fxGl.maskRect ||
        new FxShader(
            null,
            `
uniform sampler2D texture;
uniform mat3 matrix;
uniform vec2 texSize;
varying vec2 texCoord;
void main() {
    vec2 coord = texCoord * texSize;
    vec3 rectCoord = matrix * vec3(coord, 1.0);
    if (
        rectCoord.x < 0.0 ||
        rectCoord.y < 0.0 ||
        rectCoord.x > texSize.x ||
        rectCoord.y > texSize.y
    ) {
        gl_FragColor = vec4(0.0);
    } else {
        gl_FragColor = texture2D(texture, texCoord);
    }
}
        `,
            'maskRect',
        );

    const inverseTransform = inverse(transformMatrix);
    simpleShader.call(this, fxGl.maskRect, {
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
    });

    return this;
};
