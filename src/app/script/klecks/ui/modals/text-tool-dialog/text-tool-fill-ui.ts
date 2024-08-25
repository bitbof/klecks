import { TRenderTextParam } from '../../../image-operations/render-text';
import { IRGB, IRGBA } from '../../../kl-types';
import { ColorOptions } from '../../components/color-options';
import { KlSlider } from '../../components/kl-slider';
import { LANG } from '../../../../language/language';
import { c } from '../../../../bb/base/c';
import { createSvg } from '../../../../bb/base/base';

type TFillParams = Pick<TRenderTextParam, 'fill'>;

export type TFillUIParams = TFillParams & {
    primaryColor: IRGB;
    secondaryColor: IRGB;
    onUpdate: (v: Partial<TFillParams>) => void;
};

export class TextToolFillUI {
    private readonly rootEl: HTMLElement;

    private readonly colorOptions: ColorOptions;
    private readonly opacitySlider: KlSlider;

    // ----------------------------------- public -----------------------------------
    constructor(p: TFillUIParams) {
        const emit = (): void => {
            p.onUpdate(this.getValues());
        };

        const colorOptionsArr: (IRGBA | null)[] = [
            null,
            p.fill
                ? {
                      ...p.fill.color,
                      a: 1,
                  }
                : null,
            {
                ...p.primaryColor,
                a: 1,
            },
            {
                ...p.secondaryColor,
                a: 1,
            },
            { r: 0, g: 0, b: 0, a: 1 },
            { r: 255, g: 255, b: 255, a: 1 },
        ];

        this.colorOptions = new ColorOptions({
            colorArr: colorOptionsArr,
            initialIndex: p.fill ? 1 : 0,
            title: LANG('shape-fill'),
            onChange: (c) => {
                this.opacitySlider.getElement().style.display = c !== null ? '' : 'none';
                emit();
            },
        });

        this.opacitySlider = new KlSlider({
            label: LANG('opacity'),
            width: 150,
            height: 30,
            min: 1 / 100,
            max: 1,
            value: p.fill ? p.fill.color.a : 1,
            resolution: 225,
            eventResMs: 1000 / 30,
            toValue: (displayValue) => displayValue / 100,
            toDisplayValue: (value) => value * 100,
            onChange: () => emit(),
        });
        this.opacitySlider.getElement().style.display = p.fill ? '' : 'none';

        const svg = createSvg({
            elementType: 'svg',
            class: 'dark-invert',
            width: '25px',
            height: '25px',
            viewBox: '0 0 30 30',

            childrenArr: [
                {
                    elementType: 'polyline',
                    points: '0,0 30,0 30,8 19,8 19,30 11,30 11,8 0,8 0,0 1,0',
                    'transform-origin': '15px 15px',
                    transform: 'scale(0.8)',
                    fill: '#000c',
                },
            ],
        });

        this.rootEl = c(',flex,gap-10,items-center,flexWrap,minh-30', [
            svg,
            this.colorOptions.getElement(),
            this.opacitySlider.getElement(),
        ]);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValues(): TFillParams {
        const c = this.colorOptions.getValue();
        if (c === null || c?.a === 0) {
            return {
                fill: undefined,
            };
        }
        const color = {
            ...c,
            a: this.opacitySlider.getValue(),
        };
        return {
            fill: {
                color,
            },
        };
    }

    destroy(): void {
        this.colorOptions.destroy();
        this.opacitySlider.destroy();
    }
}
