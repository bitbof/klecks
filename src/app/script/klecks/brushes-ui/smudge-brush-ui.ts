import { BB } from '../../bb/bb';
import { brushes } from '../brushes/brushes';
import { eventResMs } from './brushes-consts';
import { Checkbox } from '../ui/components/checkbox';
import { KlSlider } from '../ui/components/kl-slider';
import { createPenPressureToggle } from '../ui/components/create-pen-pressure-toggle';
import brushIconImg from '/src/app/img/ui/brush-smudge.svg';
import { IBrushUi } from '../kl-types';
import { LANG, languageStrings } from '../../language/language';
import { SmudgeBrush } from '../brushes/smudge-brush';

export const smudgeBrushUi = (function () {
    const brushInterface = {
        image: brushIconImg,
        tooltip: LANG('brush-smudge'),
        sizeSlider: {
            min: 0.5,
            max: 100,
            curve: BB.quadraticSplineInput(0.5, 100, 0.1),
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1,
            curve: [
                [0, 1 / 100],
                [0.5, 0.3],
                [1, 1],
            ],
        },
    } as IBrushUi<SmudgeBrush>;

    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-smudge');
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement('div'); // the gui
        const brush = new brushes.SmudgeBrush();
        brush.setHistory(p.history);
        p.onSizeChange(brush.getSize());
        let sizeSlider: KlSlider;
        let opacitySlider: KlSlider;

        const lockAlphaToggle = new Checkbox({
            init: brush.getLockAlpha(),
            label: LANG('lock-alpha'),
            callback: function (b) {
                brush.setLockAlpha(b);
            },
            doHighlight: true,
            title: LANG('lock-alpha-title'),
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
                min: brushInterface.sizeSlider.min,
                max: brushInterface.sizeSlider.max,
                value: brush.getSize(),
                curve: brushInterface.sizeSlider.curve,
                eventResMs: eventResMs,
                toDisplayValue: (val) => val * 2,
                toValue: (displayValue) => displayValue / 2,
                onChange: (val) => {
                    setSize(val);
                    p.onSizeChange(val);
                },
                formatFunc: (displayValue) => {
                    if (displayValue < 10) {
                        return BB.round(displayValue, 1);
                    } else {
                        return Math.round(displayValue);
                    }
                },
                manualInputRoundDigits: 1,
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

            const pressureSizeToggle = createPenPressureToggle(false, function (b) {
                brush.sizePressure(b);
            });
            const pressureOpacityToggle = createPenPressureToggle(false, function (b) {
                brush.opacityPressure(b);
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
            );

            const bottomRow = BB.el({
                parent: div,
                css: {
                    marginTop: '10px',
                },
            });
            bottomRow.append(lockAlphaToggle.getElement());
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
        this.setContext = function (c) {
            brush.setContext(c);
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
            return brush.getIsDrawing();
        };
        this.getElement = function () {
            return div;
        };
    } as IBrushUi<SmudgeBrush>['Ui'];
    return brushInterface;
})();
