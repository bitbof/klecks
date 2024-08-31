// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { gl } from '../core/gl';
import { Shader } from '../core/shader';
import { simpleShader } from '../core/simple-shader';
import { BB } from '../../bb/bb';

/**
 * @filter       Vibrance
 * @description  Modifies the saturation of desaturated colors, leaving saturated colors unmodified.
 * @param amount -1 to 1 (-1 is minimum vibrance, 0 is no change, and 1 is maximum vibrance)
 */
export function vibrance(amount) {
    gl.vibrance =
        gl.vibrance ||
        new Shader(
            null,
            '\
        uniform sampler2D texture;\
        uniform float amount;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            float average = (color.r + color.g + color.b) / 3.0;\
            float mx = max(color.r, max(color.g, color.b));\
            float amt = (mx - average) * (-amount * 3.0);\
            color.rgb = mix(color.rgb, vec3(mx), amt);\
            gl_FragColor = color;\
        }\
    ',
            'vibrance',
        );

    simpleShader.call(this, gl.vibrance, {
        amount: BB.clamp(amount, -1, 1),
    });

    return this;
}
