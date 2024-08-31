import { gl } from '../core/gl';
import { warpShader } from '../shaders/warp-shader';
import { simpleShader } from '../core/simple-shader';
import { TFxCanvas } from '../fx-canvas-types';

export type TFilterDistortSettings = {
    stepSize: number; // [1, inf]
    distortType: 0 | 1 | 2;
    scale: { x: number; y: number };
    strength: { x: number; y: number };
    phase: { x: number; y: number };
    offset: { x: number; y: number };
};

/**
 * Distort
 * Distorts image (moves pixels around)
 */
export type TFilterDistort = (this: TFxCanvas, settings: TFilterDistortSettings) => TFxCanvas;

/**
 * @filter        Distort
 * @description   Distorts image (moves pixels around)
 *                Note: Requires alpha to be premultiplied.
 */
export const distort: TFilterDistort = function (settings) {
    gl.distort =
        gl.distort ||
        warpShader(
            `
    uniform float stepSize;
    uniform vec2 scale;
    uniform vec2 strength;
    uniform vec2 phase;
    uniform float type;
    uniform vec2 offset;
`,
            `
    const float PI = 3.14159265;
    float x = coord.x + offset.x;
    float y = coord.y + offset.y;
    if (stepSize > 1.0) {
        x = floor(x / stepSize) * stepSize;
        y = floor(y / stepSize) * stepSize;
    }
    float distortX = sin((x/scale.x + phase.x) * PI * 2.0) * strength.x;
    float distortY = sin((y/scale.y + phase.y) * PI * 2.0) * strength.y;
    if (type == 0.0) {
        coord.y += distortX;
        coord.x += distortY;
    } else if (type == 1.0) {
        coord.x += distortX;
        coord.y += distortY;
    } else if (type == 2.0) {
        x -= offset.x;
        y -= offset.y;
        gl_FragColor = texture2D(texture, vec2(x, y) / texSize);
        coord.y += sin(gl_FragColor.r/scale.x*200.0 + phase.x * PI * 2.0) * strength.x;
        coord.x += cos(gl_FragColor.g/scale.y*200.0 + phase.y * PI * 2.0) * strength.y;
    }
    coord.x = mod(coord.x, texSize.x);
    coord.y = mod(coord.y, texSize.y);
`,
        );

    simpleShader.call(this, gl.distort, {
        stepSize: settings.stepSize,
        type: settings.distortType,
        scale: [settings.scale.x, settings.scale.y],
        strength: [settings.strength.x, settings.strength.y],
        phase: [settings.phase.x, settings.phase.y],
        offset: [settings.offset.x, settings.offset.y],
        texSize: [this.width, this.height],
    });

    return this;
};
