import {BB} from '../../bb/bb';
import {penPressureToggle} from '../ui/base-components/pen-pressure-toggle';
import {eventResMs} from './brushes-consts';
import {checkBox} from '../ui/base-components/check-box';
import {brushes} from '../brushes/brushes';
import {klHistory} from '../history/kl-history';
import {PcSlider} from '../ui/base-components/slider';
// @ts-ignore
import brushIconImg from 'url:~/src/app/img/ui/brush-smooth.png';

export const smoothBrushUi = (function () {
    let brushInterface: any = {
        image: brushIconImg,
        tooltip: 'Blend',
        sizeSlider: {
            min: 0.5,
            max: 200,
            curve: BB.quadraticSplineInput(0.5, 200, 0.1)
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1
        }
    };

    /**
     * @param p = {onSizeChange: function(size), onOpacityChange: function(opacity)}
     * @constructor
     */
    brushInterface.Ui = function (p) {
        let div = document.createElement("div"); // the gui
        let brush = new brushes.smoothBrush();
        brush.setHistory(klHistory);
        p.onSizeChange(brush.getSize());

        let sizeSlider;
        let opacitySlider;

        function setSize(size) {
            brush.setSize(size);
        }

        function init() {
            sizeSlider = new PcSlider({
                label: 'Size',
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
            opacitySlider = new PcSlider({
                label: 'Opacity',
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
            let blendingSlider = new PcSlider({
                label: 'Blending',
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
                brush.sizePressure(b);
            });
            let pressureOpacityToggle = penPressureToggle(false, function (b) {
                brush.opacityPressure(b);
            });

            let lockAlphaToggle = checkBox({
                init: brush.getLockAlpha(),
                label: 'Lock Alpha',
                callback: function (b) {
                    brush.setLockAlpha(b);
                },
                doHighlight: true
            });
            lockAlphaToggle.title = "Locks layer's alpha channel";
            BB.css(lockAlphaToggle, {
                marginTop: '10px',
                display: 'inline-block'
            });


            div.appendChild(pressureSizeToggle);
            div.appendChild(sizeSlider.getElement());
            BB.el({
                parent: div,
                css: {
                    clear: 'both',
                    marginBottom: '10px'
                }
            });
            div.appendChild(pressureOpacityToggle);
            div.appendChild(opacitySlider.getElement());
            div.appendChild(blendingSlider.getElement());
            div.appendChild(lockAlphaToggle);
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
        this.goLine = function (x, y, p, isCoalesced) {
            brush.goLine(x, y, p, undefined, isCoalesced);
        };
        this.endLine = function () {
            brush.endLine();
        };

        this.setRequestCanvas = function (f) {
            brush.setRequestCanvas(f);
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