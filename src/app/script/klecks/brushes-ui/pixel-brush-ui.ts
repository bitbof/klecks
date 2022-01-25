import {BB} from '../../bb/bb';
import {brushes} from '../brushes/brushes';
import {eventResMs} from './brushes-consts';
import {klHistory} from '../history/kl-history';
import {checkBox} from '../ui/base-components/check-box';
import {PcSlider} from '../ui/base-components/slider';
import {penPressureToggle} from '../ui/base-components/pen-pressure-toggle';
// @ts-ignore
import brushIconImg from 'url:~/src/app/img/ui/brush-pixel.svg';

export const pixelBrushUi = (function () {
    let brushInterface: any = {
        image: brushIconImg,
        tooltip: 'Pixel',
        sizeSlider: {
            min: 0.5,
            max: 100,
            curve: BB.quadraticSplineInput(0.5, 100, 0.1)
        },
        opacitySlider: {
            min: 0,
            max: 1,
            curve: [[0, 1 / 100], [0.5, 0.3], [1, 1]]
        }
    };

    /**
     * @param p = {onSizeChange: function(size), onOpacityChange: function(opacity)}
     * @constructor
     */
    brushInterface.Ui = function (p) {
        let div = document.createElement("div"); // the gui
        let brush = new brushes.pixel();
        brush.setHistory(klHistory);
        p.onSizeChange(brush.getSize());
        let sizeSlider;
        let opacitySlider;

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
            marginRight: '10px'
        });

        let eraserToggle = checkBox({
            init: brush.getIsEraser(),
            label: 'Eraser',
            callback: function (b) {
                brush.setIsEraser(b);
            }
        });
        BB.css(eraserToggle, {
            width: '70px',
            marginRight: '10px'
        });

        let ditherToggle = checkBox({
            init: brush.getUseDither(),
            label: 'Dither',
            callback: function (b) {
                brush.setUseDither(b);
            }
        });

        let spacingSpline = new BB.SplineInterpolator([[0.5, 0.45], [100, 4]]);

        function setSize(size) {
            brush.setSize(size);
            brush.setSpacing(spacingSpline.interpolate(size) / size);
        }

        function init() {
            sizeSlider = new PcSlider({
                label: 'Size',
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
                    return Math.round(v);
                }
            });
            opacitySlider = new PcSlider({
                label: 'Opacity',
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

            div.appendChild(pressureSizeToggle);
            div.appendChild(sizeSlider.getElement());
            BB.el({
                parent: div,
                css: {
                    clear: 'both',
                    marginBottom: '10px'
                }
            });
            div.appendChild(opacitySlider.getElement());

            let toggleRow = BB.el({
                parent: div,
                css: {
                    display: 'flex',
                    marginTop: '10px'
                }
            });

            toggleRow.appendChild(lockAlphaToggle);
            toggleRow.appendChild(eraserToggle);
            toggleRow.appendChild(ditherToggle);
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