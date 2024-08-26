import { BB } from '../../bb/bb';
import { brushes } from '../brushes/brushes';
import { eventResMs } from './brushes-consts';
import { Checkbox } from '../ui/components/checkbox';
import { KlSlider } from '../ui/components/kl-slider';
import { createPenPressureToggle } from '../ui/components/create-pen-pressure-toggle';
import brushIconImg from '/src/app/img/ui/brush-pixel.svg';
import { IBrushUi } from '../kl-types';
import { LANG, languageStrings } from '../../language/language';
import { PixelBrush } from '../brushes/pixel-brush';

export const pixelBrushUi = (function () {
    const brushInterface = {
        image: brushIconImg,
        tooltip: LANG('brush-pixel'),
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
    } as IBrushUi<PixelBrush>;

    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-pixel');
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement('div'); // the gui
        const brush = new brushes.PixelBrush();
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
            css: {
                marginRight: '10px',
            },
        });

        const eraserToggle = new Checkbox({
            init: brush.getIsEraser(),
            label: LANG('eraser'),
            callback: function (b) {
                brush.setIsEraser(b);
            },
            css: {
                marginRight: '10px',
            },
        });

        const ditherToggle = new Checkbox({
            init: brush.getUseDither(),
            label: LANG('brush-pixel-dither'),
            callback: function (b) {
                brush.setUseDither(b);
            },
        });

        const spacingSpline = new BB.SplineInterpolator([
            [0.5, 0.45],
            [100, 4],
        ]);

        function setSize(size: number) {
            brush.setSize(size);
            brush.setSpacing(spacingSpline.interpolate(size) / size);
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
            });
            opacitySlider = new KlSlider({
                label: LANG('opacity'),
                width: 225,
                height: 30,
                min: brushInterface.opacitySlider.min,
                max: brushInterface.opacitySlider.max,
                value: brushInterface.opacitySlider.max,
                eventResMs: eventResMs,
                toDisplayValue: (val) => val * 100,
                toValue: (displayValue) => displayValue / 100,
                onChange: (val) => {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
            });

            const pressureSizeToggle = createPenPressureToggle(true, function (b) {
                brush.sizePressure(b);
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
                opacitySlider.getElement(),
            );

            const toggleRow = BB.el({
                parent: div,
                css: {
                    display: 'flex',
                    marginTop: '10px',
                },
            });

            toggleRow.append(
                lockAlphaToggle.getElement(),
                eraserToggle.getElement(),
                ditherToggle.getElement(),
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
            sizeSlider.setValue(size * 2);
        };
        this.getOpacity = function () {
            return brush.getOpacity();
        };
        this.setOpacity = function (opacity) {
            brush.setOpacity(opacity);
            opacitySlider.setValue(opacity * 100);
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
        this.toggleEraser = () => {
            eraserToggle.setValue(!eraserToggle.getValue());
            brush.setIsEraser(eraserToggle.getValue());
        };
        this.getElement = function () {
            return div;
        };
    } as IBrushUi<PixelBrush>['Ui'];
    return brushInterface;
})();
