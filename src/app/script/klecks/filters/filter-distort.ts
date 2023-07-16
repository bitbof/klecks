import {BB} from '../../bb/bb';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer} from '../kl-types';
import {KlSlider} from '../ui/components/kl-slider';
import {LANG} from '../../language/language';
import {eventResMs} from './filters-consts';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {Options} from '../ui/components/options';
import {Checkbox} from '../ui/components/checkbox';
import {TFilterHistoryEntry} from './filters';
import {throwIfNull} from '../../bb/base/base';
import {TFilterDistortSettings} from '../../fx-canvas/filters/distort';


// see fx-canvas distort
export type TFilterDistortInput = {
    stepSize: number; // [0, inf]
    distortType: 0 | 1 | 2;
    scale: { x: number; y: number };
    strength: { x: number; y: number };
    phase: { x: number; y: number };
};

export type TFilterDistortHistoryEntry = TFilterHistoryEntry<
    'distort',
    TFilterDistortInput>;

export const filterDistort = {

    getDialog (params: IFilterGetDialogParam) {

        const isSmall = window.innerWidth < 550;
        const rootEl = BB.el({
            content: LANG('filter-distort-description') + '<br><br>',
        });
        const context = params.context;

        let isSynced = true;
        const settings: TFilterDistortInput = {
            distortType: 0,
            scale: {x: 100, y: 100},
            strength: {x: 20, y: 20},
            phase: {x: 0, y: 0},
            stepSize: 1,
        };
        // let lastDrawnSettings = null;

        // ---- thumb -------
        const thumbImgArr: HTMLImageElement[] = [];
        const thumbSize = 32;
        {
            const canvas = BB.canvas(thumbSize, thumbSize);
            const ctx = BB.ctx(canvas);

            ctx.beginPath();
            ctx.arc(thumbSize / 2, thumbSize / 2, thumbSize / 2.5, 0, Math.PI * 2);
            ctx.fill();

            let gradient = ctx.createLinearGradient(0, 0, thumbSize, thumbSize);
            gradient.addColorStop(0, '#00f');
            gradient.addColorStop(0.5, '#f00');
            gradient.addColorStop(1, '#fff');
            ctx.fillStyle = gradient;
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillRect(0, 0, thumbSize, thumbSize);

            gradient = ctx.createLinearGradient(thumbSize, 0, 0, thumbSize);
            gradient.addColorStop(0, '#000');
            gradient.addColorStop(1, '#000');
            ctx.fillStyle = gradient;
            ctx.globalCompositeOperation = 'destination-atop';
            ctx.fillRect(0, 0, thumbSize, thumbSize);

            const fxCanvas = throwIfNull(getSharedFx());
            const texture = fxCanvas.texture(canvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size

            const scaleFactor = 20;

            ([0, 1, 2] as const).forEach(item => {
                const thumbImg = new Image();
                const settingsCopy: TFilterDistortSettings = BB.copyObj(settings);
                settingsCopy.distortType = item;
                settingsCopy.scale.x /= scaleFactor;
                settingsCopy.scale.y /= scaleFactor;
                settingsCopy.strength.x /= scaleFactor;
                settingsCopy.strength.y /= scaleFactor;
                fxCanvas.draw(texture).multiplyAlpha().distort(settingsCopy).unmultiplyAlpha().update();
                ctx.clearRect(0, 0, thumbSize, thumbSize);
                ctx.drawImage(fxCanvas, 0, 0);
                thumbImg.src = canvas.toDataURL('image/png');
                thumbImgArr.push(thumbImg);
            });

            texture.destroy();
        }


        // ---- controls ----

        const topRowEl = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
            },
        });

        const typeOptions = new Options({
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
                settings.distortType = Number(id) as TFilterDistortSettings['distortType'];
                updatePreview();
            },
        });

        function sync (from: 'x' | 'y') {
            if (from === 'x') {
                settings.scale.y = (settings.scale.x);
                settings.strength.y = (settings.strength.x);
                settings.phase.y = (settings.phase.x);

                sliderArr[3].setValue(settings.scale.y);
                sliderArr[4].setValue(settings.strength.y);
                sliderArr[5].setValue(settings.phase.y);
            } else {
                settings.scale.x = (settings.scale.y);
                settings.strength.x = (settings.strength.y);
                settings.phase.x = (settings.phase.y);

                sliderArr[0].setValue(settings.scale.x);
                sliderArr[1].setValue(settings.strength.x);
                sliderArr[2].setValue(settings.phase.x);
            }
            updatePreview();
        }

        const syncToggle = new Checkbox({
            init: true,
            label: LANG('filter-distort-sync-xy'),
            callback: (val) => {
                isSynced = val;
                if (isSynced) {
                    sync('x');
                }
            },
        });

        topRowEl.append(
            typeOptions.getElement(),
            BB.el({css: {flexGrow: '1'}}),
            syncToggle.getElement(),
        );

        const xyRowEl = BB.el({
            parent: rootEl,
            css: {
                display: 'flex',
                flexWrap: 'wrap',
            },
        });
        const leftCol = BB.el({
            parent: xyRowEl,
            css: {
                marginRight: '10px',
            },
        });
        const rightCol = BB.el({parent: xyRowEl});

        const sliderWidth = isSmall ? 300 : 245;
        const sliderArr: KlSlider[] = [];

        (['x', 'y'] as const).forEach((item, index) => {
            const targetEl = index === 0 ? leftCol : rightCol;

            const scaleSlider = new KlSlider({
                label: LANG('filter-noise-scale') + ' ' + item.toUpperCase(),
                width: sliderWidth,
                height: 30,
                min: 1,
                max: 1000,
                curve: 'quadratic',
                value: settings.scale[item],
                eventResMs: eventResMs,
                onChange: (val) => {
                    settings.scale[item] = val;
                    if (isSynced) {
                        sync(item);
                    } else {
                        updatePreview();
                    }
                },
            });
            scaleSlider.getElement().style.marginTop = '20px';
            targetEl.append(scaleSlider.getElement());

            const strengthSlider = new KlSlider({
                label: LANG('filter-unsharp-mask-strength') + ' ' + item.toUpperCase(),
                width: sliderWidth,
                height: 30,
                min: 0,
                max: 200,
                curve: 'quadratic',
                value: settings.strength[item],
                eventResMs: eventResMs,
                onChange: (val) => {
                    settings.strength[item] = val;
                    if (isSynced) {
                        sync(item);
                    } else {
                        updatePreview();
                    }
                },
            });
            strengthSlider.getElement().style.marginTop = '10px';
            targetEl.append(strengthSlider.getElement());

            const phaseSlider = new KlSlider({
                label: LANG('filter-distort-phase') + ' ' + item.toUpperCase(),
                width: sliderWidth,
                height: 30,
                min: 0,
                max: 1,
                value: settings.phase[item],
                manualInputRoundDigits: 2,
                eventResMs: eventResMs,
                formatFunc: (val) => BB.round(val, 2),
                onChange: (val) => {
                    settings.phase[item] = val;
                    if (isSynced) {
                        sync(item);
                    } else {
                        updatePreview();
                    }
                },
            });
            phaseSlider.getElement().style.marginTop = '10px';
            targetEl.append(phaseSlider.getElement());

            sliderArr.push(scaleSlider);
            sliderArr.push(strengthSlider);
            sliderArr.push(phaseSlider);
        });

        const stepSlider = new KlSlider({
            label: LANG('filter-distort-stepsize'),
            width: 300,
            height: 30,
            min: 1,
            max: 300,
            curve: 'quadratic',
            value: settings.stepSize,
            eventResMs: eventResMs,
            onChange: (val) => {
                settings.stepSize = Math.round(val);
                updatePreview();
            },
        });

        stepSlider.getElement().style.marginTop = '20px';
        rootEl.append(stepSlider.getElement());


        // ---- preview ----

        const klCanvas = params.klCanvas;
        const layers = klCanvas.getLayers();
        const selectedLayerIndex = throwIfNull(klCanvas.getLayerIndex(context.canvas));

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, isSmall ? 280 : 490, isSmall ? 200 : 240, 1);
        const w = parseInt('' + fit.width), h = parseInt('' + fit.height);
        // const renderW = Math.min(w, context.canvas.width);
        // const renderH = Math.min(h, context.canvas.height);
        // const renderFactor = renderW / context.canvas.width;
        // const previewFactor = w / context.canvas.width;

        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: isSmall ? '340px' : '540px',
                height: isSmall ? '260px' : '300px',
            },
        });

        const fxCanvas = throwIfNull(getSharedFx());
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).update(); // update fxCanvas size

        const previewLayer: IKlBasicLayer = {
            image: fxCanvas,
            opacity: layers[selectedLayerIndex].opacity,
            mixModeStr: layers[selectedLayerIndex].mixModeStr,
        };
        const previewLayerArr = layers.map((item, i) => {
            if (i === selectedLayerIndex) {
                return previewLayer;
            } else {
                return {
                    image: item.context.canvas,
                    opacity: item.opacity,
                    mixModeStr: item.mixModeStr,
                };
            }
        });
        const klCanvasPreview = new KlCanvasPreview({
            width: Math.round(w),
            height: Math.round(h),
            layers: previewLayerArr,
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
        rootEl.append(previewWrapper);

        // ---------- rendering ---------------------

        function updatePreview (): void {
            fxCanvas.draw(texture).multiplyAlpha().distort(settings).unmultiplyAlpha().update();
            klCanvasPreview.render();
        }

        updatePreview();


        const destroy = () => {
            typeOptions.destroy();
            sliderArr.forEach(item => item.destroy());
            stepSlider.destroy();
            syncToggle.destroy();
            texture.destroy();
            klCanvasPreview.destroy();
        };

        // ----- result -------------------
        const result: IFilterGetDialogResult<TFilterDistortInput> = {
            element: rootEl,
            destroy,
            getInput: () => {
                destroy();
                return BB.copyObj(settings);
            },
        };
        if (!isSmall) {
            result.width = 500;
        }
        return result;
    },

    apply (params: IFilterApply<TFilterDistortInput>): boolean {
        const klCanvas = params.klCanvas;
        const context = params.context;
        const history = params.history;
        if (!klCanvas || !history) {
            return false;
        }
        history.pause(true);

        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).multiplyAlpha().distort(params.input).unmultiplyAlpha().update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();

        history.pause(false);
        history.push({
            tool: ['filter', 'distort'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterDistortHistoryEntry);
        return true;
    },

};