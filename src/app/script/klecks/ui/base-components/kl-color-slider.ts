import {BB} from '../../../bb/bb';
import {HexColorDialog} from '../modals/color-slider-hex-dialog';
import {calcSliderFalloffFactor} from './slider-falloff';
// @ts-ignore
import eyedropperImg from 'url:~/src/app/img/ui/tool-picker.svg';
import {LANG} from '../../../language/language';

/**
 * big main HS+V color slider
 * 2 elements: slider, and colorpreview(output) + eyedropper
 *
 * p = {
 *     width: number,
 *     height: number, // hue slider and output height
 *     svHeight: number,
 *     startValue: rgb, // 0-255
 *     onPick: function(rgb)
 * }
 *
 * @param p
 * @constructor
 */
export const KlColorSlider = function (p) {

    const _this = this;
    let pickCallback = function(result?) {};
    const div = document.createElement('div');
    div.style.position = 'relative';
    div.className = 'colorSlider';
    const outputDiv = BB.el({
        css: {
            display: 'flex',
            alignItems: 'center'
        }
    });
    const width = p.width;
    let svHeight = p.svHeight;
    const height = p.height;
    const emitColor = p.onPick;

    let primaryColorRGB = {
        r: parseInt(p.startValue.r, 10),
        g: parseInt(p.startValue.g, 10),
        b: parseInt(p.startValue.b, 10)
    };
    let primaryColorHSV = BB.ColorConverter.toHSV(p.startValue); // BB.HSV
    let secondaryColorRGB = {r: 255, g: 255, b: 255};
    let secondaryColorHSV = BB.ColorConverter._RGBtoHSV(secondaryColorRGB); // BB.HSV

    const svWrapper = BB.el({});
    const svSvg = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"> <defs> <linearGradient id="value" gradientTransform="rotate(90)"> <stop offset="0" stop-color="rgba(0,0,0,0)"/> <stop offset="100%" stop-color="rgba(0,0,0,1)"/> </linearGradient> <linearGradient id="hue" gradientTransform="rotate(0)"> <stop offset="0" stop-color="#fff"/> <stop id="hue-stop" offset="100%" stop-color="#f00"/> </linearGradient> </defs> <rect x="0" y="0" width="100" height="100" fill="url(\'#hue\')"/> <rect x="0" y="0" width="100" height="100" fill="url(\'#value\')"/></svg>', 'image/svg+xml').documentElement;
    const hueStop = (svSvg as any).getElementById('hue-stop');
    BB.setAttributes(hueStop, {
        'stop-color': '#f0f'
    });
    BB.css(svSvg, {
        width: width + 'px',
        height: svHeight + 'px'
    });
    svWrapper.appendChild(svSvg);

    const divH = document.createElement('div');
    BB.css(divH, {
        position: 'relative',
        height: height + 'px'
    });
    const divPreview = document.createElement('div');
    const controlH = document.createElement('div');

    const enabled = true;

    function updatePrimaryHSV(hsv) {
        if (hsv.s === 0) {
            primaryColorHSV = new BB.HSV(primaryColorHSV.h, hsv.s, hsv.v);
        } else {
            primaryColorHSV = new BB.HSV(hsv.h, hsv.s, hsv.v);
        }
    }

    function createHueBg(targetEl) {
        const im = new Image();
        BB.css(im, {
            position: 'absolute',
            left: '0',
            top: '0',
            display: 'none',
            pointerEvents: 'none'
        });
        const cv = BB.canvas(width, height);
        const ctx = cv.getContext('2d');
        const gradH = ctx.createLinearGradient(0, 0, width, 0);
        for (let i = 0; i < 1; i += 0.01) {
            const col = BB.ColorConverter.toRGB(new BB.HSV(i * 360, 100, 100));
            let ha = (parseInt('' + col.r)).toString(16);
            let hb = (parseInt('' + col.g)).toString(16);
            let hc = (parseInt('' + col.b)).toString(16);
            if (ha.length === 1)
                ha = '0' + ha;
            if (hb.length === 1)
                hb = '0' + hb;
            if (hc.length === 1)
                hc = '0' + hc;
            gradH.addColorStop(i, '#' + ha + hb + hc);
        }
        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, width, height);

        targetEl.appendChild(im);
        im.alt = 'hue';
        im.src = cv.toDataURL('image/png');
        im.style.display = 'block';
    }


    function updateSVCanvas() {
        const rgb = BB.ColorConverter.toRGB(new BB.HSV(primaryColorHSV.h, 100, 100));
        BB.setAttributes(hueStop, {
            'stop-color': '#' + BB.ColorConverter.toHexString(rgb)
        });
    }

    function updateSVPointer() {

        const left = primaryColorHSV.s / 100 * width - 7;
        const top = (1 - primaryColorHSV.v / 100) * svHeight - 6;
        BB.css(pointerSV, {
            left: left + 'px',
            top: top + 'px'
        });
    }

    function setColPreview() {
        divPreview.style.backgroundColor = 'rgb(' + primaryColorRGB.r + ',' + primaryColorRGB.g + ',' + primaryColorRGB.b + ')';

        if (BB.testIsWhiteBestContrast(primaryColorRGB)) {
            BB.css(pickerButton, {
                filter: 'invert(1)'
            });
            BB.css(hexButton, {
                filter: 'invert(1)'
            });
        } else{
            BB.css(pickerButton, {
                filter: ''
            });
            BB.css(hexButton, {
                filter: ''
            });
        }

    }

    updateSVCanvas();
    div.style.width = width + 'px';
    div.oncontextmenu = function () {
        return false;
    };

    const SVContainer = document.createElement('div');
    BB.css(SVContainer, {
        width: width + 'px',
        height: svHeight + 'px',
        overflow: 'hidden',
        display: 'block',
        position: 'relative',
        cursor: 'crosshair',
        boxShadow: 'rgb(188, 188, 188) 0 0 0 1px'
    });

    const pointerSV = document.createElement('div');
    BB.css(pointerSV, {
        width: '12px',
        height: '12px',
        borderRadius: '6px',
        position: 'absolute',
        pointerEvents: 'none',
        boxShadow: '0px 0px 0 1px #000, inset 0px 0px 0 1px #fff'
    });

    SVContainer.appendChild(svWrapper);
    SVContainer.appendChild(pointerSV);
    updateSVPointer();
    div.appendChild(SVContainer);
    div.appendChild(divH);
    outputDiv.appendChild(divPreview);
    BB.css(divPreview, {
        display: 'flex',
        justifyContent: 'space-between',
        width: (height * 2.5) + 'px',
        height: height + 'px',
        //position: "relative",
        boxShadow: 'rgb(188, 188, 188) 0 0 0 1px',
        colorScheme: 'only light',
    });

    BB.css(divH, {
        overflow: 'hidden',
        position: 'relative',
        width: width + 'px',
        height: height + 'px',
        cursor: 'ew-resize',
        boxShadow: 'rgb(188, 188, 188) 0 0 0 1px',
        marginTop: '1px',
        marginBottom: '1px'
    });

    //divH.className = "svSlider";
    BB.css(controlH, {
        width: '1px',
        height: height + 'px',
        background: '#000',
        borderLeft: '1px solid #fff',
        position: 'absolute',
        top: '0',
        left: parseInt('' + (primaryColorHSV.h / 360 * width - 1)) + 'px'
    });


    const virtualHSV = {
        h: 0,
        s: 0,
        v: 0
    };
    let svPointerListener;
    let hPointerListener;


    const pickerButton = BB.el({
        title: LANG('eyedropper') + ' [Alt]',
        className: 'color-picker-preview-button',
        css: {
            width: '30px',
            height: '30px',
            backgroundImage: 'url(' + eyedropperImg + ')',
            backgroundRepeat:  'no-repeat',
            backgroundSize: '70%',
            backgroundPosition: 'center'
        }
    });
    let isPicking = false;


    pickerButton.onclick = function () {
        if (isPicking === false) {
            BB.removeClassName(pickerButton, 'color-picker-preview-button-hover');
            BB.addClassName(pickerButton, 'color-picker-preview-button-active');
            isPicking = true;
            pickCallback(true);
        } else {
            pickCallback(false);
            _this.pickingDone();
        }
    };
    const pickerButtonPointerListener = new BB.PointerListener({
        target: pickerButton,
        onEnterLeave: function(isOver) {
            if (isPicking) {
                return;
            }
            if (isOver) {
                BB.addClassName(pickerButton, 'color-picker-preview-button-hover');
            } else {
                BB.removeClassName(pickerButton, 'color-picker-preview-button-hover');
            }
        }
    });
    divPreview.appendChild(pickerButton);


    const hexButton = BB.el({
        content: '#',
        className: 'color-picker-preview-button',
        title: LANG('manual-color-input'),
        css: {
            height: '100%',
            width: height + 'px',
            lineHeight: height + 'px',
            fontSize: (height * 0.65) + 'px'
        },
        onClick: function() {
            HexColorDialog({
                color: new BB.RGB(primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b),
                onClose: function(rgbObj) {
                    if (!rgbObj) {
                        return;
                    }
                    _this.setColor(rgbObj);
                    emitColor(new BB.RGB(primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b));
                }
            });
        }
    });
    const hexButtonPointerListener = new BB.PointerListener({
        target: hexButton,
        onEnterLeave: function(isOver) {
            if (isOver) {
                BB.addClassName(hexButton, 'color-picker-preview-button-hover');
            } else {
                BB.removeClassName(hexButton, 'color-picker-preview-button-hover');
            }
        }
    });
    divPreview.appendChild(hexButton);

    setColPreview();


    setTimeout(function() {
        createHueBg(divH);
        divH.appendChild(controlH);
        svPointerListener = new BB.PointerListener({
            target: svWrapper,
            maxPointers: 1,
            fixScribble: true,
            onPointer: function(event) {
                if (event.type === 'pointerdown') {
                    BB.css(SVContainer, {
                        boxShadow: '0px 0px 0px 1px rgb(255,255,255)',
                        zIndex: '1'
                    });

                    if (event.button === 'left') {

                        virtualHSV.s = event.relX / width * 100;
                        virtualHSV.v = 100 - event.relY / svHeight * 100;

                        primaryColorHSV = new BB.HSV(primaryColorHSV.h, virtualHSV.s, virtualHSV.v);
                        primaryColorRGB = BB.ColorConverter.toRGB(primaryColorHSV);

                        updateSVPointer();
                        setColPreview();
                        emitColor(BB.ColorConverter.toRGB(primaryColorHSV));
                    } else {
                        virtualHSV.s = primaryColorHSV.s;
                        virtualHSV.v = primaryColorHSV.v;
                    }
                }

                if (event.type === 'pointermove' && ['left', 'right'].includes(event.button)) {

                    let factor = 1;
                    if (event.button === 'right') {
                        factor = 0.5;
                    }

                    virtualHSV.s += event.dX / width * 100 * factor;
                    virtualHSV.v -= event.dY / svHeight * 100 * factor;

                    primaryColorHSV = new BB.HSV(primaryColorHSV.h, virtualHSV.s, virtualHSV.v);
                    primaryColorRGB = BB.ColorConverter.toRGB(primaryColorHSV);
                    updateSVPointer();
                    setColPreview();
                    emitColor(BB.ColorConverter.toRGB(primaryColorHSV));

                }

                if (event.type === 'pointerup') {
                    BB.css(SVContainer, {
                        boxShadow: '0 0 0 1px rgb(188, 188, 188)',
                        zIndex: '0'
                    });
                }

            }
        });
        hPointerListener = new BB.PointerListener({
            target: divH,
            maxPointers: 1,
            fixScribble: true,
            onPointer: function(event) {

                if (event.type === 'pointerdown') {
                    BB.css(divH, {
                        boxShadow: '0px 0px 0px 1px rgba(255,255,255,1)'
                    });

                    if (event.button === 'left') {

                        virtualHSV.h = event.relX / width * 359.99;

                        primaryColorHSV = new BB.HSV(virtualHSV.h, primaryColorHSV.s, primaryColorHSV.v);
                        primaryColorRGB = BB.ColorConverter.toRGB(primaryColorHSV);
                        controlH.style.left = (Math.round(primaryColorHSV.h / 359.99 * width) - 1) + 'px';
                        updateSVCanvas();
                        setColPreview();
                        emitColor(BB.ColorConverter.toRGB(primaryColorHSV));
                    } else {
                        virtualHSV.h = primaryColorHSV.h;
                    }
                }

                if (event.type === 'pointermove' && ['left', 'right'].includes(event.button)) {

                    const deltaY = Math.abs(event.pageY - event.downPageY);
                    const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');

                    virtualHSV.h += event.dX / width * 359.99 * factor;

                    if (event.button === 'right') {
                        virtualHSV.h = virtualHSV.h % 359.99;
                        if (virtualHSV.h < 0) {
                            virtualHSV.h += 359.99;
                        }
                    }
                    virtualHSV.h = Math.min(359.99, virtualHSV.h);
                    primaryColorHSV = new BB.HSV(virtualHSV.h, primaryColorHSV.s, primaryColorHSV.v);
                    primaryColorRGB = BB.ColorConverter.toRGB(primaryColorHSV);
                    controlH.style.left = (Math.round(primaryColorHSV.h / 359.99 * width) - 1) + 'px';
                    updateSVCanvas();
                    setColPreview();
                    emitColor(BB.ColorConverter.toRGB(primaryColorHSV));

                }

                if (event.type === 'pointerup') {
                    BB.css(divH, {
                        boxShadow: 'rgb(188, 188, 188) 0 0 0 1px'
                    });
                }
            }
        });
    }, 1);


    // --- second color ---

    const secondaryColorBtn = BB.el({
        parent: outputDiv,
        title: LANG('secondary-color') + ' [X]',
        css: {
            cursor: 'pointer',
            marginLeft: '5px',
            width: '22px',
            height: '22px',
            boxShadow: 'rgb(188, 188, 188) 0px 0px 0px 1px',
            colorScheme: 'only light',
        },
        onClick: function(e) {
            e.preventDefault();
            swapColors();
        }
    });
    function updateSecondaryColor() {
        secondaryColorBtn.style.backgroundColor = BB.ColorConverter.toRgbStr(secondaryColorRGB);
    }
    function swapColors() {
        // swap hsv
        let tmp: any = secondaryColorHSV;
        secondaryColorHSV = primaryColorHSV;
        updatePrimaryHSV(tmp);
        // swap rgb
        tmp = secondaryColorRGB;
        secondaryColorRGB = primaryColorRGB;
        primaryColorRGB = tmp;

        controlH.style.left = parseInt('' + (primaryColorHSV.h / 359 * width - 1)) + 'px';
        updateSVCanvas();
        updateSVPointer();
        setColPreview();
        updateSecondaryColor();

        emitColor(new BB.RGB(primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b));
    }
    updateSecondaryColor();



    // --- interface ---

    this.setColor = function (c) {
        primaryColorRGB = {r: parseInt(c.r, 10), g: parseInt(c.g, 10), b: parseInt(c.b, 10)};
        updatePrimaryHSV(BB.ColorConverter.toHSV(c));
        controlH.style.left = parseInt('' + (primaryColorHSV.h / 359 * width - 1)) + 'px';
        updateSVCanvas();
        updateSVPointer();
        setColPreview();
    };

    this.getColor = function () {
        return new BB.RGB(primaryColorRGB.r, primaryColorRGB.g, primaryColorRGB.b);
    };

    this.getSecondaryRGB = function() {
        return new BB.RGB(secondaryColorRGB.r, secondaryColorRGB.g, secondaryColorRGB.b);
    };

    this.setPickCallback = function (func) {
        pickCallback = func;
    };

    this.pickingDone = function () {
        if (!isPicking) {
            return;
        }
        isPicking = false;
        BB.removeClassName(pickerButton, 'color-picker-preview-button-active');
    };

    this.enable = function (e) {
        if (e) {
            div.style.pointerEvents = '';
            div.style.opacity = '1';
            outputDiv.style.pointerEvents = '';
            outputDiv.style.opacity = '1';
        } else {
            div.style.pointerEvents = 'none';
            div.style.opacity = '0.5';
            outputDiv.style.pointerEvents = 'none';
            outputDiv.style.opacity = '0.5';
        }
    };

    this.setHeight = function (h) {
        h = parseInt('' +(h - height * 2 - 3), 10);
        if (h === svHeight) {
            return;
        }
        svHeight = h;
        BB.css(svSvg, {
            width: width + 'px',
            height: svHeight + 'px'
        });
        SVContainer.style.height = svHeight + 'px';
        updateSVPointer();
    };

    this.swapColors = function() {
        swapColors();
    };

    this.getElement = function() {
        return div;
    };

    this.getOutputElement = function() {
        return outputDiv;
    }

};