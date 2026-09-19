import { fxGl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * unmultiplyAlpha
 * reverses alpha multiply
 */
export type TFilterUnmultiplyAlpha = (this: TFxCanvas) => TFxCanvas;

export const unmultiplyAlpha: TFilterUnmultiplyAlpha = function () {
    fxGl.unmultiplyAlpha =
        fxGl.unmultiplyAlpha ||
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

    simpleShader.call(this, fxGl.unmultiplyAlpha, {
        texSize: [this.canvas.width, this.canvas.height],
    });

    return this;
};
