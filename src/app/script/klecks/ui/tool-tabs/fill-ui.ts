import { BB } from '../../../bb/bb';
import { KlSlider } from '../components/kl-slider';
import { Select } from '../components/select';
import { Checkbox } from '../components/checkbox';
import { LANG } from '../../../language/language';
import { TFillSampling } from '../../kl-types';
import { KlColorSlider } from '../components/kl-color-slider';

/**
 * Paint Bucket tab contents (color slider, opacity slider, etc)
 */
export class FillUi {
    private readonly rootEl: HTMLElement;
    private isVisible: boolean;
    private readonly colorDiv: HTMLElement;
    private readonly colorSlider: KlColorSlider;
    private readonly toleranceSlider: KlSlider;
    private readonly opacitySlider: KlSlider;
    private readonly modeSelect: Select<string>;
    private readonly growSelect: Select<string>;
    private isContiguous: boolean;
    private readonly eraserToggle: Checkbox;

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        colorSlider: KlColorSlider; // when opening tab, inserts it (snatches it from where else it was)
    }) {
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

        this.colorSlider = p.colorSlider;

        this.opacitySlider = new KlSlider({
            label: LANG('opacity'),
            width: 250,
            height: 30,
            min: 1 / 100,
            max: 1,
            value: 1,
            toValue: (displayValue) => displayValue / 100,
            toDisplayValue: (value) => value * 100,
        });
        this.rootEl.append(this.opacitySlider.getElement());

        this.toleranceSlider = new KlSlider({
            label: LANG('bucket-tolerance'),
            width: 250,
            height: 30,
            min: 0,
            max: 255,
            value: 20 * (255 / 100),
            toValue: (displayValue) => displayValue * (255 / 100),
            toDisplayValue: (value) => value / (255 / 100),
        });
        BB.css(this.toleranceSlider.getElement(), {
            marginTop: '10px',
        });
        this.rootEl.append(this.toleranceSlider.getElement());

        const selectRow = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                marginTop: '10px',
            },
        });

        const modeWrapper = BB.el({
            content: LANG('bucket-sample') + '&nbsp;',
            title: LANG('bucket-sample-title'),
            css: {
                fontSize: '15px',
            },
        });
        this.modeSelect = new Select({
            optionArr: [
                ['all', LANG('bucket-sample-all')],
                ['current', LANG('bucket-sample-active')],
                ['above', LANG('bucket-sample-above')],
            ],
            initValue: 'all',
        });
        const modePointerListener = new BB.PointerListener({
            target: this.modeSelect.getElement(),
            onWheel: (e) => {
                this.modeSelect.setDeltaValue(e.deltaY);
            },
        });
        modeWrapper.append(this.modeSelect.getElement());
        selectRow.append(modeWrapper);

        const growWrapper = BB.el({
            content: LANG('bucket-grow') + '&nbsp;',
            title: LANG('bucket-grow-title'),
            css: {
                fontSize: '15px',
                marginLeft: '10px',
            },
        });
        this.growSelect = new Select({
            optionArr: [
                ['0', '0'],
                ['1', '1'],
                ['2', '2'],
                ['3', '3'],
                ['4', '4'],
                ['5', '5'],
                ['6', '6'],
                ['7', '7'],
            ],
            initValue: '0',
        });
        const growPointerListener = new BB.PointerListener({
            target: this.growSelect.getElement(),
            onWheel: (e) => {
                this.growSelect.setDeltaValue(e.deltaY);
            },
        });
        growWrapper.append(this.growSelect.getElement());
        selectRow.append(growWrapper);

        this.isContiguous = true;
        const contiguousToggle = new Checkbox({
            init: true,
            label: LANG('bucket-contiguous'),
            title: LANG('bucket-contiguous-title'),
            callback: (b) => {
                this.isContiguous = b;
            },
            css: {
                paddingRight: '5px',
                display: 'inline-block',
                width: '50%',
            },
        });

        this.eraserToggle = new Checkbox({
            init: false,
            label: LANG('eraser'),
            css: {
                paddingRight: '5px',
                display: 'inline-block',
                width: '50%',
            },
        });

        this.rootEl.append(
            BB.el({
                content: [contiguousToggle.getElement(), this.eraserToggle.getElement()],
                css: {
                    display: 'flex',
                    marginTop: '10px',
                },
            }),
        );
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(pIsVisible: boolean): void {
        this.isVisible = !!pIsVisible;
        this.rootEl.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.colorDiv.append(
                this.colorSlider.getElement(),
                this.colorSlider.getOutputElement(),
            );
        }
    }

    /**
     * [0, 1]
     */
    getTolerance(): number {
        // slider may display 0 when value is 1 -> avoid confusing users
        if (Math.round(this.toleranceSlider.getDisplayValue()) === 0) {
            return 0;
        }
        return this.toleranceSlider.getValue();
    }

    getOpacity(): number {
        return this.opacitySlider.getValue();
    }

    getSample(): TFillSampling {
        return this.modeSelect.getValue() as TFillSampling;
    }

    getGrow(): number {
        return parseInt(this.growSelect.getValue(), 10);
    }

    getContiguous(): boolean {
        return this.isContiguous;
    }

    getIsEraser(): boolean {
        return this.eraserToggle.getValue();
    }
}
