import {BB} from '../../bb/bb';
import {brushes} from '../brushes/brushes';
import {eventResMs} from './brushes-consts';
import {klHistory} from '../history/kl-history';
import {Checkbox} from '../ui/base-components/checkbox';
import {KlSlider} from '../ui/base-components/kl-slider';
import {penPressureToggle} from '../ui/base-components/pen-pressure-toggle';
// @ts-ignore
import brushIconImg from 'url:~/src/app/img/ui/brush-smudge.svg';
import {IBrushUi} from '../kl.types';
import {LANG, languageStrings} from '../../language/language';

export const smudgeBrushUi = (function () {
    let brushInterface: IBrushUi = {
        image: brushIconImg,
        tooltip: LANG('brush-smudge'),
        sizeSlider: {
            min: 0.5,
            max: 100,
            curve: BB.quadraticSplineInput(0.5, 100, 0.1)
        },
        opacitySlider: {
            min: 0,
            max: 1,
            curve: [[0, 1 / 100], [0.5, 0.3], [1, 1]]
        },
        Ui: null,
    };

    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-smudge');
    });

    brushInterface.Ui = function (p) {
        let div = document.createElement("div"); // the gui
        let brush = new brushes.SmudgeBrush();
        brush.setHistory(klHistory);
        p.onSizeChange(brush.getSize());
        let sizeSlider;
        let opacitySlider;

        let lockAlphaToggle = new Checkbox({
            init: brush.getLockAlpha(),
            label: LANG('brush-lock-alpha'),
            callback: function (b) {
                brush.setLockAlpha(b);
            },
            doHighlight: true,
            title: LANG('brush-lock-alpha-title'),
        });

        let spacingSpline = new BB.SplineInterpolator([[0, 15], [8, 7], [14, 4], [30, 3], [50, 2.7], [100, 2]]);

        function setSize(size) {
            brush.setSize(size);
            brush.setSpacing(Math.max(2, spacingSpline.interpolate(size)) / 15);
        }

        function init() {
            sizeSlider = new KlSlider({
                label: LANG('brush-size'),
                width: 225,
                height: 30,
                min: brushInterface.sizeSlider.min,
                max: brushInterface.sizeSlider.max,
                initValue: brush.getSize(),
                eventResMs: eventResMs,
                onChange: function (val) {
                    setSize(val);
                    p.onSizeChange(val);
                },
                curve: brushInterface.sizeSlider.curve,
                formatFunc: function (v) {
                    v *= 2;
                    if (v < 10) {
                        return Math.round(v * 10) / 10;
                    } else {
                        return Math.round(v);
                    }
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
                curve: brushInterface.opacitySlider.curve,
                formatFunc: function(v) {
                    return Math.round(v * 100);
                }
            });

            let pressureSizeToggle = penPressureToggle(false, function (b) {
                brush.sizePressure(b);
            });
            let pressureOpacityToggle = penPressureToggle(false, function (b) {
                brush.opacityPressure(b);
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
                })
            );

            let bottomRow = BB.el({
                parent: div,
                css: {
                    marginTop: '10px',
                }
            });
            bottomRow.append(lockAlphaToggle.getElement());

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
        this.goLine = function (x, y, p) {
            brush.goLine(x, y, p);
        };
        this.endLine = function (x, y) {
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