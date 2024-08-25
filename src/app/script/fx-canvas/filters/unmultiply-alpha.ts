import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * unmultiplyAlpha
 * reverses alpha multiply
 */
export type TFilterUnmultiplyAlpha = (this: TFxCanvas) => TFxCanvas;

export const unmultiplyAlpha: TFilterUnmultiplyAlpha = function () {
    gl.unmultiplyAlpha =
        gl.unmultiplyAlpha ||
        new FxShader(
            null,
            '\
    uniform sampler2D texture;\
    uniform vec2 texSize;\
    varying vec2 texCoord;\
    \
    void main() {\
        vec4 color = texture2D(texture, texCoord);\
        if(color.a > 0.0) {\
            color.rgb /= color.a;\
        }\
        gl_FragColor = color;\
    }\
',
            'unmultiplyAlpha',
        );

    simpleShader.call(this, gl.unmultiplyAlpha, {
        texSize: [this.width, this.height],
    });

    return this;
};
