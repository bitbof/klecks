import { TFilterBrightnessContrast } from './filters/brightness-contrast';
import { TFilterCurves } from './filters/curves';
import { TFilterHueSaturation } from './filters/hue-saturation';
import { TFilterDistort } from './filters/distort';
import { TFilterInvert } from './filters/invert';
import { TFilterMatrixWarp } from './filters/matrix-warp';
import { TFilterMultiplyAlpha } from './filters/multiply-alpha';
import { TFilterUnmultiplyAlpha } from './filters/unmultiply-alpha';
import { TFilterNoise } from './filters/noise';
import { TFilterPerspective } from './filters/perspective';
import { TFilterTiltShift } from './filters/tilt-shift';
import { TFilterToAlpha } from './filters/to-alpha';
import { TFilterTriangleBlur } from './filters/triangle-blur';
import { TFilterUnsharpMask } from './filters/unsharp-mask';
import { FxTexture } from './core/fx-texture';
import { FxShader } from './core/fx-shader';

export type TVec3 = [number, number, number];
export type TMat2x2 = [number, number, number, number];
export type TMat3x3 = [number, number, number, number, number, number, number, number, number];
export type TMatDeep3x3 = [TVec3, TVec3, TVec3];

export type TFxSupportedElements = HTMLCanvasElement | HTMLVideoElement | HTMLImageElement;

export type TUniforms<T extends number | number[] | unknown = unknown> = Record<string, T>;

export type TFxFilters = {
    matrixWarp: TFilterMatrixWarp;
    multiplyAlpha: TFilterMultiplyAlpha;
    unmultiplyAlpha: TFilterUnmultiplyAlpha;

    brightnessContrast: TFilterBrightnessContrast;
    curves: TFilterCurves;
    distort: TFilterDistort;
    hueSaturation: TFilterHueSaturation;
    invert: TFilterInvert;
    noise: TFilterNoise;
    perspective: TFilterPerspective;
    tiltShift: TFilterTiltShift;
    toAlpha: TFilterToAlpha;
    triangleBlur: TFilterTriangleBlur;
    unsharpMask: TFilterUnsharpMask;
};

type TFxShaders = Record<keyof Pick<TFxFilters, keyof TFxFilters>, FxShader | undefined>;

export type TFxGl = WebGLRenderingContext &
    TFxShaders & {
        framebuffer: WebGLFramebuffer;
        vertexBuffer: WebGLBuffer;
        texCoordBuffer: WebGLBuffer;
        defaultShader: FxShader;
    };

export type TWrappedTexture = {
    /** Pseudo private. Don't interface with this. */
    _: FxTexture;

    /**
     * Loads the image from an HTML element into the texture. This is more efficient than repeatedly
     * creating and destroying textures.
     *
     * element - The HTML element to store in the texture, either an <img>, a <canvas>, or a <video>.
     */
    loadContentsOf: (element: TFxSupportedElements) => void;

    /**
     * Textures will be garbage collected eventually when they are no longer referenced, but this method will
     * free GPU resources immediately.
     */
    destroy: () => void;
};

export type TFxCanvas = HTMLCanvasElement &
    TFxFilters & {
        /** Pseudo private. Don't interface with this. */
        _: {
            gl: TFxGl;
            isInitialized: boolean;
            texture: FxTexture;
            spareTexture: FxTexture;
            extraTexture: FxTexture;
            flippedShader: FxShader;
        };

        /**
         * Texture Constructor
         * Creates a texture that initially stores the image from an HTML element. Notice that texture() is a method on a
         * canvas object, which means if you want to use the same image on two canvas objects you will need two different
         * textures, one for each canvas.
         *
         * element - The HTML element to store in the texture, either an <img>, a <canvas>, or a <video>.
         */
        texture: (element: TFxSupportedElements) => TWrappedTexture;

        /**
         * This replaces the internal contents of the canvas with the image stored in texture. All filter operations take
         * place in a chain that starts with fxCanvas.draw() and ends with fxCanvas.update().
         *
         * texture - Stores image data, the result of calling fx.texture().
         *
         * optional width and height to scale to. If no width and height are given then the original
         * texture width and height
         */
        draw: (texture: TWrappedTexture, width?: number, height?: number) => TFxCanvas;

        /**
         * Update Screen
         * This replaces the visible contents of the canvas with the internal image result. For efficiency reasons,
         * the internal image buffers are not rendered to the screen every time a filter is applied, so you will need
         * to call update() on your canvas after you have finished applying the filters to be able to see the result.
         * All filter operations take place in a chain that starts with fxCanvas.draw() and ends with fxCanvas.update().
         */
        update: () => TFxCanvas;

        /**
         * Returns new texture with contents of canvas.
         */
        contents: () => TWrappedTexture;

        /**
         * Get a Uint8 array of pixel values: [r, g, b, a, r, g, b, a, ...]
         * Length of the array will be width * height * 4.
         */
        getPixelArray: () => Uint8Array;
    };
