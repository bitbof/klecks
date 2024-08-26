import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';
import { IRGBA } from '../../klecks/kl-types';

/**
 * To Alpha
 * @description   Generates alpha channel from luminance (r+g+b)
 * @param isInverted    boolean - invert luminance
 * @param replaceRGBA    rgba - color to replace rgb with. if a = 0 -> keep orig color
 */
export type TFilterToAlpha = (
    this: TFxCanvas,
    isInverted: boolean,
    replaceRGBA: IRGBA | null,
) => TFxCanvas;

export const toAlpha: TFilterToAlpha = function (isInverted, replaceRGBA) {
    gl.toAlpha =
        gl.toAlpha ||
        new FxShader(
            null,
            '\
    uniform bool isInverted;\
    uniform vec4 replace;\
    uniform sampler2D texture;\
    uniform vec2 texSize;\
    varying vec2 texCoord;\
    \
    void main() {\
        vec4 color = texture2D(texture, texCoord);\
        float alpha = (color.r + color.g + color.b) / 3.0;\
        if (isInverted) alpha = 1.0 - alpha;\
        alpha = min(color.a, alpha);\
        if (replace.a > 0.0) color = replace;\
        gl_FragColor = vec4(color.r, color.g, color.b, alpha);\
    }\
',
            'toAlpha',
        );

    simpleShader.call(this, gl.toAlpha, {
        isInverted: isInverted ? 1 : 0,
        replace: replaceRGBA
            ? [replaceRGBA.r / 255, replaceRGBA.g / 255, replaceRGBA.b / 255, replaceRGBA.a]
            : [0, 0, 0, 0],
        texSize: [this.width, this.height],
    });

    return this;
};
