import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { randomShaderFunc } from '../shaders/random-shader-func';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * Triangle Blur
 * @description  This is the most basic blur filter, which convolves the image with a
 *               pyramid filter. The pyramid filter is separable and is applied as two
 *               perpendicular triangle filters.
 *               Note: Requires alpha to be premultiplied.
 * @param radius The radius of the pyramid convolved with the image.
 */
export type TFilterTriangleBlur = (this: TFxCanvas, radius: number) => TFxCanvas;

export const triangleBlur: TFilterTriangleBlur = function (radius) {
    gl.triangleBlur =
        gl.triangleBlur ||
        new FxShader(
            null,
            '\
        uniform sampler2D texture;\
        uniform vec2 delta;\
        varying vec2 texCoord;\
        ' +
                randomShaderFunc +
                '\
        void main() {\
            vec4 color = vec4(0.0);\
            float total = 0.0;\
            \
            /* randomize the lookup values to hide the fixed number of samples */\
            float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);\
            \
            for (float t = -30.0; t <= 30.0; t++) {\
                float percent = (t + offset - 0.5) / 30.0;\
                float weight = 1.0 - abs(percent);\
                vec4 sample = texture2D(texture, texCoord + delta * percent);\
                \
                color += sample * weight;\
                total += weight;\
            }\
            \
            gl_FragColor = color / total;\
        }\
    ',
            'triangleBlur',
        );

    simpleShader.call(this, gl.triangleBlur, {
        delta: [radius / this.width, 0],
    });
    simpleShader.call(this, gl.triangleBlur, {
        delta: [0, radius / this.height],
    });

    return this;
};
