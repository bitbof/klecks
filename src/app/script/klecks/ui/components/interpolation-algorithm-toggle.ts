import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';
import { createCanvas } from '../../../bb/base/create-canvas';
import { LANG } from '../../../language/language';
import { TInterpolationAlgorithm } from '../../kl-types';
import { Options } from './options';

function getAlgorithmIconDataUrl(): string {
    const canvas = createCanvas(3, 3);
    const ctx = BB.ctx(canvas);
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(2, 0, 1, 1);
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(0, 2, 1, 1);
    ctx.fillRect(2, 2, 1, 1);
    return canvas.toDataURL('image/png');
}

function createAlgorithmIcon(src: string, isPixelated: boolean): HTMLImageElement {
    const icon = new Image();
    icon.src = src;
    icon.className = 'dark-invert';
    css(icon, {
        width: 20,
        height: 20,
        margin: 4,
        imageRendering: isPixelated ? 'pixelated' : undefined,
    });
    return icon;
}

let iconSrc: string | undefined;

export class InterpolationAlgorithmToggle {
    private readonly options: Options<TInterpolationAlgorithm>;

    constructor(p: {
        initValue?: TInterpolationAlgorithm;
        // default false
        isFocusable?: boolean;
        onChange: (algorithm: TInterpolationAlgorithm) => void;
    }) {
        if (!iconSrc) {
            iconSrc = getAlgorithmIconDataUrl();
        }
        this.options = new Options<TInterpolationAlgorithm>({
            optionArr: [
                {
                    id: 'smooth',
                    label: createAlgorithmIcon(iconSrc, false),
                    title: LANG('algorithm-smooth'),
                },
                {
                    id: 'pixelated',
                    label: createAlgorithmIcon(iconSrc, true),
                    title: LANG('algorithm-pixelated'),
                },
            ],
            initId: p.initValue,
            isFocusable: p.isFocusable,
            ariaLabel: LANG('scaling-algorithm'),
            onChange: p.onChange,
        });
        if (p.initValue) {
            this.options.setValue(p.initValue, true);
        }
    }

    getElement(): HTMLElement {
        return this.options.getElement();
    }

    getValue(): TInterpolationAlgorithm {
        return this.options.getValue();
    }

    setValue(value: TInterpolationAlgorithm, skipEmit?: boolean): void {
        this.options.setValue(value, skipEmit);
    }

    destroy(): void {
        this.options.destroy();
    }
}
