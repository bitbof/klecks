import { BB } from '../../bb/bb';
import { simpleShader } from '../core/simple-shader';
import { FxShader } from '../core/fx-shader';
import { gl } from '../core/gl';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * Brightness / Contrast
 * Provides additive brightness and multiplicative contrast control.
 * @param brightness -1 to 1 (-1 is solid black, 0 is no change, and 1 is solid white)
 * @param contrast   -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */
export type TFilterBrightnessContrast = (
    this: TFxCanvas,
    brightness: number,
    contrast: number,
) => TFxCanvas;

export const brightnessContrast: TFilterBrightnessContrast = function (brightness, contrast) {
    gl.brightnessContrast =
        gl.brightnessContrast ||
        new FxShader(
            null,
            '\
        uniform sampler2D texture;\
        uniform float brightness;\
        uniform float contrast;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            color.rgb += brightness;\
            if (contrast > 0.0) {\
                color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;\
            } else {\
                color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;\
            }\
            gl_FragColor = color;\
        }\
    ',
            'brightnessContrast',
        );

    simpleShader.call(this, gl.brightnessContrast, {
        brightness: BB.clamp(brightness, -1, 1),
        contrast: BB.clamp(contrast, -1, 1),
    });

    return this;
};
