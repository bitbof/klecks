import { brightnessContrast } from './filters/brightness-contrast';
import { FxShader } from './core/fx-shader';
import { gl, setGl } from './core/gl';
import { FxTexture } from './core/fx-texture';
import { curves } from './filters/curves';
import { hueSaturation } from './filters/hue-saturation';
import { noise } from './filters/noise';
import { triangleBlur } from './filters/triangle-blur';
import { tiltShift } from './filters/tilt-shift';
import { matrixWarp } from './filters/matrix-warp';
import { unsharpMask } from './filters/unsharp-mask';
import { toAlpha } from './filters/to-alpha';
import { invert } from './filters/invert';
import { perspective } from './filters/perspective';
import { unmultiplyAlpha } from './filters/unmultiply-alpha';
import { distort } from './filters/distort';
import { multiplyAlpha } from './filters/multiply-alpha';
import { TFxCanvas, TFxGl, TFxSupportedElements, TWrappedTexture } from './fx-canvas-types';
import { BB } from '../bb/bb';
import { changeCanvasDimensions } from '../bb/base/change-canvas-dimensions';
import { mask } from './filters/mask';
import { drawTransformed } from './core/draw-transformed';
import { maskRect } from './core/mask-rect';

/*
 * based on glfx.js
 * https://github.com/evanw/glfx.js/
 * Copyright 2011 Evan Wallace
 * Released under the MIT license
 */

/**
 * Before you can apply any filters you will need a canvas, which stores the result of the filters you apply.
 * Canvas creation is done through fxCanvas(), which creates and returns a controller for a new WebGL <canvas>.
 * This call will throw an error message if the browser doesn't support WebGL.
 *
 * This library provides realtime image effects using WebGL. There are three parts to it:
 * - texture - a raw source of image data (created from <img> <canvas> or <video>)
 * - filter - an image effect (represents one or more WebGL shaders)
 * - canvas - an image buffer that stores the results (a WebGL <canvas> tag)
 */
export const fxCanvas: () => TFxCanvas = (function () {
    function wrapTexture(texture: FxTexture): TWrappedTexture {
        return {
            _: texture,
            loadContentsOf: function (element) {
                // Make sure that we're using the correct global WebGL context
                setGl(this._.fxGl);
                this._.loadContentsOf(element);
            },
            setSampling: function (minification, magnification) {
                // Make sure that we're using the correct global WebGL context
                setGl(this._.fxGl);
                this._.setSampling(minification, magnification);
            },
            destroy: function () {
                // Make sure that we're using the correct global WebGL context
                setGl(this._.fxGl);
                this._.destroy();
            },
        };
    }

    function texture(element: TFxSupportedElements) {
        return wrapTexture(FxTexture.fromElement(element));
    }

    function getTextureType(): GLenum {
        let textureType: GLenum = gl.UNSIGNED_BYTE;

        // Go for floating point buffer textures if we can, it'll make the bokeh
        // filter look a lot better. Note that on Windows, ANGLE does not let you
        // render to a floating-point texture when linear filtering is enabled.
        // See http://crbug.com/172278 for more information.
        if (
            gl.getExtension('WEBGL_color_buffer_float') && // firefox shows warning without this line
            gl.getExtension('OES_texture_float') &&
            gl.getExtension('OES_texture_float_linear')
        ) {
            const testTexture = new FxTexture(100, 100, gl.RGBA, gl.FLOAT);
            try {
                // Only use gl.FLOAT if we can render to it
                testTexture.drawTo(function () {
                    textureType = gl.FLOAT;
                });
            } catch (e) {
                /* empty */
            }
            testTexture.destroy();
        }
        return textureType;
    }

    let textureType: number | undefined;

    function getIsInitialized(this: TFxCanvas): boolean {
        return this._.isInitialized;
    }

    function initialize(this: TFxCanvas, width: number, height: number): void {
        textureType = textureType ?? getTextureType();
        this._.texture?.destroy();
        this._.spareTexture?.destroy();
        changeCanvasDimensions(this.canvas, width, height);
        this._.texture = new FxTexture(width, height, gl.RGBA, textureType);
        this._.spareTexture = new FxTexture(width, height, gl.RGBA, textureType);
        this._.extraTexture = this._.extraTexture || new FxTexture(0, 0, gl.RGBA, textureType);
        this._.flippedShader =
            this._.flippedShader ||
            new FxShader(
                null,
                `
uniform sampler2D texture;
varying vec2 texCoord;
void main() {
    gl_FragColor = texture2D(texture, vec2(texCoord.x, 1.0 - texCoord.y));
}
        `,
                'flippedShader',
            );
        this._.isInitialized = true;
    }

    function draw(
        this: TFxCanvas,
        texture: TWrappedTexture,
        width?: number,
        height?: number,
    ): TFxCanvas {
        if (
            !this._.isInitialized ||
            texture._.width !== this.canvas.width ||
            texture._.height !== this.canvas.height
        ) {
            initialize.call(
                this,
                width ? width : texture._.width,
                height ? height : texture._.height,
            );
        }

        texture._.use();
        const targetTexture = this._.texture!;
        targetTexture.drawTo(function () {
            FxShader.getDefaultShader().drawRect();
        });

        return this;
    }

    function update(this: TFxCanvas): TFxCanvas {
        this._.texture!.use();
        this._.flippedShader!.drawRect();
        return this;
    }

    function copyTo(this: TFxCanvas, target: TWrappedTexture): void {
        const sourceTexture = this._.texture!;
        if (target._.fxGl !== sourceTexture.fxGl) {
            throw new Error('Cannot copy FX canvas contents between WebGL contexts');
        }
        const targetTexture = target._;
        targetTexture.ensureFormat(
            sourceTexture.width,
            sourceTexture.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
        );

        sourceTexture.use();
        targetTexture.drawTo(function () {
            FxShader.getDefaultShader().drawRect();
        });
    }

    function contents(this: TFxCanvas): TWrappedTexture {
        const sourceTexture = this._.texture!;
        const target = wrapTexture(
            new FxTexture(sourceTexture.width, sourceTexture.height, gl.RGBA, gl.UNSIGNED_BYTE),
        );
        copyTo.call(this, target);
        return target;
    }

    /*
       Get a Uint8 array of pixel values: [r, g, b, a, r, g, b, a, ...]
       Length of the array will be width * height * 4.
    */
    function getPixelArray(this: TFxCanvas): Uint8Array {
        const texture = this._.texture!;
        const w = texture.width;
        const h = texture.height;
        const array = new Uint8Array(w * h * 4);
        texture.drawTo(function () {
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, array);
        });
        return array;
    }

    function wrap<F extends (...args: any[]) => unknown>(fn: F): F {
        return <F>function (this: TFxCanvas, ...args: any[]) {
            // Make sure that we're using the correct global WebGL context
            setGl(this._.fxGl);
            // Now that the context has been switched, we can call the wrapped function
            return fn.apply(this, args);
        };
    }

    function getWebGlContext(
        canvas: HTMLCanvasElement,
        options?: WebGLContextAttributes,
    ): WebGLRenderingContext | null {
        const contextNames = ['webgl', 'experimental-webgl', 'webgl2'];
        let context: WebGLRenderingContext | null = null;
        contextNames.forEach((name) => {
            if (context) {
                return;
            }
            // get.webgl.org does a try-catch
            try {
                context = canvas.getContext(name, options) as typeof context;
            } catch (e) {
                /* empty */
            }
        });
        return context;
    }

    return (): TFxCanvas => {
        if (!window.WebGLRenderingContext) {
            throw 'WebGLRenderingContext not set. Browser does not support WebGL.';
        }

        const canvas = BB.canvas(1, 1);
        const context = getWebGlContext(canvas, { premultipliedAlpha: false });
        if (!context) {
            throw 'This browser does not support WebGL';
        }
        const fxGl: TFxGl = { gl: context };
        setGl(fxGl);

        return {
            canvas,
            _: {
                fxGl,
                isInitialized: false,
            },

            // Core methods
            texture: wrap(texture),
            getIsInitialized: wrap(getIsInitialized),
            initialize: wrap(initialize),
            draw: wrap(draw),
            drawTransformed: wrap(drawTransformed),
            maskRect: wrap(maskRect),
            update: wrap(update),
            copyTo: wrap(copyTo),
            contents: wrap(contents),
            getPixelArray: wrap(getPixelArray),
            isContextLost: () => {
                return context.isContextLost();
            },

            // Filter methods
            brightnessContrast: wrap(brightnessContrast),
            hueSaturation: wrap(hueSaturation),
            triangleBlur: wrap(triangleBlur),
            unsharpMask: wrap(unsharpMask),
            perspective: wrap(perspective),
            matrixWarp: wrap(matrixWarp),
            tiltShift: wrap(tiltShift),
            noise: wrap(noise),
            curves: wrap(curves),
            invert: wrap(invert),
            multiplyAlpha: wrap(multiplyAlpha),
            unmultiplyAlpha: wrap(unmultiplyAlpha),
            toAlpha: wrap(toAlpha),
            distort: wrap(distort),
            mask: wrap(mask),
        };
    };
})();
