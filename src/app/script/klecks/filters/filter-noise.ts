import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer, IRGB, TMixMode} from '../kl-types';
import {LANG} from '../../language/language';
import {KlSlider} from '../ui/components/kl-slider';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {Options} from '../ui/components/options';
import {eventResMs} from './filters-consts';
import {Select} from '../ui/components/select';
import {translateBlending} from '../canvas/translate-blending';
import {KL} from '../kl';
import {ColorConverter} from '../../bb/color/color';
import {Checkbox} from '../ui/components/checkbox';
import {TFxCanvas, TWrappedTexture} from '../../fx-canvas/fx-canvas-types';
import {TKlCanvasHistoryEntry} from '../canvas/kl-canvas';
import {throwIfNull} from '../../bb/base/base';

// see noise(...) in fx-canvas
interface INoisePreset {
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
}

type TNoiseChannels = 'rgb' | 'alpha';

interface INoiseSettings extends INoisePreset {
    seed?: number;
    colA?: IRGB;
    colB?: IRGB;
    channels?: TNoiseChannels; // default rgb
}

export type TFilterNoiseInput = {
    seed: number;
    presetIndex: number; // which preset from presetArr
    scale: number; // applies to both scaleX and scaleX
    opacity: number; // aka strength
    isReversed: boolean; // reverse direction of color gradient
    channels: TNoiseChannels;

    // only for channels = rgb
    mixModeStr: GlobalCompositeOperation; // how mixed with image
    colA: IRGB;
    colB: IRGB;
}

/*export type TFilterNoiseHistoryEntry = TFilterHistoryEntry<
    'replaceLayer',
    TFilterNoiseInput>;*/

const presetArr: INoisePreset[] = [
    // each pixel random value
    {type: 0, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, octaves: 1, samples: 1, peaks: 0, brightness: 0, contrast: 0, isReversed: true},

    // cloud
    {type: 1, scaleX: 166, scaleY: 164, offsetX: 105, offsetY: 30, octaves: 6, samples: 1, peaks: 0, brightness: 0.055, contrast: 0.23, isReversed: true},

    // thin lines
    {type: 1, scaleX: 235, scaleY: 190, offsetX: 3227, offsetY: 2156, octaves: 4, samples: 16, peaks: 22, brightness: -0.375, contrast: 1, isReversed: false},

    // soft large simplex, only 1 octave
    {type: 1, scaleX: 40, scaleY: 40, offsetX: 0, offsetY: 0, octaves: 1, samples: 1, peaks: 0, brightness: 0, contrast: 0, isReversed: false},

    // two value large pixels
    {type: 0, scaleX: 26, scaleY: 26, offsetX: 557, offsetY: 365, octaves: 1, samples: 1, peaks: 0, brightness: 0.02, contrast: 1, isReversed: true},

    // zebra
    {type: 1, scaleX: 1500, scaleY: 1500, offsetX: 745, offsetY: 2871, octaves: 5, samples: 16, peaks: 156.02, brightness: 0.03, contrast: 1, isReversed: true},

    // sparse dots / stars
    {type: 1, scaleX: 11, scaleY: 11, offsetX: 2940, offsetY: 2045, octaves: 1, samples: 16, peaks: 1, brightness: -0.045, contrast: 1, isReversed: true},

    // pseudo marble
    {type: 2, scaleX: 74, scaleY: 74, offsetX: 4816, offsetY: 1304, octaves: 3, samples: 1, peaks: 2.78, brightness: 0, contrast: 0, isReversed: false},
];

function drawNoise (fxCanvas: TFxCanvas, settings: INoiseSettings): void {
    fxCanvas.noise(
        settings.seed,
        settings.type,
        [settings.scaleX, settings.scaleY],
        [fxCanvas.width / 2, fxCanvas.height / 2],
        settings.octaves,
        settings.samples,
        settings.peaks,
        settings.brightness,
        settings.contrast,
        settings.isReversed,
        settings.colA,
        settings.colB,
        settings.channels ? settings.channels : 'rgb',
    ).update();
}


export const filterNoise = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        const w = parseInt('' + fit.width), h = parseInt('' + fit.height);
        const renderW = Math.min(w, context.canvas.width);
        const renderH = Math.min(h, context.canvas.height);
        const renderFactor = renderW / context.canvas.width;


        const fxCanvas = throwIfNull(getSharedFx());
        let texture: TWrappedTexture;

        const thumbImgArr: HTMLImageElement[] = [];
        const thumbSize = 32;
        {
            const canvas = BB.canvas(thumbSize, thumbSize);
            const ctx = BB.ctx(canvas);
            texture = fxCanvas.texture(canvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size
            texture.destroy();

            presetArr.forEach((preset) => {
                const thumbImg = new Image();
                const presetCopy = BB.copyObj(preset) as INoiseSettings;
                presetCopy.scaleX /= 10;
                presetCopy.scaleY /= 10;
                drawNoise(fxCanvas, presetCopy);
                ctx.drawImage(fxCanvas, 0, 0);
                thumbImg.src = canvas.toDataURL('image/png');
                thumbImgArr.push(thumbImg);
            });

        }

        {
            const tempCanvas = BB.canvas(renderW, renderH);
            texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size
            BB.freeCanvas(tempCanvas);
        }

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterNoiseInput> = {
            element: div,
        };

        div.innerHTML = LANG('filter-noise-description') + '<br/><br/>';

        const settingsObj: TFilterNoiseInput = {
            seed: Math.random() * 300,
            presetIndex: 0,
            scale: 50,
            opacity: 0.5,
            isReversed: false,
            channels: 'rgb',
            mixModeStr: 'source-over' as GlobalCompositeOperation,
            colA: {r: 0, g: 0, b: 0},
            colB: {r: 255, g: 255, b: 255},
        };


        const presetOptions = new Options({
            optionArr: thumbImgArr.map((img, index) => {
                BB.css(img, {
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
                settingsObj.presetIndex = Number(id);
                updatePreview();
            },
        });
        presetOptions.getElement().style.marginBottom = '10px';
        div.append(presetOptions.getElement());

        const scaleSlider = new KlSlider({
            label: LANG('filter-noise-scale'),
            width: 300,
            height: 30,
            min: 1,
            max: 1000,
            value: settingsObj.scale,
            eventResMs: eventResMs,
            curve: BB.quadraticSplineInput(1, 1000, 0.1),
            onChange: (value) => {
                settingsObj.scale = value;
                updatePreview();
            },
        });
        scaleSlider.getElement().style.marginBottom = '10px';

        const opacitySlider = new KlSlider({
            label: LANG('opacity'),
            width: 300,
            height: 30,
            min: 1 / 100,
            max: 1,
            value: settingsObj.opacity,
            eventResMs: eventResMs,
            toValue: (displayValue) => displayValue / 100,
            toDisplayValue: (value) => value * 100,
            onChange: (value) => {
                settingsObj.opacity = value;
                updatePreview();
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
            },
        });

        const channelsOptions = new Options<TNoiseChannels>({
            optionArr: [
                {id: 'rgb', label: 'RGB'},
                {id: 'alpha', label: LANG('filter-noise-alpha')},
            ],
            initId: 'rgb',
            onChange: (id: TNoiseChannels) => {
                settingsObj.channels = id;
                if (id === 'rgb') {
                    row2El.style.visibility = '';
                } else {
                    row2El.style.visibility = 'hidden';
                }
                updatePreview();
            },
        });

        const reverseToggle = new Checkbox({
            label: LANG('reverse'),
            callback: (val) => {
                settingsObj.isReversed = val;
                updatePreview();
            },
            allowTab: true,
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
            optionArr: mixModes.map(item => {
                return item ? ([item, translateBlending(item)] as [TMixMode, string]) : undefined;
            }),
            initValue: settingsObj.mixModeStr,
            onChange: (val: GlobalCompositeOperation) => {
                settingsObj.mixModeStr = val;
                updatePreview();
            },
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
            init: '#' + ColorConverter.toHexString(settingsObj.colA),
            callback: (val) => {
                const newColor = ColorConverter.hexToRGB(val);
                if (newColor) {
                    settingsObj.colA = newColor;
                    updatePreview();
                }
            },
            css: colInputStyle,
        });

        const colBInput = KL.input({
            type: 'color',
            init: '#' + ColorConverter.toHexString(settingsObj.colB),
            callback: (val) => {
                const newColor = ColorConverter.hexToRGB(val);
                if (newColor) {
                    settingsObj.colB = newColor;
                    updatePreview();
                }
            },
            css: colInputStyle,
        });

        colorWrapper.append(
            colAInput,
            colBInput,
        );


        row1El.append(
            channelsOptions.getElement(),
            BB.el({css:{flexGrow: '1'}}),
            reverseToggle.getElement(),
        );

        row2El.append(
            blendSelect.getElement(),
            BB.el({css:{flexGrow: '1'}}),
            colorWrapper,
        );

        div.append(
            scaleSlider.getElement(),
            opacitySlider.getElement(),
            row1El,
            row2El,
        );



        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: '340px',
                height: '220px',
            },
        });

        const previewLayer: IKlBasicLayer = {
            image: BB.canvas(renderW, renderH),
            isVisible: layers[selectedLayerIndex].isVisible,
            opacity: layers[selectedLayerIndex].opacity,
            mixModeStr: layers[selectedLayerIndex].mixModeStr,
        };
        const klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: layers.map((item, i) => {
                if (i === selectedLayerIndex) {
                    return previewLayer;
                } else {
                    return {
                        image: item.context.canvas,
                        isVisible: item.isVisible,
                        opacity: item.opacity,
                        mixModeStr: item.mixModeStr,
                    };
                }
            }),
        });

        const previewInnerWrapper = BB.el({
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: parseInt('' + w) + 'px',
                height: parseInt('' + h) + 'px',
            },
        });
        previewInnerWrapper.append(klCanvasPreview.getElement());
        previewWrapper.append(previewInnerWrapper);

        function updatePreview (): void {
            const ctx = BB.ctx((previewLayer.image as HTMLCanvasElement));
            ctx.save();
            ctx.clearRect(0, 0, renderW, renderH);
            ctx.drawImage(context.canvas, 0, 0, renderW, renderH);

            ctx.globalAlpha = settingsObj.opacity;

            const presetCopy = BB.copyObj(presetArr[settingsObj.presetIndex]) as INoiseSettings;
            presetCopy.seed = settingsObj.seed;
            presetCopy.scaleX = presetCopy.scaleX  * settingsObj.scale / 50 * renderFactor;
            presetCopy.scaleY = presetCopy.scaleY  * settingsObj.scale / 50 * renderFactor;
            presetCopy.colA = settingsObj.colA;
            presetCopy.colB = settingsObj.colB;
            presetCopy.isReversed = settingsObj.isReversed ? !presetCopy.isReversed : presetCopy.isReversed;
            presetCopy.channels  = settingsObj.channels;
            drawNoise(fxCanvas, presetCopy);

            if (settingsObj.channels === 'alpha') {
                ctx.globalCompositeOperation = 'destination-out';
            } else {
                ctx.globalCompositeOperation = settingsObj.mixModeStr;
            }

            ctx.drawImage(fxCanvas, 0, 0);

            ctx.restore();
            klCanvasPreview.render();
        }
        setTimeout(updatePreview, 0);

        div.append(previewWrapper);
        result.destroy = (): void => {
            presetOptions.destroy();
            scaleSlider.destroy();
            opacitySlider.destroy();
            reverseToggle.destroy();
            channelsOptions.destroy();
            texture.destroy();
            blendSelect.destroy();
            klCanvasPreview.destroy();
        };
        result.getInput = function (): TFilterNoiseInput {
            result.destroy!();
            return BB.copyObj(settingsObj);
        };

        return result;
    },

    apply (params: IFilterApply<TFilterNoiseInput>): boolean {
        const context = params.context;
        const klCanvas = params.klCanvas;
        const history = params.history;
        if (!context || !klCanvas || !history) {
            return false;
        }

        history.pause(true);

        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).update();
        texture.destroy();

        const input = params.input;

        const presetCopy: INoiseSettings = BB.copyObj(presetArr[input.presetIndex]) as INoiseSettings;
        presetCopy.seed = input.seed;
        presetCopy.scaleX = presetCopy.scaleX  * input.scale / 50;
        presetCopy.scaleY = presetCopy.scaleY  * input.scale / 50;
        presetCopy.colA = input.colA;
        presetCopy.colB = input.colB;
        presetCopy.isReversed = input.isReversed ? !presetCopy.isReversed : presetCopy.isReversed;
        presetCopy.channels  = input.channels;
        drawNoise(fxCanvas, presetCopy);

        context.save();
        context.globalAlpha = input.opacity;
        if (input.channels === 'alpha') {
            context.globalCompositeOperation = 'destination-out';
        } else {
            context.globalCompositeOperation = input.mixModeStr;
        }
        context.drawImage(fxCanvas, 0, 0);
        context.restore();

        history.pause(false);

        history.push({
            tool: ['canvas'],
            action: 'replaceLayer',
            params: [
                klCanvas.getLayerIndex(context.canvas),
                context.getImageData(0, 0, context.canvas.width, context.canvas.height),
            ],
        } as TKlCanvasHistoryEntry);
        return true;
    },

};