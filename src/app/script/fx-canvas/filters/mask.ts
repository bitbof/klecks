import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas, TWrappedTexture } from '../fx-canvas-types';

/**
 * Mask
 * @description Blends with an unfiltered image using a mask.
 * @param originalTexture original/unfiltered image
 * @param maskTexture mask (grayscale). 0 - unfiltered, 255 - filtered
 */
export type TFilterMask = (
    this: TFxCanvas,
    originalTexture: TWrappedTexture,
    maskTexture: TWrappedTexture,
) => TFxCanvas;

export const mask: TFilterMask = function (originalTexture, maskTexture) {
    originalTexture._.use(1);
    maskTexture._.use(2);

    gl.mask =
        gl.mask ||
        new FxShader(
            null,
            `
        uniform sampler2D texture;
        uniform sampler2D original;
        uniform sampler2D mask;
        varying vec2 texCoord;

        void main() {
            vec4 filteredCol = texture2D(texture, texCoord);
            vec4 originalCol = texture2D(original, texCoord);
            float maskStrength = texture2D(mask, texCoord).r;
            gl_FragColor = mix(originalCol, filteredCol, maskStrength);
        }
        `,
            'mask',
        );

    gl.mask.textures({
        original: 1,
        mask: 2,
    });

    simpleShader.call(this, gl.mask, {});

    return this;
};
