import { gl } from '../core/gl';
import { FxShader } from '../core/fx-shader';
import { simpleShader } from '../core/simple-shader';
import shaderNoise from '../shaders/shader-noise.glsl';
import { TFxCanvas } from '../fx-canvas-types';

/**
 * Noise
 * draws noise, completely replaces original image
 */
export type TFilterNoise = (
    this: TFxCanvas,
    seed: number | undefined, // float, any value okay - default 0
    type: number, // 1 value, 2 simplex, 3 cellular
    scale: [number, number], // float, small scale will show repeating patterns
    offset: [number, number], // offset x, y - large offsets will show repeating patterns
    octaves: number, // int 0 - 4
    samples: number, // 1 | 4 | 8 -> super-sampling
    peaks: number, // how often it will ramp *additionally* from 0 to 1
    brightness: number, // range [-1, 1]
    contrast: number, // range [-1, 1]
    isReversed: boolean, // reverse 0-1 range
    colA: { r: number; g: number; b: number } | undefined, // which color at 0, if rgb - default black
    colB: { r: number; g: number; b: number } | undefined, // which color at 1, if rgb - default white
    channels: 'rgb' | 'alpha', // which channel to target
) => TFxCanvas;

export const noise: TFilterNoise = function (
    seed,
    type,
    scale,
    offset,
    octaves,
    samples,
    peaks,
    brightness,
    contrast,
    isReversed,
    colA,
    colB,
    channels,
) {
    gl.noise = gl.noise || new FxShader(null, shaderNoise.replace(/#define.*/, ''), 'noise');
    simpleShader.call(this, gl.noise, {
        seed: seed || 0,
        type,
        scale: [scale[0], scale[1]],
        offset,
        octaves,
        samples,
        texSize: [this.width, this.height],
        peaks,
        brightness,
        contrast,
        isReversed: isReversed ? 1.0 : 0.0,
        colA: colA ? [colA.r / 255, colA.g / 255, colA.b / 255] : [0, 0, 0],
        colB: colB ? [colB.r / 255, colB.g / 255, colB.b / 255] : [1, 1, 1],
        channels: channels === 'rgb' ? 0 : 1,
    });

    return this;
};
