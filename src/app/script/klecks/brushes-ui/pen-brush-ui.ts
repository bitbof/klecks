import { getIconSvg } from '../../icon/icon';
import { BB } from '../../bb/bb';
import { BRUSHES } from '../brushes/brushes';
import { EVENT_RES_MS } from './brushes-consts';
import { createLockAlphaToggle } from '../ui/components/create-brush-toggles';
import { KlSlider } from '../ui/components/kl-slider';
import { createPenPressureToggle } from '../ui/components/create-pen-pressure-toggle';
import { genBrushAlpha01, genBrushAlpha02 } from '../brushes/alphas/brush-alphas';
import { TBrushUi } from '../kl-types';
import { LANG, LANGUAGE_STRINGS } from '../../language/language';
import { Options } from '../ui/components/options';
import { PenBrush } from '../brushes/pen-brush';

export const penBrushUi = (function () {
    const brushInterface = {
        image: getIconSvg('brush-pen'),
        tooltip: LANG('brush-pen'),
        sizeSlider: {
            min: 0.5,
            max: 100,
            exponent: 2,
            displayScale: 2, // radius displayed as diameter
            decimals: 'adaptive',
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1,
            exponent: 1.7,
            displayScale: 100,
        },
    } as TBrushUi<PenBrush>;

    const scatterSliderConfig = {
        min: 0,
        max: 100,
        exponent: 2.5,
        decimals: 'adaptive' as const,
    };

    let alphaNames = [
        LANG('brush-pen-circle'),
        LANG('brush-pen-chalk'),
        LANG('brush-pen-calligraphy'),
        LANG('brush-pen-square'),
    ];
    LANGUAGE_STRINGS.subscribe(() => {
        brushInterface.tooltip = LANG('brush-pen');
        alphaNames = [
            LANG('brush-pen-circle'),
            LANG('brush-pen-chalk'),
            LANG('brush-pen-calligraphy'),
            LANG('brush-pen-square'),
        ];
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement('div'); // the gui
        const brush = new BRUSHES.PenBrush();
        brush.setHistory(p.klHistory);
        p.onSizeChange(brush.getSize());
        let sizeSlider: KlSlider;
        let opacitySlider: KlSlider;
        let scatterSlider: KlSlider;

        const alphaOptions = new Options({
            optionArr: [0, 1, 2, 3].map((id) => {
                const alpha = BB.el({
                    className: 'dark-invert',
                    css: {
                        width: 31,
                        height: 31,
                        backgroundSize: 'contain',
                        margin: 2,
                    },
                });
                const canvas = BB.canvas(70, 70);
                const ctx = BB.ctx(canvas);
                if (id === 0 || id === 3) {
                    if (id === 0) {
                        ctx.beginPath();
                        ctx.arc(35, 35, 30, 0, 2 * Math.PI);
                        ctx.closePath();
                        ctx.fill();
                    } else {
                        ctx.fillRect(5, 5, 60, 60);
                    }
                } else if (id === 1) {
                    ctx.drawImage(genBrushAlpha01(60), 5, 5);
                } else if (id === 2) {
                    ctx.drawImage(genBrushAlpha02(60), 5, 5);
                }
                alpha.style.backgroundImage = 'url(' + canvas.toDataURL('image/png') + ')';

                return {
                    id: id,
                    label: alpha,
                    title: alphaNames[id],
                };
            }),
            initId: 0,
            onChange: (id) => {
                brush.setAlpha(id);
            },
        });

        const lockAlphaToggle = createLockAlphaToggle(brush.getLockAlpha(), (b) => {
            brush.setLockAlpha(b);
        });

        const spacingSpline = new BB.SplineInterpolator([
            [0, 15],
            [8, 7],
            [14, 4],
            [30, 3],
            [50, 2.7],
            [100, 2],
        ]);

        function setSize(size: number) {
            brush.setSize(size);
            brush.setSpacing(Math.max(2, spacingSpline.interpolate(size)) / 15);
        }

        function init() {
            sizeSlider = new KlSlider({
                label: LANG('brush-size'),
                width: 225,
                height: 30,
                ...brushInterface.sizeSlider,
                value: brush.getSize(),
                eventResMs: EVENT_RES_MS,
                onChange: (val) => {
                    setSize(val);
                    p.onSizeChange(val);
                },
            });
            opacitySlider = new KlSlider({
                label: LANG('opacity'),
                width: 225,
                height: 30,
                ...brushInterface.opacitySlider,
                value: brushInterface.opacitySlider.max,
                eventResMs: EVENT_RES_MS,
                onChange: (val) => {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
            });
            scatterSlider = new KlSlider({
                label: LANG('scatter'),
                width: 225,
                height: 30,
                ...scatterSliderConfig,
                value: scatterSliderConfig.min,
                eventResMs: EVENT_RES_MS,
                onChange: (val) => {
                    brush.setScatter(val);
                },
            });

            const pressureSizeToggle = createPenPressureToggle(true, function (b) {
                brush.sizePressure(b);
            });
            const pressureOpacityToggle = createPenPressureToggle(false, function (b) {
                brush.opacityPressure(b);
            });
            const pressureScatterToggle = createPenPressureToggle(false, function (b) {
                brush.scatterPressure(b);
            });

            div.append(
                BB.el({
                    content: [sizeSlider.getElement(), pressureSizeToggle],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                    },
                }),
                BB.el({
                    content: [opacitySlider.getElement(), pressureOpacityToggle],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                    },
                }),
                BB.el({
                    content: [scatterSlider.getElement(), pressureScatterToggle],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    },
                }),
                BB.el({
                    content: [alphaOptions.getElement(), lockAlphaToggle.getElement()],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 10,
                    },
                }),
            );
        }

        init();

        this.increaseSize = function (f) {
            if (!brush.isDrawing()) {
                sizeSlider.changeSliderValue(f);
            }
        };
        this.decreaseSize = function (f) {
            if (!brush.isDrawing()) {
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
            brush.setContext(layer.context);
        };
        this.startLine = function (x, y, p) {
            brush.startLine(x, y, p);
        };
        this.goLine = function (x, y, p) {
            brush.goLine(x, y, p);
        };
        this.endLine = function () {
            brush.endLine();
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
    } as TBrushUi<PenBrush>['Ui'];
    return brushInterface;
})();
