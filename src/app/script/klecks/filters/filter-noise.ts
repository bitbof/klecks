import { BB } from '../../bb/bb';
import {
    TFilterApply,
    TFilterGetDialogParam,
    TFilterGetDialogResult,
    TMixMode,
    TRgb,
} from '../kl-types';
import { LANG } from '../../language/language';
import { KlSlider } from '../ui/components/kl-slider';
import { getSharedFx } from '../../fx-canvas/shared-fx';
import { Options } from '../ui/components/options';
import { EVENT_RES_MS } from './filters-consts';
import { Select } from '../ui/components/select';
import { translateBlending } from '../canvas/translate-blending';
import { KL } from '../kl';
import { ColorConverter } from '../../bb/color/color';
import { Checkbox } from '../ui/components/checkbox';
import { TWrappedTexture } from '../../fx-canvas/fx-canvas-types';
import { css, throwIfNull } from '../../bb/base/base';
import { FxPreviewRenderer } from '../ui/project-viewport/fx-preview-renderer';
import { Preview } from '../ui/project-viewport/preview';
import { TProjectViewportProject } from '../ui/project-viewport/project-viewport';
import { getPreviewHeight, getPreviewWidth } from '../ui/utils/preview-size';
import { testIsSmall } from '../ui/utils/test-is-small';
import { canvasToLayerTiles } from '../history/push-helpers/canvas-to-layer-tiles';
import { noise } from '../../fx-canvas/filters/noise';
import { drawSelectionMask } from '../../bb/base/canvas';
import { getPushableLayerChange } from '../history/push-helpers/get-pushable-layer-change';
import { integerBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';

// see noise(...) in fx-canvas
type TNoisePreset = {
    type: number;
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    octaves: number;
    samples: number;
    peaks: number;
    brightness: number;
    contrast: number;
    isReversed: boolean;
};

type TNoiseChannels = 'rgb' | 'alpha';

type TNoiseSettings = TNoisePreset & {
    seed?: number;
    colA?: TRgb;
    colB?: TRgb;
    channels?: TNoiseChannels; // default rgb
};

export type TFilterNoiseInput = {
    seed: number;
    presetIndex: number; // which preset from presetArr
    scale: number; // applies to both scaleX and scaleX
    opacity: number; // aka strength
    isReversed: boolean; // reverse direction of color gradient
    channels: TNoiseChannels;

    // only for channels = rgb
    mixModeStr: GlobalCompositeOperation; // how mixed with image
    colA: TRgb;
    colB: TRgb;
};

const presetArr: TNoisePreset[] = [
    // each pixel random value
    {
        type: 0,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        octaves: 1,
        samples: 1,
        peaks: 0,
        brightness: 0,
        contrast: 0,
        isReversed: true,
    },

    // cloud
    {
        type: 1,
        scaleX: 166,
        scaleY: 164,
        offsetX: 105,
        offsetY: 30,
        octaves: 6,
        samples: 1,
        peaks: 0,
        brightness: 0.055,
        contrast: 0.23,
        isReversed: true,
    },

    // thin lines
    {
        type: 1,
        scaleX: 235,
        scaleY: 190,
        offsetX: 3227,
        offsetY: 2156,
        octaves: 4,
        samples: 16,
        peaks: 22,
        brightness: -0.375,
        contrast: 1,
        isReversed: false,
    },

    // soft large simplex, only 1 octave
    {
        type: 1,
        scaleX: 40,
        scaleY: 40,
        offsetX: 0,
        offsetY: 0,
        octaves: 1,
        samples: 1,
        peaks: 0,
        brightness: 0,
        contrast: 0,
        isReversed: false,
    },

    // two value large pixels
    {
        type: 0,
        scaleX: 26,
        scaleY: 26,
        offsetX: 557,
        offsetY: 365,
        octaves: 1,
        samples: 1,
        peaks: 0,
        brightness: 0.02,
        contrast: 1,
        isReversed: true,
    },

    // zebra
    {
        type: 1,
        scaleX: 1500,
        scaleY: 1500,
        offsetX: 745,
        offsetY: 2871,
        octaves: 5,
        samples: 16,
        peaks: 156.02,
        brightness: 0.03,
        contrast: 1,
        isReversed: true,
    },

    // sparse dots / stars
    {
        type: 1,
        scaleX: 11,
        scaleY: 11,
        offsetX: 2940,
        offsetY: 2045,
        octaves: 1,
        samples: 16,
        peaks: 1,
        brightness: -0.045,
        contrast: 1,
        isReversed: true,
    },

    // pseudo marble
    {
        type: 2,
        scaleX: 74,
        scaleY: 74,
        offsetX: 4816,
        offsetY: 1304,
        octaves: 3,
        samples: 1,
        peaks: 2.78,
        brightness: 0,
        contrast: 0,
        isReversed: false,
    },
];

function createNoiseSettings(input: TFilterNoiseInput): TNoiseSettings {
    const result: TNoiseSettings = BB.copyObj(presetArr[input.presetIndex]) as TNoiseSettings;
    result.seed = input.seed;
    result.scaleX = (result.scaleX * input.scale) / 50;
    result.scaleY = (result.scaleY * input.scale) / 50;
    result.colA = input.colA;
    result.colB = input.colB;
    result.isReversed = input.isReversed ? !result.isReversed : result.isReversed;
    result.channels = input.channels;
    return result;
}

function createNoiseParameters(settings: TNoiseSettings): Parameters<typeof noise> {
    return [
        settings.seed,
        settings.type,
        [settings.scaleX, settings.scaleY],
        [settings.offsetX, settings.offsetY],
        settings.octaves,
        settings.samples,
        settings.peaks,
        settings.brightness,
        settings.contrast,
        settings.isReversed,
        settings.colA,
        settings.colB,
        settings.channels ? settings.channels : 'rgb',
    ];
}

export const filterNoise = {
    getDialog(params: TFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const thumbImgArr: HTMLImageElement[] = [];
        const thumbSize = 32;
        {
            const fxCanvas = throwIfNull(getSharedFx());
            const canvas = BB.canvas(thumbSize, thumbSize);
            const ctx = BB.ctx(canvas);
            const texture = fxCanvas.texture(canvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size
            texture.destroy();

            presetArr.forEach((preset) => {
                const thumbImg = new Image();
                const settings = BB.copyObj(preset) as TNoiseSettings;
                settings.scaleX /= 10;
                settings.scaleY /= 10;
                fxCanvas.noise(...createNoiseParameters(settings)).update();
                ctx.drawImage(fxCanvas, 0, 0);
                thumbImg.src = canvas.toDataURL('image/png');
                thumbImgArr.push(thumbImg);
            });

            texture.destroy();
        }

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterNoiseInput> = {
            element: rootEl,
        };
        const isSmall = testIsSmall();
        if (!isSmall) {
            result.width = getPreviewWidth(isSmall);
        }

        const noiseInput: TFilterNoiseInput = {
            seed: Math.random() * 300,
            presetIndex: 0,
            scale: 50,
            opacity: 0.5,
            isReversed: false,
            channels: 'rgb',
            mixModeStr: 'source-over' as GlobalCompositeOperation,
            colA: { r: 0, g: 0, b: 0 },
            colB: { r: 255, g: 255, b: 255 },
        };

        const presetOptions = new Options({
            optionArr: thumbImgArr.map((img, index) => {
                css(img, {
                    margin: '1px',
                    borderRadius: '3px',
                    transition: 'all 0.1s ease-in-out',
                });
                return {
                    id: '' + index,
                    label: img,
                };
            }),
            initId: '0',
            onChange: (id) => {
                noiseInput.presetIndex = Number(id);
                update();
            },
            css: {
                marginBottom: '10px',
            },
        });
        rootEl.append(presetOptions.getElement());

        const scaleSlider = new KlSlider({
            label: LANG('filter-noise-scale'),
            width: 300,
            height: 30,
            min: 1,
            max: 1000,
            value: noiseInput.scale,
            eventResMs: EVENT_RES_MS,
            curve: BB.powerSplineInput(1, 1000, 0.1),
            onChange: (value) => {
                noiseInput.scale = value;
                update();
            },
        });
        scaleSlider.getElement().style.marginBottom = '10px';

        const opacitySlider = new KlSlider({
            label: LANG('opacity'),
            width: 300,
            height: 30,
            min: 1 / 100,
            max: 1,
            value: noiseInput.opacity,
            eventResMs: EVENT_RES_MS,
            toValue: (displayValue) => displayValue / 100,
            toDisplayValue: (value) => value * 100,
            onChange: (value) => {
                noiseInput.opacity = value;
                update();
            },
        });
        opacitySlider.getElement().style.marginBottom = '10px';

        const row1El = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
            },
        });

        const row2El = BB.el({
            css: {
                display: 'flex',
                marginBottom: '10px',
            },
        });

        const channelsOptions = new Options<TNoiseChannels>({
            optionArr: [
                { id: 'rgb', label: 'RGB' },
                { id: 'alpha', label: LANG('filter-noise-alpha') },
            ],
            initId: 'rgb',
            onChange: (id: TNoiseChannels) => {
                noiseInput.channels = id;
                if (id === 'rgb') {
                    row2El.style.visibility = '';
                } else {
                    row2El.style.visibility = 'hidden';
                }
                update();
            },
        });

        const reverseToggle = new Checkbox({
            label: LANG('reverse'),
            callback: (val) => {
                noiseInput.isReversed = val;
                update();
            },
            allowTab: true,
            name: 'reverse-gradient',
        });

        const mixModes: (TMixMode | undefined)[] = [
            'source-over',
            undefined,
            'darken',
            'multiply',
            'color-burn',
            undefined,
            'lighten',
            'screen',
            'color-dodge',
            undefined,
            'overlay',
            'soft-light',
            'hard-light',
            undefined,
            'difference',
            'exclusion',
            undefined,
            'hue',
            'saturation',
            'color',
            'luminosity',
        ];

        const blendSelect = new Select({
            isFocusable: true,
            optionArr: mixModes.map((item) => {
                return item ? ([item, translateBlending(item)] as [TMixMode, string]) : undefined;
            }),
            initValue: noiseInput.mixModeStr,
            onChange: (val: GlobalCompositeOperation) => {
                noiseInput.mixModeStr = val;
                update();
            },
            name: 'blend-mode',
        });
        blendSelect.getElement().title = LANG('layers-blending');

        const colorWrapper = BB.el({
            css: {
                display: 'flex',
            },
        });

        const colInputStyle = {
            width: '34px',
            height: '34px',
            marginRight: '5px',
        };
        const colAInput = KL.input({
            type: 'color',
            init: '#' + ColorConverter.toHexString(noiseInput.colA),
            callback: (val) => {
                const newColor = ColorConverter.hexToRGB(val);
                if (newColor) {
                    noiseInput.colA = newColor;
                    update();
                }
            },
            css: colInputStyle,
        });

        const colBInput = KL.input({
            type: 'color',
            init: '#' + ColorConverter.toHexString(noiseInput.colB),
            callback: (val) => {
                const newColor = ColorConverter.hexToRGB(val);
                if (newColor) {
                    noiseInput.colB = newColor;
                    update();
                }
            },
            css: colInputStyle,
        });

        colorWrapper.append(colAInput, colBInput);

        row1El.append(
            channelsOptions.getElement(),
            BB.el({ css: { flexGrow: '1' } }),
            reverseToggle.getElement(),
        );

        row2El.append(blendSelect.getElement(), BB.el({ css: { flexGrow: '1' } }), colorWrapper);

        rootEl.append(scaleSlider.getElement(), opacitySlider.getElement(), row1El, row2El);

        const fxPreviewRenderer = new FxPreviewRenderer({
            original: context.canvas,
            onUpdate: (fxCanvas, transform) => {
                const settings = createNoiseSettings(noiseInput);
                settings.scaleX *= transform.scaleX;
                settings.scaleY *= transform.scaleY;
                settings.offsetX = (context.canvas.width / 2) * transform.scaleX + transform.x;
                settings.offsetY = (context.canvas.height / 2) * transform.scaleY + transform.y;
                return fxCanvas.noise(...createNoiseParameters(settings));
            },
            postMix: {
                opacity: noiseInput.opacity,
                operation:
                    noiseInput.channels === 'alpha' ? 'destination-out' : noiseInput.mixModeStr,
            },
            selection: klCanvas.getSelection(),
            isMaskingWithEmptyOriginal: true,
        });

        const previewLayerArr: TProjectViewportProject['layers'] = [];
        {
            for (let i = 0; i < layers.length; i++) {
                previewLayerArr.push({
                    image:
                        i === selectedLayerIndex
                            ? fxPreviewRenderer.render
                            : layers[i].context.canvas,
                    isVisible: layers[i].isVisible,
                    opacity: layers[i].opacity,
                    mixModeStr: layers[i].mixModeStr,
                    hasClipping: false,
                });
            }
        }

        const preview = new Preview({
            width: getPreviewWidth(isSmall),
            height: getPreviewHeight(isSmall),
            project: {
                width: context.canvas.width,
                height: context.canvas.height,
                layers: previewLayerArr,
            },
            selection: klCanvas.getSelection(),
        });
        preview.render();
        css(preview.getElement(), {
            marginLeft: '-20px',
            marginRight: '-20px',
        });
        rootEl.append(preview.getElement());

        function update(): void {
            fxPreviewRenderer.setPostMix({
                opacity: noiseInput.opacity,
                operation:
                    noiseInput.channels === 'alpha' ? 'destination-out' : noiseInput.mixModeStr,
            });
            preview.render();
        }

        result.destroy = (): void => {
            presetOptions.destroy();
            scaleSlider.destroy();
            opacitySlider.destroy();
            reverseToggle.destroy();
            channelsOptions.destroy();
            blendSelect.destroy();
            preview.destroy();
            fxPreviewRenderer.destroy();
        };
        result.getInput = function (): TFilterNoiseInput {
            result.destroy!();
            return BB.copyObj(noiseInput);
        };

        return result;
    },

    apply(params: TFilterApply<TFilterNoiseInput>): boolean {
        const context = params.layer.context;
        const klCanvas = params.klCanvas;
        const klHistory = params.klHistory;
        if (!context || !klCanvas) {
            return false;
        }

        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }

        const input = params.input;
        const selection = klCanvas.getSelection();
        let maskTexture: TWrappedTexture | undefined;
        if (selection) {
            const maskCanvas = BB.canvas(context.canvas.width, context.canvas.height);
            const maskContext = BB.ctx(maskCanvas);
            drawSelectionMask(selection, maskContext);
            maskTexture = fxCanvas.texture(maskCanvas);
            BB.freeCanvas(maskCanvas);
        }
        fxCanvas.initialize(context.canvas.width, context.canvas.height);
        {
            const settings = createNoiseSettings(input);
            settings.offsetX = context.canvas.width / 2;
            settings.offsetY = context.canvas.height / 2;
            fxCanvas.noise(...createNoiseParameters(settings)).update();
        }
        if (maskTexture) {
            fxCanvas.multiplyAlpha().mask(maskTexture).unmultiplyAlpha();
            maskTexture.destroy();
        }
        fxCanvas.update();

        context.save();
        context.globalAlpha = input.opacity;
        if (input.channels === 'alpha') {
            context.globalCompositeOperation = 'destination-out';
        } else {
            context.globalCompositeOperation = input.mixModeStr;
        }
        context.drawImage(fxCanvas, 0, 0);
        context.restore();

        klHistory.push(
            getPushableLayerChange(
                klHistory.getComposed(),
                canvasToLayerTiles(
                    context.canvas,
                    selection ? integerBounds(getMultiPolyBounds(selection)) : undefined,
                ),
            ),
        );
        return true;
    },
};
