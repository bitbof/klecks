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
                initValue: 58 / 2,
                eventResMs: eventResMs,
                onChange: function (val) {
                    setSize(val);
                    p.onSizeChange(val);
                },
                curve: brushInterface.sizeSlider.curve,
                formatFunc: function (v) {
                    v *= 2;
                    return Math.round(v);
                }
            });
            opacitySlider = new KlSlider({
                label: LANG('opacity'),
                width: 225,
                height: 30,
                min: brushInterface.opacitySlider.min,
                max: brushInterface.opacitySlider.max,
                initValue: brush.getOpacity(),
                eventResMs: eventResMs,
                onChange: function (val) {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
                formatFunc: function(v) {
                    return Math.round(v * 100);
                }
            });
            let blendingSlider = new KlSlider({
                label: LANG('brush-blending'),
                width: 225,
                height: 30,
                min: 0,
                max: 100,
                initValue: brush.getBlending() * 100,
                eventResMs: eventResMs,
                onChange: function (val) {
                    brush.setBlending(val / 100);
                }
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
                label: LANG('brush-lock-alpha'),
                callback: function (b) {
                    brush.setLockAlpha(b);
                },
                doHighlight: true,
                title: LANG('brush-lock-alpha-title'),
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
                sizeSlider.increaseValue(f);
            }
        };
        this.decreaseSize = function (f) {
            if (!brush.getIsDrawing()) {
                sizeSlider.decreaseValue(f);
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