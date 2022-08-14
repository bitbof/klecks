import {BB} from '../../bb/bb';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
// @ts-ignore
import {IFilterApply, IFilterGetDialogParam, IKlBasicLayer, IMixMode, IRGB} from '../kl.types';
import {LANG} from '../../language/language';
import {KlSlider} from '../ui/base-components/kl-slider';
import {getSharedFx} from './shared-gl-fx';
import {Options} from '../ui/base-components/options';
import {eventResMs} from './filters-consts';
import {Select} from '../ui/base-components/select';
import {translateBlending} from '../canvas/translate-blending';
import {KL} from '../kl';
import {ColorConverter} from '../../bb/color/color';
// @ts-ignore
import uiSwapImg from 'url:~/src/app/img/ui/ui-swap-lr.svg';
import {Checkbox} from '../ui/base-components/checkbox';

// see noise(...) in glfx.ts
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
    doInvert: boolean;
}

type TNoiseChannels = 'rgb' | 'alpha';

interface INoiseSettings extends INoisePreset {
    seed: number;
    colA: IRGB;
    colB: IRGB;
    channels: TNoiseChannels;
}

interface INoiseFilterInput {
    seed: number;
    presetIndex: number; // which preset from presetArr
    scale: number; // applies to both scaleX and scaleX
    opacity: number; // aka strength
    doInvert: boolean;
    channels: TNoiseChannels;

    // only for channels = rgb
    mixModeStr: GlobalCompositeOperation; // how mixed with image
    colA: IRGB;
    colB: IRGB;
}

const presetArr: INoisePreset[] = [
    // each pixel random value
    {type: 0, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, octaves: 1, samples: 1, peaks: 0, brightness: 0, contrast: 0, doInvert: true},

    // cloud
    {type: 1, scaleX: 166, scaleY: 164, offsetX: 105, offsetY: 30, octaves: 6, samples: 1, peaks: 0, brightness: 0.055, contrast: 0.23, doInvert: true},

    // thin lines
    {type: 1, scaleX: 235, scaleY: 190, offsetX: 3227, offsetY: 2156, octaves: 4, samples: 16, peaks: 22, brightness: -0.375, contrast: 1, doInvert: false},

    // soft large simplex, only 1 octave
    {type: 1, scaleX: 40, scaleY: 40, offsetX: 0, offsetY: 0, octaves: 1, samples: 1, peaks: 0, brightness: 0, contrast: 0, doInvert: false},

    // two value large pixels
    {type: 0, scaleX: 26, scaleY: 26, offsetX: 557, offsetY: 365, octaves: 1, samples: 1, peaks: 0, brightness: 0.02, contrast: 1, doInvert: true},

    // zebra
    {type: 1, scaleX: 1500, scaleY: 1500, offsetX: 745, offsetY: 2871, octaves: 5, samples: 16, peaks: 156.02, brightness: 0.03, contrast: 1, doInvert: true},

    // sparse dots / stars
    {type: 1, scaleX: 11, scaleY: 11, offsetX: 2940, offsetY: 2045, octaves: 1, samples: 16, peaks: 1, brightness: -0.045, contrast: 1, doInvert: true},

    // pseudo marble
    {type: 2, scaleX: 74, scaleY: 74, offsetX: 4816, offsetY: 1304, octaves: 3, samples: 1, peaks: 2.78, brightness: 0, contrast: 0, doInvert: false},
];

function drawNoise(glCanvas, settings: INoiseSettings): void {
    glCanvas.noise(
        settings.seed  ? settings.seed : 0,
        settings.type,
        [settings.scaleX, settings.scaleY],
        [glCanvas.width / 2, glCanvas.height / 2],
        settings.octaves,
        settings.samples,
        settings.peaks,
        settings.brightness,
        settings.contrast,
        settings.doInvert,
        settings.colA,
        settings.colB,
        settings.channels ? settings.channels : 'rgb',
    ).update();
}


export const filterNoise = {

    getDialog(params: IFilterGetDialogParam) {
        let context = params.context;
        let klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        let layers = klCanvas.getLayers();
        let selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        let fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        let w = parseInt('' + fit.width), h = parseInt('' + fit.height);
        const renderW = Math.min(w, context.canvas.width);
        const renderH = Math.min(h, context.canvas.height);
        const renderFactor = renderW / context.canvas.width;


        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return; // todo throw?
        }
        let texture;

        const thumbImgArr = [];
        const thumbSize = 32;
        {
            const canvas = BB.canvas(thumbSize, thumbSize);
            const ctx = canvas.getContext('2d');
            texture = glCanvas.texture(canvas);
            glCanvas.draw(texture).update(); // update glCanvas size
            texture.destroy();

            presetArr.forEach((preset, index) => {
                const thumbImg = new Image();
                const presetCopy = BB.copyObj(preset);
                presetCopy.scaleX /= 10;
                presetCopy.scaleY /= 10;
                drawNoise(glCanvas, presetCopy);
                ctx.drawImage(glCanvas, 0, 0);
                thumbImg.src = canvas.toDataURL('image/png');
                thumbImgArr.push(thumbImg);
            });

        }

        let tempCanvas = BB.canvas(renderW, renderH);
        texture = glCanvas.texture(tempCanvas);
        glCanvas.draw(texture).update(); // update glCanvas size
        tempCanvas = null;

        let div = document.createElement("div");
        let result: any = {
            element: div
        };

        div.innerHTML = LANG('filter-noise-description') + "<br/><br/>";

        const settingsObj: INoiseFilterInput = {
            seed: Math.random() * 300,
            presetIndex: 0,
            scale: 50,
            opacity: 0.5,
            doInvert: false,
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
                })
                return {
                    id: '' + index,
                    label: img,
                };
            }),
            initialId: '0',
            onChange: (id) => {
                settingsObj.presetIndex = Number(id);
                updatePreview();
            }
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
        scaleSlider.getElement().style.marginBottom = "10px";

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
        opacitySlider.getElement().style.marginBottom = "10px";

        const row1El = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
            }
        });

        const row2El = BB.el({
            css: {
                display: 'flex',
            }
        });

        const channelsOptions = new Options({
            optionArr: [
                {id: 'rgb', label: 'RGB'},
                {id: 'alpha', label: LANG('filter-noise-alpha')},
            ],
            initialId: 'rgb',
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

        const invertedToggle = new Checkbox({
            label: LANG('filter-noise-inverted'),
            callback: (val) => {
                settingsObj.doInvert = val;
                updatePreview();
            },
            allowTab: true,
        });

        const blendSelect = new Select({
            isFocusable: true,
            optionArr: [
                'source-over',
                null,
                'darken',
                'multiply',
                'color-burn',
                null,
                'lighten',
                'screen',
                'color-dodge',
                null,
                'overlay',
                'soft-light',
                'hard-light',
                null,
                'difference',
                'exclusion',
                null,
                'hue',
                'saturation',
                'color',
                'luminosity',
            ].map((item: IMixMode) => {
                return item ? [item, translateBlending(item)] : null;
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
            }
        });

        const colInputStyle = {
            width: '34px',
            height: '34px',
            marginRight: '5px',
        }
        const colAInput = KL.input({
            type: 'color',
            init: '#' + ColorConverter.toHexString(settingsObj.colA),
            callback: (val) => {
                settingsObj.colA = ColorConverter.hexToRGB(val);
                updatePreview();
            },
            css: colInputStyle,
        });

        const colBInput = KL.input({
            type: 'color',
            init: '#' + ColorConverter.toHexString(settingsObj.colB),
            callback: (val) => {
                settingsObj.colB = ColorConverter.hexToRGB(val);
                updatePreview();
            },
            css: colInputStyle,
        });

        colorWrapper.append(
            colAInput,
            colBInput,
        );


        row1El.append(
            channelsOptions.getElement(),
            BB.el({css:{flexGrow: '1',}}),
            invertedToggle.getElement(),
        );

        row2El.append(
            blendSelect.getElement(),
            BB.el({css:{flexGrow: '1',}}),
            colorWrapper,
        );

        div.append(
            scaleSlider.getElement(),
            opacitySlider.getElement(),
            row1El,
            row2El,
        );



        let previewWrapper = document.createElement("div");
        BB.css(previewWrapper, {
            width: "340px",
            marginLeft: "-20px",
            height: "220px",
            backgroundColor: "#9e9e9e",
            marginTop: "10px",
            boxShadow: "rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset",
            overflow: "hidden",
            position: "relative",
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            colorScheme: 'only light',
        });

        let previewLayer: IKlBasicLayer = {
            image: BB.canvas(renderW, renderH),
            opacity: layers[selectedLayerIndex].opacity,
            mixModeStr: layers[selectedLayerIndex].mixModeStr,
        };
        let klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: layers.map((item, i) => {
                if (i === selectedLayerIndex) {
                    return previewLayer;
                } else {
                    return {
                        image: item.context.canvas,
                        opacity: item.opacity,
                        mixModeStr: item.mixModeStr,
                    };
                }
            })
        });

        let previewInnerWrapper = BB.el({
            css: {
                position: 'relative',
                boxShadow: '0 0 5px rgba(0,0,0,0.5)',
                width: parseInt('' + w) + 'px',
                height: parseInt('' + h) + 'px'
            }
        });
        previewInnerWrapper.appendChild(klCanvasPreview.getElement());
        previewWrapper.appendChild(previewInnerWrapper);

        function updatePreview() {
            let ctx = (previewLayer.image as HTMLCanvasElement).getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, renderW, renderH);
            ctx.drawImage(context.canvas, 0, 0, renderW, renderH);

            ctx.globalAlpha = settingsObj.opacity;

            const presetCopy = BB.copyObj(presetArr[settingsObj.presetIndex]);
            presetCopy.seed = settingsObj.seed;
            presetCopy.scaleX = presetCopy.scaleX  * settingsObj.scale / 50 * renderFactor;
            presetCopy.scaleY = presetCopy.scaleY  * settingsObj.scale / 50 * renderFactor;
            presetCopy.colA = settingsObj.colA;
            presetCopy.colB = settingsObj.colB;
            presetCopy.doInvert = settingsObj.doInvert ? !presetCopy.doInvert : presetCopy.doInvert;
            presetCopy.channels  = settingsObj.channels;
            drawNoise(glCanvas, presetCopy);

            if (settingsObj.channels === 'alpha') {
                ctx.globalCompositeOperation = 'destination-out';
            } else {
                ctx.globalCompositeOperation = settingsObj.mixModeStr;
            }

            ctx.drawImage(glCanvas, 0, 0);

            ctx.restore();
            klCanvasPreview.render();
        }
        setTimeout(updatePreview, 0);

        div.appendChild(previewWrapper);
        result.destroy = () => {
            presetOptions.destroy();
            scaleSlider.destroy();
            opacitySlider.destroy();
            invertedToggle.destroy();
            channelsOptions.destroy();
            texture.destroy();
            blendSelect.destroy();
        };
        result.getInput = function () {
            result.destroy();
            return BB.copyObj(settingsObj);
        };

        return result;
    },

    apply(params: IFilterApply) {
        let context = params.context;
        let klCanvas = params.klCanvas;
        let history = params.history;
        if (!context || !klCanvas || !history) {
            return false;
        }

        history.pause(true);

        let glCanvas = getSharedFx();
        if (!glCanvas) {
            return false; // todo more specific error?
        }
        let texture = glCanvas.texture(context.canvas);
        glCanvas.draw(texture).update();
        texture.destroy();

        const input: INoiseFilterInput = params.input;

        const presetCopy = BB.copyObj(presetArr[input.presetIndex]);
        presetCopy.seed = input.seed;
        presetCopy.scaleX = presetCopy.scaleX  * input.scale / 50;
        presetCopy.scaleY = presetCopy.scaleY  * input.scale / 50;
        presetCopy.colA = input.colA;
        presetCopy.colB = input.colB;
        presetCopy.doInvert = input.doInvert ? !presetCopy.doInvert : presetCopy.doInvert;
        presetCopy.channels  = input.channels;
        drawNoise(glCanvas, presetCopy);

        context.save();
        context.globalAlpha = input.opacity;
        if (input.channels === 'alpha') {
            context.globalCompositeOperation = 'destination-out';
        } else {
            context.globalCompositeOperation = input.mixModeStr;
        }
        context.drawImage(glCanvas, 0, 0);
        context.restore();

        history.pause(false);

        history.push({
            tool: ["canvas"],
            action: "replaceLayer",
            params: [
                klCanvas.getLayerIndex(context.canvas),
                context.getImageData(0, 0, context.canvas.width, context.canvas.height),
            ]
        });
        return true;
    },

};