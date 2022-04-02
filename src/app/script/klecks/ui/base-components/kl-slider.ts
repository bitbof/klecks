import {BB} from '../../../bb/bb';
import {calcSliderFalloffFactor} from './slider-falloff';
import {IKlSliderConfig} from '../../kl.types';
import {languageStrings} from '../../../language/language';



/**
 * big slider, e.g. used for brush size
 *
 * p = {
 *      label: 'Size',
 *      width: 500,
 *      height: 20,
 *      theme: 'compact-light',
 *      min: 0,
 *      max: 100,
 *      initValue: 10,
 *      resolution: 600, // if you want spline.find to use a different resolution
 *      curve: 'quadratic' | [...], // optional. array is BB.SplineInterpolator points. 0-1
 *      formatFunc: function(value) { // optional
 *          return Math.round(value);
 *      },
 *      onChange: function(value) {},
 *      isChangeOnFinal: true,
 *      eventResMs: 123,
 *      isEnabled?: boolean, // default = true
 * }
 *
 * Values can be spline interpolated
 * On change callback can be debounced
 *
 * @param p - obj
 * @constructor
 */
export const KlSlider = function (p) {
    const _this = this;
    let isEnabled = p.isEnabled !== false;
    let useSpline = !!p.curve;
    let splineInterpolator;

    if (!p.label || !p.onChange) {
        throw 'PcSlider missing params';
    }
    if (p.min != 0 && p.max != 0 && p.initValue != 0) {
        if (!p.min || !p.max || !p.initValue) {
            throw 'PcSlider broken params';
        }
    }
    if (p.min >= p.max) {
        throw 'PcSlider broken params';
    }

    const elementWidth = p.width;
    const elementHeight = p.height;
    const resolution = p.resolution ? p.resolution : elementWidth;
    let min = p.min;
    let max = p.max;
    const onChange = p.onChange;
    const isChangeOnFinal = !!p.isChangeOnFinal;
    const formatFunc = p.formatFunc;
    const eventResMs = p.eventResMs;

    if (useSpline) {
        const curveArr = p.curve === 'quadratic' ? BB.quadraticSplineInput(min, max, 0.1) : p.curve;
        splineInterpolator = new BB.SplineInterpolator(curveArr);
    }

    function toLinearValue(value) {
        if (useSpline) {
            return splineInterpolator.findX(value, Math.floor(resolution * 1.5));
        }
        return (value - min) / (max - min);
    }

    function toValue(pLinearValue) {
        let result = min + pLinearValue * (max - min);
        if (useSpline) {
            result = splineInterpolator.interpolate(pLinearValue);
        }
        return result;
    }

    const div = BB.el({
        className: 'sliderWrapper',
        css: {
            overflow: 'hidden',
            position: 'relative',
            width: elementWidth + 'px',
            height: elementHeight + 'px',
            userSelect: 'none'
        }
    });
    const labelCaption = p.label;
    const label = document.createElement('div');
    const control = document.createElement('div');
    const controlInner = document.createElement('div');
    let linearValue = toLinearValue(p.initValue); //0 - 1

    div.appendChild(control);
    div.appendChild(label);
    control.appendChild(controlInner);
    control.className = 'sliderInner';


    div.oncontextmenu = function () {
        return false;
    };
    //control.style.backgroundColor = "#aaa";
    label.innerHTML = labelCaption;

    control.style.position = 'absolute';
    control.style.left = '0';
    control.style.top = '0';
    control.style.width = (linearValue * elementWidth) + 'px';
    control.style.height = elementHeight + 'px';

    const labelFontSize = elementHeight - 14;
    BB.css(label, {
        position: 'absolute',
        left: '7px',
        top: (elementHeight / 2 - labelFontSize / 2 + 1) + 'px',
        lineHeight: labelFontSize + 'px',
        fontSize: labelFontSize + 'px',
        pointerEvents: 'none'
    });

    function updateEnable (): void {
        if (isEnabled) {
            BB.css(div, {
                opacity: null,
                pointerEvents: null,
            });
        } else {
            BB.css(div, {
                opacity: '0.5',
                pointerEvents: 'none',
            });
        }
    }
    updateEnable();

    function getOutsideVal() {
        let result = min + linearValue * (max - min);
        if (useSpline) {
            result = splineInterpolator.interpolate(linearValue);
        }
        return result;
    }

    function updateLabel() {
        let outVal = toValue(linearValue);
        outVal = formatFunc ? formatFunc(outVal) : parseInt(outVal);
        outVal = outVal.toLocaleString(languageStrings.getCode());
        label.innerHTML = labelCaption + '&nbsp;&nbsp;<span style="font-weight:bold">' + outVal + '</span>';
        control.style.width = (linearValue * elementWidth) + 'px';
    }

    let lastCallbackTime = 0;
    function emit(isFinal) {
        if (!isFinal && isChangeOnFinal) {
            return;
        }
        if (eventResMs && !isFinal) {
            const now = performance.now();
            if (now - lastCallbackTime >= eventResMs) {
                lastCallbackTime = now;
                onChange(getOutsideVal());
            }
        } else {
            onChange(getOutsideVal());
        }
    }

    let virtualVal;
    function onPointer(event) {
        event.eventPreventDefault();

        if (!isEnabled) {
            return;
        }

        if (event.type === 'pointerdown') {
            div.className = 'sliderWrapper sliderWrapperActive';

            if (event.button === 'left') {
                linearValue = event.relX / elementWidth;
                linearValue = Math.max(0, Math.min(1, linearValue));
                updateLabel();
                emit(false);
            }
            virtualVal = linearValue;
        }

        if (event.type === 'pointermove' && ['left', 'right'].includes(event.button)) {

            let deltaX = event.dX;
            const deltaY = Math.abs(event.pageY - event.downPageY);
            const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');
            deltaX *= factor;
            deltaX /= elementWidth;

            virtualVal += deltaX;
            linearValue = Math.max(0, Math.min(1, virtualVal));

            updateLabel();
            emit(false);
        }

        if (event.type === 'pointerup') {
            div.className = 'sliderWrapper';
            emit(true);
        }

    }

    let pointerListener;
    const pointerListenerTimeout = setTimeout(() => {
        pointerListener = new BB.PointerListener({
            target: div,
            maxPointers: 1,
            fixScribble: true,
            onPointer: onPointer,
            onWheel: function(event) {
                if (useSpline) {
                    linearValue += -event.deltaY * (splineInterpolator.getLastX() - splineInterpolator.getFirstX()) / 40;
                    linearValue = Math.max(splineInterpolator.getFirstX(), Math.min(splineInterpolator.getLastX(), linearValue));
                } else {
                    linearValue += -event.deltaY / 40;
                    linearValue = Math.max(0, Math.min(1, linearValue));
                }
                updateLabel();
                onChange(getOutsideVal());
            }
        });
        updateLabel();
    }, 1);


    // --- interface ---
    this.increaseValue = function (f) {
        linearValue = Math.min(1, linearValue + Math.abs(f));
        updateLabel();
        onChange(getOutsideVal());
    };
    this.decreaseValue = function (f) {
        linearValue = Math.max(0, linearValue - Math.abs(f));
        updateLabel();
        onChange(getOutsideVal());
    };
    this.setValue = function(v) {
        linearValue = toLinearValue(v);
        updateLabel();
    };
    this.getValue = function () {
        return getOutsideVal();
    };
    this.update = function(config: IKlSliderConfig): void {
        min = config.min;
        max = config.max;
        useSpline = !!config.curve;
        if (useSpline) {
            const curveArr = config.curve === 'quadratic' ? BB.quadraticSplineInput(min, max, 0.1) : config.curve;
            splineInterpolator = new BB.SplineInterpolator(curveArr);
        } else {
            splineInterpolator = null;
        }
        _this.setIsEnabled(!config.isDisabled);
    };
    this.setIsEnabled = function (e: boolean): void {
        isEnabled = !!e;
        updateEnable();
    };

    this.destroy = function() {
        clearTimeout(pointerListenerTimeout);
        if (pointerListener) {
            pointerListener.destroy();
        }
    };

    this.getElement = function() {
        return div;
    }

};