import { brushes } from '../brushes/brushes';
import { eventResMs } from './brushes-consts';
import { KlSlider } from '../ui/components/kl-slider';
import brushIconImg from '/src/app/img/ui/brush-sketchy.png';
import { IBrushUi } from '../kl-types';
import { LANG, languageStrings } from '../../language/language';
import { BB } from '../../bb/bb';
import { SketchyBrush } from '../brushes/sketchy-brush';

export const sketchyBrushUi = (function () {
    const brushInterface = {
        image: brushIconImg,
        tooltip: LANG('brush-sketchy'),
        sizeSlider: {
            min: 0.5,
            max: 10,
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1,
        },
    } as IBrushUi<SketchyBrush>;

    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-sketchy');
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement('div'); // the gui
        const brush = new brushes.SketchyBrush();
        brush.setHistory(p.history);
        p.onSizeChange(brush.getSize());
        let sizeSlider: KlSlider;
        let opacitySlider: KlSlider;

        function setSize(size: number) {
            brush.setSize(size);
        }

        function init() {
            sizeSlider = new KlSlider({
                label: LANG('brush-size'),
                width: 250,
                height: 30,
                min: brushInterface.sizeSlider.min,
                max: brushInterface.sizeSlider.max,
                value: brush.getSize() * 2,
                eventResMs: eventResMs,
                toDisplayValue: (val) => val * 2,
                toValue: (displayValue) => displayValue / 2,
                onChange: function (val) {
                    brush.setSize(val);
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
                width: 250,
                height: 30,
                min: brushInterface.opacitySlider.min,
                max: brushInterface.opacitySlider.max,
                value: brush.getOpacity(),
                eventResMs: eventResMs,
                toDisplayValue: (val) => val * 100,
                toValue: (displayValue) => displayValue / 100,
                onChange: (val) => {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
            });
            const blendSlider = new KlSlider({
                label: LANG('brush-blending'),
                width: 250,
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
            const scaleSlider = new KlSlider({
                label: LANG('brush-sketchy-scale'),
                width: 250,
                height: 30,
                min: 1,
                max: 20,
                value: brush.getScale(),
                eventResMs: eventResMs,
                onChange: function (val) {
                    brush.setScale(val);
                },
            });
            opacitySlider.getElement().style.marginTop = '10px';
            blendSlider.getElement().style.marginTop = '10px';
            scaleSlider.getElement().style.marginTop = '10px';
            div.append(
                sizeSlider.getElement(),
                opacitySlider.getElement(),
                blendSlider.getElement(),
                scaleSlider.getElement(),
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
        this.setContext = function (c) {
            brush.setContext(c);
        };
        this.startLine = function (x, y, pressure) {
            brush.startLine(x, y, pressure);
        };
        this.goLine = function (x, y, pressure) {
            brush.goLine(x, y, pressure, undefined);
        };
        this.endLine = function () {
            brush.endLine();
        };
        this.getSeed = function () {
            return parseInt('' + brush.getSeed());
        };
        this.setSeed = function (s) {
            brush.setSeed(parseInt('' + s));
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
    } as IBrushUi<SketchyBrush>['Ui'];

    return brushInterface;
})();
