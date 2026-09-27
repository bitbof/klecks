import { fxGl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * multiplyAlpha
 * applies alpha multiply
 */
export type TFilterMultiplyAlpha = (this: TFxCanvas) => TFxCanvas;

export const multiplyAlpha: TFilterMultiplyAlpha = function () {
    fxGl.multiplyAlpha =
        fxGl.multiplyAlpha ||
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

    simpleShader.call(this, fxGl.multiplyAlpha, {
        texSize: [this.canvas.width, this.canvas.height],
    });

    return this;
};
