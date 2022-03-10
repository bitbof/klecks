import {BB} from '../../../bb/bb';


/**
 * a slider that looks like this
 * ------O----
 *
 * param: {init, width, pointSize, callback(value, isFirst, isLast)}
 *
 * @param param
 * @constructor
 */
export const PointSlider = function(param) {

    const div = document.createElement('div');
    div.style.position = 'relative';
    const sliderLine = BB.el({});
    const sliderPoint = BB.el({
        css: {
            colorScheme: 'only light',
        }
    });
    div.appendChild(sliderLine);
    div.appendChild(sliderPoint);
    let sliderPos;
    let isDragging = false;

    //sliderLine
    {
        BB.css(sliderLine, {
            marginTop: parseInt('' + (param.pointSize / 2 - 1)) + 'px',
            height: '2px',
            background: '#aaa',
            width: param.width + 'px'
        });
    }
    //sliderPoint
    const touchAreaEl = BB.el({ // expand clickable area
        parent: sliderPoint,
        css: {
            // background: 'rgba(255,0,0,0.4)',
            margin: '-7px 0 0 -7px',
            width: 'calc(100% + 14px)',
            height: 'calc(100% + 7px)',
        }
    });

    function redrawPoint() {
        sliderPoint.style.left = sliderPos + 'px';
        if (isDragging) {
            sliderPoint.style.boxShadow = '0 0 6px rgba(0,0,0,1)';
        } else {
            sliderPoint.style.boxShadow = '0 0 3px rgba(0,0,0,0.8)';
        }
    }
    function getValue() {
        return sliderPos /  (param.width - param.pointSize);
    }

    let pointerListener;
    {
        let isFirst;
        sliderPos = BB.clamp(param.init * (param.width - param.pointSize), 0, param.width - param.pointSize);
        BB.css(sliderPoint, {
            position: 'absolute',
            top: '0px',
            backgroundColor: '#eaeaea',
            boxShadow: '0 0 3px rgba(0,0,0,0.8)',
            width: param.pointSize + 'px',
            height: param.pointSize + 'px',
            borderRadius: param.pointSize + 'px',
            cursor: 'ew-resize',
            transition: 'box-shadow 0.2s ease-in-out'
        });
        redrawPoint();
        let imaginaryPos;
        pointerListener = new BB.PointerListener({
            target: sliderPoint,
            fixScribble: true,
            onPointer: function(event) {
                if (event.type === 'pointerdown' && event.button === 'left') {
                    isFirst = true;
                    isDragging = true;
                    imaginaryPos = sliderPos;
                    redrawPoint();
                    event.eventStopPropagation();
                } else if (event.type === 'pointermove' && event.button === 'left') {
                    event.eventStopPropagation();
                    imaginaryPos = imaginaryPos + event.dX;
                    sliderPos = parseInt('' + BB.clamp(imaginaryPos, 0, param.width - param.pointSize));
                    redrawPoint();
                    param.callback(getValue(), isFirst, false);
                    isFirst = false;
                }
                if (event.type === 'pointerup') {
                    event.eventStopPropagation();
                    isDragging = false;
                    redrawPoint();
                    param.callback(getValue(), false, true);
                }
            }
        })
    }

    // --- interface ---
    this.getEl = function() {
        return div;
    };
    this.setActive = function(isActive) {
        if (isActive) {
            sliderPoint.style.backgroundColor = '#fff';
        } else {
            sliderPoint.style.backgroundColor = '#eaeaea';
        }
    };
    this.destroy = function() {
        pointerListener.destroy();
    };
};