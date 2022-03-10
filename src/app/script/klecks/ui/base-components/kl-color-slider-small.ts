import {BB} from '../../../bb/bb';
import {calcSliderFalloffFactor} from './slider-falloff';


/**
 * a small color slider
 *
 * params {
 * 	 width: 200,
 * 	 heightSV: 200,
 * 	 heightH: 10,
 * 	 color: {r,g,b}
 * 	 callback: function(c){}
 * }
 *
 * @param params
 * @constructor
 */
export const KlSmallColorSlider = function (params) {
    const div = document.createElement('div');
    div.oncontextmenu = function(e) {
        e.preventDefault();
    };
    let color = BB.ColorConverter.toHSV(new BB.RGB(params.color.r, params.color.g, params.color.b));
    BB.css(div, {
        width: params.width + 'px',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none'
    });

    const canvasSV = BB.canvas(10, 10);
    canvasSV.style.width = params.width + 'px';
    canvasSV.style.height = params.heightSV + 'px';
    canvasSV.style.cursor = 'crosshair';

    function updateSV() {
        const ctx = canvasSV.getContext('2d');
        for (let i = 0; i < canvasSV.height; i += 1) {
            const gradient1 = ctx.createLinearGradient(0, 0, canvasSV.width, 0);

            const colleft = BB.ColorConverter.toRGB(new BB.HSV(color.h, 1, 100 - (i / canvasSV.height * 100.0)));
            const colright = BB.ColorConverter.toRGB(new BB.HSV(color.h, 100, 100 - (i / canvasSV.height * 100.0)));
            gradient1.addColorStop(0, '#' + BB.ColorConverter.toHexString(colleft));
            gradient1.addColorStop(1, '#' + BB.ColorConverter.toHexString(colright));
            ctx.fillStyle = '#ff0000'; //needed for chrome...otherwise alpha problem
            ctx.fillStyle = gradient1;
            ctx.fillRect(0, i, canvasSV.width, 1);
        }
    }

    updateSV();

    const canvasH = BB.canvas(params.width, params.heightH);
    canvasH.style.cursor = 'ew-resize';
    (function () {
        const ctx = canvasH.getContext('2d');

        const gradH = ctx.createLinearGradient(0, 0, params.width, 0);
        for (let i = 0; i < 1; i += 0.01) {
            const col = BB.ColorConverter.toRGB(new BB.HSV(i * 360, 100, 100));
            gradH.addColorStop(i, 'rgba(' + parseInt('' + col.r) + ', ' + parseInt('' + col.g) + ', ' + parseInt('' + col.b) + ', 1)');
        }
        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, params.width, params.heightH);

    })();
    BB.css(canvasSV, {
        width: params.width + 'px',
        height: params.heightSV + 'px',
        overflow: 'hidden',
        position: 'relative'
    });
    canvasSV.style.cssFloat = 'left';
    canvasH.style.cssFloat = 'left';

    div.appendChild(canvasSV);
    div.appendChild(canvasH);

    const pointerSV = document.createElement('div');
    BB.css(pointerSV, {
        width: '8px',
        height: '8px',
        borderRadius: '8px',
        position: 'absolute',
        pointerEvents: 'none',
        boxShadow: '0 0 0 1px #000, inset 0 0 0 1px #fff'
    });
    div.appendChild(pointerSV);

    const pointerH = document.createElement('div');
    BB.css(pointerH, {
        width: '0',
        height: params.heightH + 'px',
        borderLeft: '1px solid #fff',
        borderRight: '1px solid #000',
        position: 'absolute',
        top: params.heightSV + 'px',
        pointerEvents: 'none'
    });
    div.appendChild(pointerH);


    function updateSVPointer() {
        const left = color.s / 100 * params.width - 4;
        const top = (1 - color.v / 100) * params.heightSV - 4;
        BB.css(pointerSV, {
            left: left + 'px',
            top: top + 'px'
        });
        /*if (top < params.heightSV/3) {
        pointerSV.style.border = "1px solid rgba(0,0,0,1)";
    } else {
        pointerSV.style.border = "1px solid rgba(255,255,255,1)";
    }*/
    }

    function updateHPointer() {
        pointerH.style.left = (color.h / 359.999 * params.width - 1) + 'px';
    }

    updateSVPointer();
    updateHPointer();

    const virtualHSV = {
        h: 0,
        s: 0,
        v: 0
    };

    let svPointerId = null;
    const svPointerListener = new BB.PointerListener({
        target: canvasSV,
        maxPointers: 1,
        fixScribble: true,
        onPointer: function(event) {

            if (event.type === 'pointerdown') {
                svPointerId = event.pointerId;
                if (event.button === 'left') {

                    virtualHSV.s = event.relX / params.width * 100;
                    virtualHSV.v = 100 - event.relY / params.heightSV * 100;

                    color = new BB.HSV(color.h, virtualHSV.s, virtualHSV.v);

                    updateSVPointer();
                    params.callback(BB.ColorConverter.toRGB(color));
                } else {
                    virtualHSV.s = color.s;
                    virtualHSV.v = color.v;
                }
            }

            if (event.type === 'pointermove' && ['left', 'right'].includes(event.button) && svPointerId === event.pointerId) {

                let factor = 1;
                if (event.button === 'right') {
                    factor = 0.5;
                }

                virtualHSV.s += event.dX / params.width * 100 * factor;
                virtualHSV.v -= event.dY / params.heightSV * 100 * factor;

                color = new BB.HSV(color.h, virtualHSV.s, virtualHSV.v);
                updateSVPointer();
                params.callback(BB.ColorConverter.toRGB(color));

            }
            if (event.type === 'pointerup') {
                svPointerId = null;
            }

        }
    });

    let hPointerId = null;
    const hPointerListener = new BB.PointerListener({
        target: canvasH,
        maxPointers: 1,
        fixScribble: true,
        onPointer: function(event) {

            if (event.type === 'pointerdown') {
                hPointerId = event.pointerId;
                if (event.button === 'left') {

                    virtualHSV.h = event.relX / params.width * 359.99;

                    color = new BB.HSV(virtualHSV.h, color.s, color.v);
                    updateSV();
                    updateHPointer();
                    params.callback(BB.ColorConverter.toRGB(color));
                } else {
                    virtualHSV.h = color.h;
                }
            }

            if (event.type === 'pointermove' && ['left', 'right'].includes(event.button) && hPointerId === event.pointerId) {

                const deltaY = Math.abs(event.pageY - event.downPageY);
                const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');

                virtualHSV.h += event.dX / params.width * 359.99 * factor;

                if (event.button === 'right') {
                    virtualHSV.h = virtualHSV.h % 359.99;
                    if (virtualHSV.h < 0) {
                        virtualHSV.h += 359.99;
                    }
                }
                virtualHSV.h = Math.min(359.99, virtualHSV.h);
                color = new BB.HSV(virtualHSV.h, color.s, color.v);
                updateSV();
                updateHPointer();
                params.callback(BB.ColorConverter.toRGB(color));

            }
            if (event.type === 'pointerup') {
                hPointerId = null;
            }
        }
    });


    const cleardiv = document.createElement('div');
    cleardiv.style.clear = 'both';
    div.appendChild(cleardiv);

    // --- interface ---
    this.setColor = function (c) {
        color = BB.ColorConverter.toHSV(new BB.RGB(c.r, c.g, c.b));
        updateSV();
        updateSVPointer();
        updateHPointer();
    };
    this.getColor = function () {
        return BB.ColorConverter.toRGB(color);
    };
    this.getElement = function() {
        return div;
    };
    this.destroy = function() {
        svPointerListener.destroy();
        hPointerListener.destroy();
    };
    this.end = function() {
        svPointerId = null;
        hPointerId = null;
    };

};