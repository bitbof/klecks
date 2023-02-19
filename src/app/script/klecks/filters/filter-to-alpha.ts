import {BB} from '../../bb/bb';
import {Options} from '../ui/components/options';
import {ColorOptions} from '../ui/components/color-options';
import {KlCanvasPreview} from '../canvas-ui/canvas-preview';
import {getSharedFx} from '../../fx-canvas/shared-fx';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult, IKlBasicLayer, IRGBA} from '../kl-types';
import {LANG} from '../../language/language';
import {TFilterHistoryEntry} from './filters';

export type TFilterToAlphaInput = {
    sourceId: string;
    selectedRgbaObj: IRGBA;
};

export type TFilterToAlphaHistoryEntry = TFilterHistoryEntry<
    'toAlpha',
    TFilterToAlphaInput>;

export const filterToAlpha = {

    getDialog (params: IFilterGetDialogParam) {
        const context = params.context;
        const klCanvas = params.klCanvas;
        if (!context || !klCanvas) {
            return false;
        }

        const layers = klCanvas.getLayers();
        const selectedLayerIndex = klCanvas.getLayerIndex(context.canvas);

        const fit = BB.fitInto(context.canvas.width, context.canvas.height, 280, 200, 1);
        const w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        const tempCanvas = BB.canvas(w, h);
        {
            const ctx = BB.ctx(tempCanvas);
            ctx.save();
            if (tempCanvas.width > context.canvas.width) {
                ctx.imageSmoothingEnabled = false;
            }
            ctx.drawImage(context.canvas, 0, 0, w, h);
            ctx.restore();
        }

        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterToAlphaInput> = {
            element: div,
        };

        function finishInit () {
            const radius = 2, strength = 5.1 / 10;
            div.append(BB.el({
                content: LANG('filter-to-alpha-description'),
                css: {
                    marginBottom: '5px',
                },
            }));

            const fxCanvas = getSharedFx();
            if (!fxCanvas) {
                return; // todo throw?
            }
            const texture = fxCanvas.texture(tempCanvas);
            fxCanvas.draw(texture).update(); // update fxCanvas size

            function updatePreview () {
                fxCanvas.draw(texture).toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj).update();
                klCanvasPreview.render();
            }

            // source
            let sourceId = 'inverted-luminance';
            const sourceOptions = new Options({
                optionArr: [
                    {
                        id: 'inverted-luminance',
                        label: LANG('filter-to-alpha-inverted-lum'),
                    },
                    {
                        id: 'luminance',
                        label: LANG('filter-to-alpha-lum'),
                    },
                ],
                initId: sourceId,
                onChange: function (id) {
                    sourceId = id;
                    updatePreview();
                },
            });
            div.append(sourceOptions.getElement());

            // color
            let selectedRgbaObj = {r: 0, g: 0, b: 0, a: 1};
            const colorOptionsArr = [
                null,
                {r: 0, g: 0, b: 0, a: 1},
                {r: 255, g: 255, b: 255, a: 1},
            ];
            colorOptionsArr.push({
                r: params.currentColorRgb.r,
                g: params.currentColorRgb.g,
                b: params.currentColorRgb.b,
                a: 1,
            });
            colorOptionsArr.push({
                r: params.secondaryColorRgb.r,
                g: params.secondaryColorRgb.g,
                b: params.secondaryColorRgb.b,
                a: 1,
            });

            const colorOptions = new ColorOptions({
                label: LANG('filter-to-alpha-replace'),
                colorArr: colorOptionsArr,
                initialIndex: 1,
                onChange: function (rgbaObj) {
                    selectedRgbaObj = rgbaObj;
                    updatePreview();
                },
            });
            colorOptions.getElement().style.marginTop = '10px';
            div.append(colorOptions.getElement());


            const previewWrapper = BB.el({
                className: 'kl-preview-wrapper',
                css: {
                    width: '340px',
                    height: '220px',
                },
            });

            const previewLayerArr: IKlBasicLayer[] = [];
            {
                for (let i = 0; i < layers.length; i++) {
                    previewLayerArr.push({
                        image: i === selectedLayerIndex ? fxCanvas : layers[i].context.canvas,
                        opacity: layers[i].opacity,
                        mixModeStr: layers[i].mixModeStr,
                    });
                }
            }
            const klCanvasPreview = new KlCanvasPreview({
                width: parseInt('' + w),
                height: parseInt('' + h),
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


            div.append(previewWrapper);

            setTimeout(function () { //ie has a problem otherwise...
                try {
                    updatePreview();
                } catch(e) {
                    (div as any).errorCallback(e);
                }
            }, 1);

            result.destroy = (): void => {
                texture.destroy();
                sourceOptions.destroy();
                klCanvasPreview.destroy();
            };
            result.getInput = function (): TFilterToAlphaInput {
                result.destroy();
                return {
                    sourceId: sourceId,
                    selectedRgbaObj: selectedRgbaObj,
                };
            };
        }

        setTimeout(finishInit, 1);

        return result;
    },


    apply (params: IFilterApply<TFilterToAlphaInput>): boolean {
        const context = params.context;
        const history = params.history;
        const sourceId = params.input.sourceId;
        const selectedRgbaObj = params.input.selectedRgbaObj;
        if (!context || !sourceId || !history) {
            return false;
        }
        history.pause(true);
        const fxCanvas = getSharedFx();
        if (!fxCanvas) {
            return false; // todo more specific error?
        }
        const texture = fxCanvas.texture(context.canvas);
        fxCanvas.draw(texture).toAlpha(sourceId === 'inverted-luminance', selectedRgbaObj).update();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(fxCanvas, 0, 0);
        texture.destroy();
        history.pause(false);
        history.push({
            tool: ['filter', 'toAlpha'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterToAlphaHistoryEntry);
        return true;
    },

};