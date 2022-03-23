import {BB} from '../../bb/bb';
import {brushes} from '../brushes/brushes';
import {eventResMs} from './brushes-consts';
import {klHistory} from '../history/kl-history';
import {Checkbox} from '../ui/base-components/checkbox';
import {KlSlider} from '../ui/base-components/kl-slider';
import {penPressureToggle} from '../ui/base-components/pen-pressure-toggle';
// @ts-ignore
import brushIconImg from 'url:~/src/app/img/ui/brush-pen.svg';
import {genBrushAlpha01, genBrushAlpha02} from '../brushes/alphas/brush-alphas';
import {IBrushUi} from '../kl.types';
import {LANG, languageStrings} from '../../language/language';

export const penBrushUi = (function () {
    let brushInterface: IBrushUi = {
        image: brushIconImg,
        tooltip: LANG('brush-pen'),
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

    let alphaNames = [
        LANG('brush-pen-circle'),
        LANG('brush-pen-chalk'),
        LANG('brush-pen-calligraphy'),
        LANG('brush-pen-square'),
    ];
    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-pen');
        alphaNames = [
            LANG('brush-pen-circle'),
            LANG('brush-pen-chalk'),
            LANG('brush-pen-calligraphy'),
            LANG('brush-pen-square'),
        ];
    });

    brushInterface.Ui = function (p) {
        let div = document.createElement("div"); // the gui
        let brush = new brushes.PenBrush();
        brush.setHistory(klHistory);
        p.onSizeChange(brush.getSize());
        let sizeSlider;
        let opacitySlider;

        let alphas = [];
        let currentAlpha = 0;
        for (let i = 0; i < 4; i++) {
            (function (i) {
                let alpha = BB.el({
                    title: alphaNames[i],
                    onClick: () => {
                        alphaClick(i);
                    }
                });
                let canvas = BB.canvas(70, 70);
                let ctx = canvas.getContext('2d');
                if (i === 0 || i === 3) {
                    if (i === 0) {
                        ctx.beginPath();
                        ctx.arc(35, 35, 30, 0, 2 * Math.PI);
                        ctx.closePath();
                        ctx.fill();
                    } else {
                        ctx.fillRect(5, 5, 60, 60);
                    }
                } else if (i === 1) {
                    ctx.drawImage(genBrushAlpha01(60), 5, 5);
                } else if (i === 2) {
                    ctx.drawImage(genBrushAlpha02(60), 5, 5);
                }
                alpha.style.backgroundImage = 'url(' + canvas.toDataURL('image/png') + ')';

                alphas.push(alpha);
            }(i));
        }

        function updateAlphas() {
            for (let i = 0; i < alphas.length; i++) {
                if (i === currentAlpha) {
                    alphas[i].className = 'brush-alpha-selected';
                } else {
                    alphas[i].className = 'brush-alpha';
                }
            }
        }

        updateAlphas();

        function alphaClick(id) {
            currentAlpha = id;
            brush.setAlpha(id);
            updateAlphas();
        }

        let lockAlphaToggle = new Checkbox({
            init: brush.getLockAlpha(),
            label: LANG('brush-lock-alpha'),
            callback: function (b) {
                brush.setLockAlpha(b);
            },
            doHighlight: true,
            title: LANG('brush-lock-alpha-title'),
            css: {
                cssFloat: 'right',
                textAlign: 'right',
            }
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
                initValue: brushInterface.opacitySlider.max,
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

            let pressureSizeToggle = penPressureToggle(true, function (b) {
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

            let alphaWrapper = document.createElement("div");
            for (let i = 0; i < alphas.length; i++) {
                alphaWrapper.appendChild(alphas[i]);
            }
            alphaWrapper.style.marginTop = "10px";
            div.appendChild(alphaWrapper);
            alphaWrapper.appendChild(lockAlphaToggle.getElement());

        }

        init();

        this.increaseSize = function (f) {
            if (!brush.isDrawing()) {
                sizeSlider.increaseValue(f);
            }
        };
        this.decreaseSize = function (f) {
            if (!brush.isDrawing()) {
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
            brush.endLine(x, y);
        };
        this.getBrush = function () {
            return brush;
        };
        this.isDrawing = function () {
            return brush.isDrawing();
        };
        this.getElement = function () {
            return div;
        };
    };
    return brushInterface;
})();