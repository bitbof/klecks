import {BB} from '../../../bb/bb';
import {KlSlider} from '../base-components/kl-slider';
import {LANG} from '../../../language/language';
import {Checkbox} from '../base-components/checkbox';
import {Options} from '../base-components/options';


interface IGradientUiSettings {
    opacity: number;
    type: 'linear' | 'linear-mirror' | 'radial';
    doLockAlpha: boolean;
    doSnap: boolean;
    isReversed: boolean;
}

/**
 * Gradient Tool tab contents
 *
 * p = {
 *     colorSlider: KlColorSlider// when opening tab, inserts it (snatches it from where else it was)
 * }
 *
 * @param p
 * @constructor
 */
export class GradientUi {

    private rootEl: HTMLElement;
    private colorDiv: HTMLElement;
    private colorSlider: any; // todo type
    private isVisible: boolean;
    private iconArr: HTMLElement[];

    private settings: IGradientUiSettings = {
        opacity: 1,
        type: 'linear',
        doLockAlpha: false,
        doSnap: false,
        isReversed: false,
    };

    private updateIcons(): void {
        const col1 = this.settings.isReversed ? '#0000' : '#000';
        const col2 = this.settings.isReversed ? '#000' : '#0000';
        this.iconArr[0].style.background = `linear-gradient(${col1}, ${col2})`;
        this.iconArr[1].style.background = `linear-gradient(${col2}, ${col1}, ${col2})`;
        this.iconArr[2].style.background = `radial-gradient(${col1}, ${col2})`;
    }

    // ----- public -------

    constructor (
        p: {
            colorSlider: any; // KlColorSlider - when opening tab, inserts it (snatches it from where else it was)
        }
    ) {
        this.colorSlider = p.colorSlider;
        this.rootEl = BB.el({
            css: {
                margin: '10px'
            }
        });
        this.isVisible = true;

        this.colorDiv = BB.el({
            parent: this.rootEl,
            css: {
                marginBottom: '10px'
            }
        });

        this.iconArr = [];
        {
            const size = 33;
            [0, 1, 2].forEach(item => {
                const el = BB.el({
                    css: {
                        width: size + 'px',
                        height: size + 'px',
                        borderRadius: '3px',
                        margin: '1px',
                    }
                });
                this.iconArr.push(el);
            });
        }
        this.updateIcons();

        const typeOptions = new Options({
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
                }
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
            }
        });
        BB.css(opacitySlider.getElement(), {
            marginTop: '10px'
        });
        this.rootEl.append(opacitySlider.getElement());



        const row1 = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px'
            }
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
            }
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
            }
        });

        row1.append(
            reverseToggle.getElement(),
            doSnapToggle.getElement(),
        );


        const row2 = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px'
            }
        });

        const lockAlphaToggle = new Checkbox({
            init: false,
            label: LANG('lock-alpha'),
            title: LANG('lock-alpha-title'),
            callback: (b) => {
                this.settings.doLockAlpha = b;
            },
            doHighlight: true,
        });

        row2.append(
            lockAlphaToggle.getElement(),
            BB.el({css: {flexGrow: '1'}}),
        );


    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(isVisible: boolean): void {
        this.isVisible = !!isVisible;
        this.rootEl.style.display = isVisible ? 'block' : 'none';
        if (isVisible) {
            this.colorDiv.appendChild(this.colorSlider.getElement());
            this.colorDiv.appendChild(this.colorSlider.getOutputElement());
        }
    }

    getSettings(): IGradientUiSettings {
        return BB.copyObj(this.settings);
    }

}