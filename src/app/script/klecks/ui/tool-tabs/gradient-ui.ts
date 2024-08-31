import { BB } from '../../../bb/bb';
import { KlSlider } from '../components/kl-slider';
import { LANG } from '../../../language/language';
import { Checkbox } from '../components/checkbox';
import { Options } from '../components/options';
import { TGradientType } from '../../kl-types';
import { KlColorSlider } from '../components/kl-color-slider';

interface IGradientUiSettings {
    opacity: number;
    type: TGradientType;
    doLockAlpha: boolean;
    doSnap: boolean;
    isReversed: boolean;
    isEraser: boolean;
}

/**
 * Gradient Tool tab contents
 *
 * @param p
 * @constructor
 */
export class GradientUi {
    private readonly rootEl: HTMLElement;
    private colorDiv: HTMLElement;
    private colorSlider: KlColorSlider;
    private isVisible: boolean;
    private readonly iconArr: HTMLElement[];

    private settings: IGradientUiSettings = {
        opacity: 1,
        type: 'linear',
        doLockAlpha: false,
        doSnap: false,
        isReversed: false,
        isEraser: false,
    };

    private updateIcons(): void {
        const col1 = this.settings.isReversed ? '#0000' : '#000';
        const col2 = this.settings.isReversed ? '#000' : '#0000';
        this.iconArr[0].style.background = `linear-gradient(${col1}, ${col2})`;
        this.iconArr[1].style.background = `linear-gradient(${col2}, ${col1}, ${col2})`;
        this.iconArr[2].style.background = `radial-gradient(${col1}, ${col2})`;
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        colorSlider: KlColorSlider; // when opening tab, inserts it (snatches it from where else it was)
    }) {
        this.colorSlider = p.colorSlider;
        this.rootEl = BB.el({
            css: {
                margin: '10px',
            },
        });
        this.isVisible = true;

        this.colorDiv = BB.el({
            parent: this.rootEl,
            css: {
                marginBottom: '10px',
            },
        });

        this.iconArr = [];
        {
            const size = 33;
            [0, 1, 2].forEach(() => {
                const el = BB.el({
                    className: 'dark-invert',
                    css: {
                        width: size + 'px',
                        height: size + 'px',
                        borderRadius: '3px',
                        margin: '1px',
                    },
                });
                this.iconArr.push(el);
            });
        }
        this.updateIcons();

        const typeOptions = new Options<TGradientType>({
            optionArr: [
                {
                    id: 'linear',
                    label: this.iconArr[0],
                    title: LANG('gradient-linear'),
                },
                {
                    id: 'linear-mirror',
                    label: this.iconArr[1],
                    title: LANG('gradient-linear-mirror'),
                },
                {
                    id: 'radial',
                    label: this.iconArr[2],
                    title: LANG('gradient-radial'),
                },
            ],
            initId: 'linear',
            onChange: (id) => {
                this.settings.type = id;
            },
        });
        this.rootEl.append(typeOptions.getElement());

        const opacitySlider = new KlSlider({
            label: LANG('opacity'),
            width: 250,
            height: 30,
            min: 1 / 100,
            max: 1,
            value: this.settings.opacity,
            toValue: (displayValue) => displayValue / 100,
            toDisplayValue: (value) => value * 100,
            onChange: (val) => {
                this.settings.opacity = val;
            },
        });
        BB.css(opacitySlider.getElement(), {
            marginTop: '10px',
        });
        this.rootEl.append(opacitySlider.getElement());

        const row1 = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px',
            },
        });

        const reverseToggle = new Checkbox({
            init: false,
            label: LANG('reverse'),
            callback: (b) => {
                this.settings.isReversed = b;
                this.updateIcons();
            },
            css: {
                width: '50%',
            },
        });

        const doSnapToggle = new Checkbox({
            init: false,
            label: LANG('angle-snap'),
            title: LANG('angle-snap-title'),
            callback: (b) => {
                this.settings.doSnap = b;
            },
            css: {
                width: '50%',
            },
        });

        row1.append(reverseToggle.getElement(), doSnapToggle.getElement());

        const row2 = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px',
            },
        });

        const eraserToggle = new Checkbox({
            init: this.settings.isEraser,
            label: LANG('eraser'),
            callback: (b) => {
                this.settings.isEraser = b;
            },
            css: {
                width: '50%',
            },
        });

        const lockAlphaToggle = new Checkbox({
            init: false,
            label: LANG('lock-alpha'),
            title: LANG('lock-alpha-title'),
            callback: (b) => {
                this.settings.doLockAlpha = b;
            },
            doHighlight: true,
            css: {
                width: '50%',
            },
        });

        row2.append(eraserToggle.getElement(), lockAlphaToggle.getElement());
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(isVisible: boolean): void {
        this.isVisible = !!isVisible;
        this.rootEl.style.display = isVisible ? 'block' : 'none';
        if (isVisible) {
            this.colorDiv.append(
                this.colorSlider.getElement(),
                this.colorSlider.getOutputElement(),
            );
        }
    }

    getSettings(): IGradientUiSettings {
        return BB.copyObj(this.settings);
    }
}
