import { getIconSvg } from '../../icon/icon';
import { BB } from '../../bb/bb';
import { BRUSHES } from '../brushes/brushes';
import { EVENT_RES_MS } from './brushes-consts';
import { createLockAlphaToggle } from '../ui/components/create-brush-toggles';
import { KlSlider } from '../ui/components/kl-slider';
import { createPenPressureToggle } from '../ui/components/create-pen-pressure-toggle';
import { TBrushUi } from '../kl-types';
import { LANG, LANGUAGE_STRINGS } from '../../language/language';
import { SmudgeBrush } from '../brushes/smudge-brush';

export const smudgeBrushUi = (function () {
    const brushInterface = {
        image: getIconSvg('brush-smudge'),
        tooltip: LANG('brush-smudge'),
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
    } as TBrushUi<SmudgeBrush>;

    LANGUAGE_STRINGS.subscribe(() => {
        brushInterface.tooltip = LANG('brush-smudge');
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement('div'); // the gui
        const brush = new BRUSHES.SmudgeBrush();
        brush.setHistory(p.klHistory);
        p.onSizeChange(brush.getSize());
        let sizeSlider: KlSlider;
        let opacitySlider: KlSlider;

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
                value: brush.getOpacity(),
                eventResMs: EVENT_RES_MS,
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
                        marginBottom: 10,
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
                    display: 'flex',
                    marginTop: 10,
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
            return brush.getIsDrawing();
        };
        this.getElement = function () {
            return div;
        };
    } as TBrushUi<SmudgeBrush>['Ui'];
    return brushInterface;
})();
