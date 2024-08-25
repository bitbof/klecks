import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * Invert
 * @description   Inverts color of each pixel
 */
export type TFilterInvert = (this: TFxCanvas) => TFxCanvas;

export const invert: TFilterInvert = function () {
    gl.invert =
        gl.invert ||
        new FxShader(
            null,
            '\
    uniform sampler2D texture;\
    uniform vec2 texSize;\
    varying vec2 texCoord;\
    \
    void main() {\
        vec4 color = texture2D(texture, texCoord);\
        color.rgb = 1.0 - color.rgb;\
        gl_FragColor = color;\
    }\
',
            'invert',
        );

    simpleShader.call(this, gl.invert, {
        texSize: [this.width, this.height],
    });

    return this;
};
