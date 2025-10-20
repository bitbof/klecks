import { BB } from '../../bb/bb';
import { createPenPressureToggle } from '../ui/components/create-pen-pressure-toggle';
import { EVENT_RES_MS } from './brushes-consts';
import { Checkbox } from '../ui/components/checkbox';
import { BRUSHES } from '../brushes/brushes';
import { KlSlider } from '../ui/components/kl-slider';
import brushIconImg from 'url:/src/app/img/ui/brush-blend.svg';
import { TBrushUi } from '../kl-types';
import { LANG, LANGUAGE_STRINGS } from '../../language/language';
import { BlendBrush, TBlendBrushConfig } from '../brushes/blend-brush';

export const blendBrushUi = (function () {
    const brushInterface = {
        image: brushIconImg,
        tooltip: LANG('brush-blend'),
        sizeSlider: {
            min: 0.5,
            max: 100,
            curve: BB.powerSplineInput(0.5, 100, 0.1),
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1,
        },
    } as TBrushUi<BlendBrush>;

    LANGUAGE_STRINGS.subscribe(() => {
        brushInterface.tooltip = LANG('brush-blend');
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement('div'); // the gui
        const brush = new BRUSHES.BlendBrush();
        brush.setHistory(p.klHistory);
        p.onSizeChange(brush.getSize());

        let sizeSlider: KlSlider;
        let opacitySlider: KlSlider;
        let blendingSlider: KlSlider;
        let pressureSizeToggle: HTMLElement;
        let pressureOpacityToggle: HTMLElement;
        let lockAlphaToggle: Checkbox;

        function setSize(size: number): void {
            brush.setSize(size);
        }

        function init() {
            sizeSlider = new KlSlider({
                label: LANG('brush-size'),
                width: 225,
                height: 30,
                min: brushInterface.sizeSlider.min,
                max: brushInterface.sizeSlider.max,
                value: 58,
                curve: brushInterface.sizeSlider.curve,
                eventResMs: EVENT_RES_MS,
                toDisplayValue: (val) => val * 2,
                toValue: (displayValue) => displayValue / 2,
                onChange: (val) => {
                    setSize(val);
                    p.onSizeChange(val);
                },
            });
            opacitySlider = new KlSlider({
                label: LANG('opacity'),
                width: 225,
                height: 30,
                min: brushInterface.opacitySlider.min,
                max: brushInterface.opacitySlider.max,
                value: brush.getOpacity(),
                curve: brushInterface.opacitySlider.curve,
                eventResMs: EVENT_RES_MS,
                toDisplayValue: (val) => val * 100,
                toValue: (displayValue) => displayValue / 100,
                onChange: (val) => {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
            });
            blendingSlider = new KlSlider({
                label: LANG('brush-blending'),
                width: 225,
                height: 30,
                min: 0,
                max: 1,
                value: brush.getBlending(),
                eventResMs: EVENT_RES_MS,
                toDisplayValue: (val) => val * 100,
                toValue: (displayValue) => displayValue / 100,
                onChange: function (val) {
                    brush.setBlending(val);
                },
            });
            blendingSlider.getElement().style.marginTop = '10px';

            pressureSizeToggle = createPenPressureToggle(true, function (b) {
                brush.setSizePressure(b);
            });
            pressureOpacityToggle = createPenPressureToggle(false, function (b) {
                brush.setOpacityPressure(b);
            });

            lockAlphaToggle = new Checkbox({
                init: brush.getLockAlpha(),
                label: LANG('lock-alpha'),
                callback: function (b) {
                    brush.setLockAlpha(b);
                },
                doHighlight: true,
                title: LANG('lock-alpha-title'),
                css: {
                    marginTop: '10px',
                    display: 'inline-block',
                },
                name: 'lock-alpha',
            });

            div.append(
                BB.el({
                    content: [sizeSlider.getElement(), pressureSizeToggle],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                    },
                }),
                BB.el({
                    content: [opacitySlider.getElement(), pressureOpacityToggle],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    },
                }),
                blendingSlider.getElement(),
                lockAlphaToggle.getElement(),
            );
        }

        init();

        this.increaseSize = function (f) {
            if (!brush.getIsDrawing()) {
                sizeSlider.changeSliderValue(f);
            }
        };
        this.decreaseSize = function (f) {
            if (!brush.getIsDrawing()) {
                sizeSlider.changeSliderValue(-f);
            }
        };

        this.getSize = function () {
            return brush.getSize();
        };
        this.setSize = function (size) {
            setSize(size);
            sizeSlider.setValue(size);
        };
        this.getOpacity = function () {
            return brush.getOpacity();
        };
        this.setOpacity = function (opacity) {
            brush.setOpacity(opacity);
            opacitySlider.setValue(opacity);
        };

        this.setColor = function (c) {
            brush.setColor(c);
        };
        this.setLayer = function (layer) {
            brush.setContext(layer.context, layer.id);
        };
        this.startLine = function (x, y, p) {
            brush.startLine(x, y, p);
        };
        this.goLine = function (x, y, p, isCoalesced) {
            brush.goLine(x, y, p, false); // looks weird with isCoalesced
        };
        this.endLine = function () {
            brush.endLine();
        };
        this.getBrush = function () {
            return brush;
        };
        this.isDrawing = function () {
            return brush.getIsDrawing();
        };
        this.getElement = function () {
            return div;
        };
        this.getBrushConfig = function () {
            return brush.getBrushConfig();
        };
        this.setBrushConfig = function (config: TBlendBrushConfig) {
            brush.setBrushConfig(config);

            // Update UI components to match brush state
            if (config.size !== undefined) {
                sizeSlider.setValue(config.size);
            }
            if (config.opacity !== undefined) {
                opacitySlider.setValue(config.opacity);
            }
            if (config.blending !== undefined) {
                blendingSlider.setValue(config.blending);
            }
            if (config.lockLayerAlpha !== undefined) {
                lockAlphaToggle.setValue(config.lockLayerAlpha);
            }
            // TODO: sizePressure, opacityPressure
            // Above variable is of type `HTMLElement` and should be of type `BoxToggle`
        };
    } as TBrushUi<BlendBrush>['Ui'];

    return brushInterface;
})();
