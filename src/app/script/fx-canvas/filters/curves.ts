import { splineInterpolate } from '../math/spline-interpolate';
import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * Curves
 * @description A powerful mapping tool that transforms the colors in the image
 *              by an arbitrary function. The function is interpolated between
 *              a set of 2D points using splines. The curves filter can take
 *              either one or three arguments which will apply the mapping to
 *              either luminance or RGB values, respectively.
 * @param red   A list of points that define the function for the red channel.
 *              Each point is a list of two values: the value before the mapping
 *              and the value after the mapping, both in the range 0 to 1. For
 *              example, [[0,1], [1,0]] would invert the red channel while
 *              [[0,0], [1,1]] would leave the red channel unchanged.
 * @param green A list of points that define the function for the green
 *              channel (just like for red).
 * @param blue  list of points that define the function for the blue
 *              channel (just like for red).
 */
export type TFilterCurves = (
    this: TFxCanvas,
    red: [number, number][],
    green: [number, number][],
    blue: [number, number][],
) => TFxCanvas;

export const curves: TFilterCurves = function (red, green, blue) {
    // Create the ramp texture
    const redRamp = splineInterpolate(red);
    const greenRamp = splineInterpolate(green);
    const blueRamp = splineInterpolate(blue);
    const array: number[] = [];
    for (let i = 0; i < 256; i++) {
        array.splice(array.length, 0, redRamp[i], greenRamp[i], blueRamp[i], 255);
    }
    this._.extraTexture.initFromBytes(256, 1, array);
    this._.extraTexture.use(1);

    gl.curves =
        gl.curves ||
        new FxShader(
            null,
            '\
        uniform sampler2D texture;\
        uniform sampler2D map;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            color.r = texture2D(map, vec2(color.r)).r;\
            color.g = texture2D(map, vec2(color.g)).g;\
            color.b = texture2D(map, vec2(color.b)).b;\
            gl_FragColor = color;\
        }\
    ',
            'curves',
        );

    gl.curves.textures({
        map: 1,
    });
    simpleShader.call(this, gl.curves, {});

    return this;
};
