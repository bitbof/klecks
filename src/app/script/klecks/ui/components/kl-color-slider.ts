import { BB } from '../../../bb/bb';
import { HexColorDialog } from '../modals/color-slider-hex-dialog';
import { calcSliderFalloffFactor } from './slider-falloff';
import eyedropperImg from '/src/app/img/ui/tool-picker.svg';
import { LANG } from '../../../language/language';
import { IRGB } from '../../kl-types';
import { HSV, RGB } from '../../../bb/color/color';
import { ERASE_COLOR } from '../../brushes/erase-color';

/**
 * big main HS+V color slider
 * 2 elements: slider, and colorpreview(output) + eyedropper
 */
export class KlColorSlider {
    private readonly rootEl: HTMLElement;
    private readonly outputDiv: HTMLElement;
    private readonly divPreview: HTMLElement;
    private readonly hexButton: HTMLElement;
    private readonly secondaryColorBtn: HTMLElement;
    private primaryColorRGB: RGB;
    private primaryColorHSV: HSV;
    private secondaryColorRGB: RGB;
    private secondaryColorHSV: HSV;
    private readonly controlH: HTMLElement;
    private readonly onEyedropper: (b: boolean) => void;
    private isPicking: boolean;
    private readonly pickerButton: HTMLElement;
    private readonly width: number;
    private readonly height: number; // hue slider and output height
    private readonly hueStop: Element;

    private readonly SVContainer: HTMLElement;
    private readonly pointerSV: HTMLElement;
    private svHeight: number;
    private readonly svSvg: HTMLElement;

    private readonly emitColor: (rgb: RGB) => void;

    private updatePrimaryHSV(hsv: HSV): void {
        if (hsv.s === 0) {
            this.primaryColorHSV = new BB.HSV(this.primaryColorHSV.h, hsv.s, hsv.v);
        } else {
            this.primaryColorHSV = new BB.HSV(hsv.h, hsv.s, hsv.v);
        }
    }

    private updateSVCanvas(): void {
        const rgb = BB.ColorConverter.toRGB(new BB.HSV(this.primaryColorHSV.h, 100, 100));
        BB.setAttributes(this.hueStop, {
            'stop-color': '#' + BB.ColorConverter.toHexString(rgb),
        });
    }

    private updateSVPointer(): void {
        const left = (this.primaryColorHSV.s / 100) * this.width - 7;
        const top = (1 - this.primaryColorHSV.v / 100) * this.svHeight - 6;
        BB.css(this.pointerSV, {
            left: left + 'px',
            top: top + 'px',
        });
    }

    private setColPreview(): void {
        this.divPreview.style.backgroundColor =
            'rgb(' +
            this.primaryColorRGB.r +
            ',' +
            this.primaryColorRGB.g +
            ',' +
            this.primaryColorRGB.b +
            ')';

        if (BB.testIsWhiteBestContrast(this.primaryColorRGB)) {
            BB.css(this.pickerButton, {
                filter: 'invert(1)',
            });
            BB.css(this.hexButton, {
                filter: 'invert(1)',
            });
        } else {
            BB.css(this.pickerButton, {
                filter: '',
            });
            BB.css(this.hexButton, {
                filter: '',
            });
        }
    }

    private updateSecondaryColor(): void {
        this.secondaryColorBtn.style.backgroundColor = BB.ColorConverter.toRgbStr(
            this.secondaryColorRGB,
        );
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        width: number;
        height: number; // hue slider and output height
        svHeight: number;
        startValue: IRGB; // 0-255
        onPick: (rgb: IRGB) => void;
        onEyedropper: (isActive: boolean) => void;
    }) {
        this.rootEl = BB.el({
            className: 'kl-color-picker',
            css: {
                position: 'relative',
            },
        });
        this.outputDiv = BB.el({
            css: {
                display: 'flex',
                alignItems: 'center',
            },
        });
        this.width = p.width;
        this.svHeight = p.svHeight;
        this.height = p.height;
        this.emitColor = p.onPick;
        this.onEyedropper = p.onEyedropper;

        this.primaryColorRGB = {
            r: parseInt('' + p.startValue.r),
            g: parseInt('' + p.startValue.g),
            b: parseInt('' + p.startValue.b),
        };
        this.primaryColorHSV = BB.ColorConverter.toHSV(p.startValue); // BB.HSV
        this.secondaryColorRGB = {
            r: ERASE_COLOR,
            g: ERASE_COLOR,
            b: ERASE_COLOR,
        };
        this.secondaryColorHSV = BB.ColorConverter._RGBtoHSV(this.secondaryColorRGB); // BB.HSV

        const svWrapper = BB.el();
        this.svSvg = new DOMParser().parseFromString(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="value" gradientTransform="rotate(90)"><stop offset="0" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></linearGradient><linearGradient id="hue" gradientTransform="rotate(0)"><stop offset="0" stop-color="#fff"/><stop id="hue-stop" offset="100%" stop-color="#f00"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(\'#hue\')"/><rect x="0" y="0" width="100" height="100" fill="url(\'#value\')" style="mix-blend-mode: multiply"/></svg>',
            'image/svg+xml',
        ).documentElement;
        {
            const hueStop = this.svSvg.querySelector('#hue-stop');
            if (!hueStop) {
                throw Error('#hue-stop not found in svSvg');
            }
            this.hueStop = hueStop;
        }
        BB.setAttributes(this.hueStop, {
            'stop-color': '#f0f',
        });
        BB.css(this.svSvg, {
            width: this.width + 'px',
            height: this.svHeight + 'px',
        });
        svWrapper.append(this.svSvg);

        const divH = BB.el({
            className: 'kl-color-picker__h',
            css: {
                overflow: 'hidden',
                position: 'relative',
                width: this.width + 'px',
                height: this.height + 'px',
                cursor: 'ew-resize',
                marginTop: '1px',
                marginBottom: '1px',
            },
        });
        this.divPreview = BB.el({
            className: 'kl-color-picker__preview',
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                width: this.height * 2.5 + 'px',
                height: this.height + 'px',
            },
        });
        this.controlH = BB.el();

        const createHueBg = (targetEl: HTMLElement) => {
            const im = new Image();
            BB.css(im, {
                position: 'absolute',
                left: '0',
                top: '0',
                display: 'none',
                pointerEvents: 'none',
            });
            const cv = BB.canvas(this.width, this.height);
            const ctx = BB.ctx(cv);
            const gradH = ctx.createLinearGradient(0, 0, this.width, 0);
            for (let i = 0; i < 1; i += 0.01) {
                const col = BB.ColorConverter.toRGB(new BB.HSV(i * 360, 100, 100));
                let ha = parseInt('' + col.r).toString(16);
                let hb = parseInt('' + col.g).toString(16);
                let hc = parseInt('' + col.b).toString(16);
                if (ha.length === 1) {
                    ha = '0' + ha;
                }
                if (hb.length === 1) {
                    hb = '0' + hb;
                }
                if (hc.length === 1) {
                    hc = '0' + hc;
                }
                gradH.addColorStop(i, '#' + ha + hb + hc);
            }
            ctx.fillStyle = gradH;
            ctx.fillRect(0, 0, this.width, this.height);

            targetEl.append(im);
            im.alt = 'hue';
            im.src = cv.toDataURL('image/png');
            im.style.display = 'block';
        };

        this.updateSVCanvas();
        this.rootEl.style.width = this.width + 'px';
        this.rootEl.oncontextmenu = () => {
            return false;
        };

        this.SVContainer = BB.el({
            className: 'kl-color-picker__sv',
            css: {
                width: this.width + 'px',
                height: this.svHeight + 'px',
                overflow: 'hidden',
                display: 'block',
                position: 'relative',
                cursor: 'crosshair',
            },
        });

        this.pointerSV = BB.el({
            css: {
                width: '12px',
                height: '12px',
                borderRadius: '6px',
                position: 'absolute',
                pointerEvents: 'none',
                boxShadow: '0px 0px 0 1px #000, inset 0px 0px 0 1px #fff',
            },
        });

        this.SVContainer.append(svWrapper, this.pointerSV);
        this.updateSVPointer();
        this.rootEl.append(this.SVContainer, divH);
        this.outputDiv.append(this.divPreview);

        //divH.className = "svSlider";
        BB.css(this.controlH, {
            width: '2px',
            height: this.height + 'px',
            background: '#000',
            borderLeft: '1px solid #fff',
            position: 'absolute',
            top: '0',
            left: parseInt('' + ((this.primaryColorHSV.h / 360) * this.width - 1)) + 'px',
        });

        const virtualHSV = {
            h: 0,
            s: 0,
            v: 0,
        };

        this.pickerButton = BB.el({
            title: LANG('eyedropper') + ' [Alt]',
            className: 'color-picker-preview-button',
            css: {
                width: '30px',
                height: '30px',
                backgroundImage: 'url(' + eyedropperImg + ')',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '70%',
                backgroundPosition: 'center',
            },
            onClick: () => {
                if (this.isPicking) {
                    this.pickingDone();
                } else {
                    this.pickerButton.classList.remove('color-picker-preview-button-hover');
                    this.pickerButton.classList.add('color-picker-preview-button-active');
                    this.isPicking = true;
                    this.onEyedropper(true);
                }
            },
        });
        this.isPicking = false;

        const pickerButtonPointerListener = new BB.PointerListener({
            target: this.pickerButton,
            onEnterLeave: (isOver) => {
                if (this.isPicking) {
                    return;
                }
                this.pickerButton.classList.toggle('color-picker-preview-button-hover', isOver);
            },
        });
        this.divPreview.append(this.pickerButton);

        this.hexButton = BB.el({
            content: '#',
            className: 'color-picker-preview-button',
            title: LANG('manual-color-input'),
            css: {
                height: '100%',
                width: this.height + 'px',
                lineHeight: this.height + 'px',
                fontSize: this.height * 0.65 + 'px',
            },
            onClick: () => {
                new HexColorDialog({
                    color: new BB.RGB(
                        this.primaryColorRGB.r,
                        this.primaryColorRGB.g,
                        this.primaryColorRGB.b,
                    ),
                    onClose: (rgbObj) => {
                        if (!rgbObj) {
                            return;
                        }
                        this.setColor(rgbObj);
                        this.emitColor(
                            new BB.RGB(
                                this.primaryColorRGB.r,
                                this.primaryColorRGB.g,
                                this.primaryColorRGB.b,
                            ),
                        );
                    },
                });
            },
        });
        const hexButtonPointerListener = new BB.PointerListener({
            target: this.hexButton,
            onEnterLeave: (isOver) => {
                this.hexButton.classList.toggle('color-picker-preview-button-hover', isOver);
            },
        });
        this.divPreview.append(this.hexButton);

        this.setColPreview();

        setTimeout(() => {
            createHueBg(divH);
            divH.append(this.controlH);
            const svPointerListener = new BB.PointerListener({
                target: svWrapper,
                fixScribble: true,
                onPointer: (event) => {
                    if (event.type === 'pointerdown') {
                        // prevent manual slider input keeping focus on iPad
                        BB.unfocusAnyInput();

                        this.SVContainer.classList.toggle('kl-color-picker--active', true);

                        if (event.button === 'left') {
                            virtualHSV.s = (event.relX / this.width) * 100;
                            virtualHSV.v = 100 - (event.relY / this.svHeight) * 100;

                            this.primaryColorHSV = new BB.HSV(
                                this.primaryColorHSV.h,
                                virtualHSV.s,
                                virtualHSV.v,
                            );
                            this.primaryColorRGB = BB.ColorConverter.toRGB(this.primaryColorHSV);

                            this.updateSVPointer();
                            this.setColPreview();
                            this.emitColor(BB.ColorConverter.toRGB(this.primaryColorHSV));
                        } else {
                            virtualHSV.s = this.primaryColorHSV.s;
                            virtualHSV.v = this.primaryColorHSV.v;
                        }
                    }

                    if (
                        event.type === 'pointermove' &&
                        ['left', 'right'].includes(event.button || '')
                    ) {
                        let factor = 1;
                        if (event.button === 'right') {
                            factor = 0.5;
                        }

                        virtualHSV.s += (event.dX / this.width) * 100 * factor;
                        virtualHSV.v -= (event.dY / this.svHeight) * 100 * factor;

                        this.primaryColorHSV = new BB.HSV(
                            this.primaryColorHSV.h,
                            virtualHSV.s,
                            virtualHSV.v,
                        );
                        this.primaryColorRGB = BB.ColorConverter.toRGB(this.primaryColorHSV);
                        this.updateSVPointer();
                        this.setColPreview();
                        this.emitColor(BB.ColorConverter.toRGB(this.primaryColorHSV));
                    }

                    if (event.type === 'pointerup') {
                        this.SVContainer.classList.toggle('kl-color-picker--active', false);
                    }
                },
            });
            const hPointerListener = new BB.PointerListener({
                target: divH,
                fixScribble: true,
                onPointer: (event) => {
                    if (event.type === 'pointerdown') {
                        // prevent manual slider input keeping focus on iPad
                        BB.unfocusAnyInput();

                        divH.classList.toggle('kl-color-picker--active', true);

                        if (event.button === 'left') {
                            virtualHSV.h = (event.relX / this.width) * 359.99;

                            this.primaryColorHSV = new BB.HSV(
                                virtualHSV.h,
                                this.primaryColorHSV.s,
                                this.primaryColorHSV.v,
                            );
                            this.primaryColorRGB = BB.ColorConverter.toRGB(this.primaryColorHSV);
                            this.controlH.style.left =
                                Math.round((this.primaryColorHSV.h / 359.99) * this.width) -
                                1 +
                                'px';
                            this.updateSVCanvas();
                            this.setColPreview();
                            this.emitColor(BB.ColorConverter.toRGB(this.primaryColorHSV));
                        } else {
                            virtualHSV.h = this.primaryColorHSV.h;
                        }
                    }

                    if (
                        event.type === 'pointermove' &&
                        ['left', 'right'].includes(event.button || '')
                    ) {
                        const deltaY = Math.abs(event.pageY - event.downPageY!);
                        const factor = calcSliderFalloffFactor(deltaY, event.button === 'right');

                        virtualHSV.h += (event.dX / this.width) * 359.99 * factor;

                        if (event.button === 'right') {
                            virtualHSV.h = virtualHSV.h % 359.99;
                            if (virtualHSV.h < 0) {
                                virtualHSV.h += 359.99;
                            }
                        }
                        virtualHSV.h = Math.min(359.99, virtualHSV.h);
                        this.primaryColorHSV = new BB.HSV(
                            virtualHSV.h,
                            this.primaryColorHSV.s,
                            this.primaryColorHSV.v,
                        );
                        this.primaryColorRGB = BB.ColorConverter.toRGB(this.primaryColorHSV);
                        this.controlH.style.left =
                            Math.round((this.primaryColorHSV.h / 359.99) * this.width) - 1 + 'px';
                        this.updateSVCanvas();
                        this.setColPreview();
                        this.emitColor(BB.ColorConverter.toRGB(this.primaryColorHSV));
                    }

                    if (event.type === 'pointerup') {
                        divH.classList.toggle('kl-color-picker--active', false);
                    }
                },
            });
        }, 1);

        // --- secondary color ---

        this.secondaryColorBtn = BB.el({
            parent: this.outputDiv,
            title: LANG('secondary-color') + ' [X]',
            className: 'kl-color-picker__secondary',
            css: {
                cursor: 'pointer',
                marginLeft: '5px',
                width: '22px',
                height: '22px',
            },
            onClick: (e) => {
                e.preventDefault();
                this.swapColors();
            },
        });
        this.updateSecondaryColor();
    }

    setColor(c: IRGB): void {
        this.primaryColorRGB = {
            r: parseInt('' + c.r),
            g: parseInt('' + c.g),
            b: parseInt('' + c.b),
        };
        this.updatePrimaryHSV(BB.ColorConverter.toHSV(c));
        this.controlH.style.left =
            parseInt('' + ((this.primaryColorHSV.h / 359) * this.width - 1)) + 'px';
        this.updateSVCanvas();
        this.updateSVPointer();
        this.setColPreview();
    }

    getColor(): RGB {
        return new BB.RGB(this.primaryColorRGB.r, this.primaryColorRGB.g, this.primaryColorRGB.b);
    }

    getSecondaryRGB(): RGB {
        return new BB.RGB(
            this.secondaryColorRGB.r,
            this.secondaryColorRGB.g,
            this.secondaryColorRGB.b,
        );
    }

    getIsPicking(): boolean {
        return this.isPicking;
    }

    pickingDone(): void {
        if (!this.isPicking) {
            return;
        }
        this.isPicking = false;
        this.onEyedropper(false);
        this.pickerButton.classList.remove('color-picker-preview-button-active');
    }

    enable(e: boolean): void {
        if (e) {
            this.rootEl.style.pointerEvents = '';
            this.rootEl.style.opacity = '1';
            this.outputDiv.style.pointerEvents = '';
            this.outputDiv.style.opacity = '1';
        } else {
            this.rootEl.style.pointerEvents = 'none';
            this.rootEl.style.opacity = '0.5';
            this.outputDiv.style.pointerEvents = 'none';
            this.outputDiv.style.opacity = '0.5';
        }
    }

    setHeight(h: number): void {
        h = parseInt('' + (h - this.height * 2 - 3), 10);
        if (h === this.svHeight) {
            return;
        }
        this.svHeight = h;
        BB.css(this.svSvg, {
            width: this.width + 'px',
            height: this.svHeight + 'px',
        });
        this.SVContainer.style.height = this.svHeight + 'px';
        this.updateSVPointer();
    }

    swapColors(): void {
        // swap hsv
        let tmp: RGB | HSV = this.secondaryColorHSV;
        this.secondaryColorHSV = this.primaryColorHSV;
        this.updatePrimaryHSV(tmp);
        // swap rgb
        tmp = this.secondaryColorRGB;
        this.secondaryColorRGB = this.primaryColorRGB;
        this.primaryColorRGB = tmp;

        this.controlH.style.left =
            parseInt('' + ((this.primaryColorHSV.h / 359) * this.width - 1)) + 'px';
        this.updateSVCanvas();
        this.updateSVPointer();
        this.setColPreview();
        this.updateSecondaryColor();

        this.emitColor(
            new BB.RGB(this.primaryColorRGB.r, this.primaryColorRGB.g, this.primaryColorRGB.b),
        );
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getOutputElement(): HTMLElement {
        return this.outputDiv;
    }
}
