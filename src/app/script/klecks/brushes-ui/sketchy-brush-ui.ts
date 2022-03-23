import {brushes} from '../brushes/brushes';
import {eventResMs} from './brushes-consts';
import {klHistory} from '../history/kl-history';
import {KlSlider} from '../ui/base-components/kl-slider';
// @ts-ignore
import brushIconImg from 'url:~/src/app/img/ui/brush-sketchy.png';
import {IBrushUi} from '../kl.types';
import {LANG, languageStrings} from '../../language/language';

export const sketchyBrushUi = (function () {
    let brushInterface: IBrushUi = {
        image: brushIconImg,
        tooltip: LANG('brush-sketchy'),
        sizeSlider: {
            min: 0.5,
            max: 10
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1
        },
        Ui: null,
    };

    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-sketchy');
    });

    brushInterface.Ui = function (p) {
        let div = document.createElement("div"); // the gui
        let brush = new brushes.SketchyBrush();
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
                width: 250,
                height: 30,
                min: brushInterface.sizeSlider.min,
                max: brushInterface.sizeSlider.max,
                initValue: brush.getSize(),
                eventResMs: eventResMs,
                onChange: function (val) {
                    brush.setSize(val);
                    p.onSizeChange(brush.getSize());
                },
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
                width: 250,
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
            let blendSlider = new KlSlider({
                label: LANG('brush-blending'),
                width: 250,
                height: 30,
                min: 0,
                max: 100,
                initValue: brush.getBlending() * 100,
                eventResMs: eventResMs,
                onChange: function (val) {
                    brush.setBlending(val / 100);
                }
            });
            let scaleSlider = new KlSlider({
                label: LANG('brush-sketchy-scale'),
                width: 250,
                height: 30,
                min: 1,
                max: 20,
                initValue: brush.getScale(),
                eventResMs: eventResMs,
                onChange: function (val) {
                    brush.setScale(val);
                }
            });
            opacitySlider.getElement().style.marginTop = "10px";
            blendSlider.getElement().style.marginTop = "10px";
            scaleSlider.getElement().style.marginTop = "10px";
            div.appendChild(sizeSlider.getElement());
            div.appendChild(opacitySlider.getElement());
            div.appendChild(blendSlider.getElement());
            div.appendChild(scaleSlider.getElement());
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
        this.startLine = function (x, y, pressure) {
            brush.startLine(x, y, pressure);
        };
        this.goLine = function (x, y, pressure) {
            brush.goLine(x, y, pressure, null);
        };
        this.endLine = function () {
            brush.endLine();
        };
        this.getSeed = function () {
            return parseInt(brush.getSeed());
        };
        this.setSeed = function (s) {
            brush.setSeed(parseInt(s));
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