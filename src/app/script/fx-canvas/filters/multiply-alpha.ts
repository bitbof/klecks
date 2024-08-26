import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * multiplyAlpha
 * applies alpha multiply
 */
export type TFilterMultiplyAlpha = (this: TFxCanvas) => TFxCanvas;

export const multiplyAlpha: TFilterMultiplyAlpha = function () {
    gl.multiplyAlpha =
        gl.multiplyAlpha ||
        new FxShader(
            null,
            '\
    uniform sampler2D texture;\
    uniform vec2 texSize;\
    varying vec2 texCoord;\
    \
    void main() {\
        vec4 color = texture2D(texture, texCoord);\
        color.rgb *= color.a;\
        gl_FragColor = color;\
    }\
',
            'multiplyAlpha',
        );

    simpleShader.call(this, gl.multiplyAlpha, {
        texSize: [this.width, this.height],
    });

    return this;
};
