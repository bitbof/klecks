import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * Unsharp Mask
 * @description    A form of image sharpening that amplifies high-frequencies in the image. It
 *                 is implemented by scaling pixels away from the average of their neighbors.
 * @param radius   The blur radius that calculates the average of the neighboring pixels.
 * @param strength A scale factor where 0 is no effect and higher values cause a stronger effect.
 */
export type TFilterUnsharpMask = (this: TFxCanvas, radius: number, strength: number) => TFxCanvas;

export const unsharpMask: TFilterUnsharpMask = function (radius, strength) {
    gl.unsharpMask =
        gl.unsharpMask ||
        new FxShader(
            null,
            '\
        uniform sampler2D blurredTexture;\
        uniform sampler2D originalTexture;\
        uniform float strength;\
        uniform float threshold;\
        varying vec2 texCoord;\
        void main() {\
            vec4 blurred = texture2D(blurredTexture, texCoord);\
            vec4 original = texture2D(originalTexture, texCoord);\
            gl_FragColor = mix(blurred, original, 1.0 + strength);\
        }\
    ',
            'unsharpMask',
        );

    // Store a copy of the current texture in the second texture unit
    this._.extraTexture.ensureFormatViaTexture(this._.texture);
    this._.texture.use();
    this._.extraTexture.drawTo(function () {
        FxShader.getDefaultShader().drawRect();
    });

    // Blur the current texture, then use the stored texture to detect edges
    this._.extraTexture.use(1);
    this.triangleBlur(radius);
    gl.unsharpMask.textures({
        originalTexture: 1,
    });
    simpleShader.call(this, gl.unsharpMask, {
        strength: strength,
    });
    this._.extraTexture.unuse(1);

    return this;
};
