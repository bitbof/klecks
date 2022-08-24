import {BB} from '../../bb/bb';
import {penPressureToggle} from '../ui/base-components/pen-pressure-toggle';
import {eventResMs} from './brushes-consts';
import {Checkbox} from '../ui/base-components/checkbox';
import {brushes} from '../brushes/brushes';
import {klHistory} from '../history/kl-history';
import {KlSlider} from '../ui/base-components/kl-slider';
// @ts-ignore
import brushIconImg from 'url:~/src/app/img/ui/brush-blend.svg';
import {IBrushUi} from '../kl.types';
import {LANG, languageStrings} from '../../language/language';

export const blendBrushUi = (function () {
    let brushInterface: IBrushUi = {
        image: brushIconImg,
        tooltip: LANG('brush-blend'),
        sizeSlider: {
            min: 0.5,
            max: 100,
            curve: BB.quadraticSplineInput(0.5, 100, 0.1)
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1
        },
        Ui: null,
    };

    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-blend');
    });

    brushInterface.Ui = function (p) {
        let div = document.createElement("div"); // the gui
        let brush = new brushes.BlendBrush();
        brush.setHistory(klHistory);
        p.onSizeChange(brush.getSize());

        let sizeSlider;
        let opacitySlider;

        function setSize(size) {
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
                eventResMs: eventResMs,
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
                eventResMs: eventResMs,
                toDisplayValue: (val) => val * 100,
                toValue: (displayValue) => displayValue / 100,
                onChange: (val) => {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
            });
            let blendingSlider = new KlSlider({
                label: LANG('brush-blending'),
                width: 225,
                height: 30,
                min: 0,
                max: 1,
                value: brush.getBlending(),
                eventResMs: eventResMs,
                toDisplayValue: (val) => val * 100,
                toValue: (displayValue) => displayValue / 100,
                onChange: function (val) {
                    brush.setBlending(val);
                },
            });
            blendingSlider.getElement().style.marginTop = "10px";

            let pressureSizeToggle = penPressureToggle(true, function (b) {
                brush.setSizePressure(b);
            });
            let pressureOpacityToggle = penPressureToggle(false, function (b) {
                brush.setOpacityPressure(b);
            });

            let lockAlphaToggle = new Checkbox({
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
                }
            });


            div.append(
                BB.el({
                    content: [
                        sizeSlider.getElement(),
                        pressureSizeToggle
                    ],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                    }
                }),
                BB.el({
                    content: [
                        opacitySlider.getElement(),
                        pressureOpacityToggle
                    ],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }
                }),
                blendingSlider.getElement(),
                lockAlphaToggle.getElement()
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
        this.setSize = function(size) {
            setSize(size);
            sizeSlider.setValue(size);
        };
        this.getOpacity = function () {
            return brush.getOpacity();
        };
        this.setOpacity = function(opacity) {
            brush.setOpacity(opacity);
            opacitySlider.setValue(opacity);
        };

        this.setColor = function (c) {
            brush.setColor(c);
        };
        this.setContext = function (c) {
            brush.setContext(c);
        };
        this.startLine = function (x, y, p) {
            brush.startLine(x, y, p);
        };
        this.goLine = function (x, y, p, isCoalesced) {
            brush.goLine(x, y, p, isCoalesced);
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
    };

    return brushInterface;
})();