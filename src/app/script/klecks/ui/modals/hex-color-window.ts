import { getIconImg } from '../../../icon/icon';
import { BB } from '../../../bb/bb';
import { Input } from '../components/input';
import { LANG } from '../../../language/language';
import { TRgb } from '../../kl-types';
import { RGB } from '../../../bb/color/color';
import { c } from '../../../bb/base/c';
import * as classes from './color-slider-hex-dialog.module.scss';
import { FloatingWindow } from '../components/floating-window';
import { TVector2D } from '../../../bb/bb-types';

type TRgbChannel = 'r' | 'g' | 'b';

class ChannelInputTableRow {
    private readonly rootEl: HTMLElement;
    private readonly input: Input<number>;
    private readonly channel: TRgbChannel;

    constructor(p: {
        channel: TRgbChannel;
        value: number;
        onChange: (channel: TRgbChannel, value: number) => void;
    }) {
        this.channel = p.channel;
        this.input = new Input({
            name: 'manual-color-' + this.channel,
            init: p.value,
            min: 0,
            max: 255,
            step: 1,
            type: 'number',
            css: {
                width: 80,
            },
            onChange: (value) => p.onChange(this.channel, value),
        });
        const label = {
            r: LANG('red'),
            g: LANG('green'),
            b: LANG('blue'),
        }[this.channel];
        this.rootEl = c('tr', [c('td,pr-10', label), c('td', [this.input.getElement()])]);
    }

    setColor(color: TRgb): void {
        if (!this.input.getIsFocused()) {
            this.input.setValue(color[this.channel]);
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.input.destroy();
    }
}

/**
 * floating window for manually inputting the color
 */
export class HexColorWindow {
    private readonly floatingWindow: FloatingWindow;
    private readonly copyButton: HTMLElement;
    private readonly hexInput: Input<string>;
    private readonly channelInputs: ChannelInputTableRow[];
    private readonly onClose: () => void;
    private readonly onChange: ((rgb: TRgb) => void) | undefined;
    private value: RGB;
    private isDestroyed = false;

    private emitChange(): void {
        this.onChange?.(new BB.RGB(this.value.r, this.value.g, this.value.b));
    }

    private updateFromHex(value: string): void {
        this.value = BB.ColorConverter.hexToRGB(value)!;
        this.channelInputs.forEach((item) => item.setColor(this.value));
        this.emitChange();
    }

    private updateFromRgb(channel: TRgbChannel, value: number): void {
        this.value[channel] = value;
        this.hexInput.setValue('#' + BB.ColorConverter.toHexString(this.value));
        this.emitChange();
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        color: TRgb;
        onClose: () => void;
        onChange?: (rgb: TRgb) => void;
        onMove?: (position: TVector2D) => void;
        position?: TVector2D;
    }) {
        this.value = new BB.RGB(p.color.r, p.color.g, p.color.b);
        this.onClose = p.onClose;
        this.onChange = p.onChange;

        // hex input
        const hexLabel = BB.el({
            content: LANG('mci-hex'),
        });
        this.hexInput = new Input({
            name: 'manual-color-hex',
            init: '#' + BB.ColorConverter.toHexString(this.value),
            css: {
                width: 80,
            },
            validate: (value) => BB.ColorConverter.hexToRGB(value) !== undefined,
            constrain: (value) => {
                const trimmedValue = value.trim();
                return trimmedValue.startsWith('#') ? trimmedValue : '#' + trimmedValue;
            },
            onChange: (value) => this.updateFromHex(value),
        });
        this.copyButton = BB.el({
            tagName: 'button',
            className: 'kl-button',
            content: getIconImg('copy', { height: 20 }),
            title: LANG('mci-copy'),
            onClick: () => {
                this.hexInput.select();
                navigator.clipboard.writeText(this.hexInput.getValue()).then().catch();
            },
        });
        const hexRowEl = BB.el({
            content: [
                hexLabel,
                c(',flex,items-center,gap-10', [this.hexInput.getElement(), this.copyButton]),
            ],
            css: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: 15,
                flexWrap: 'wrap',
                gap: '5px 10px',
                maxWidth: 250,
            },
        });

        // rgb channel inputs
        this.channelInputs = [
            new ChannelInputTableRow({
                channel: 'r',
                value: this.value.r,
                onChange: (channel, value) => this.updateFromRgb(channel, value),
            }),
            new ChannelInputTableRow({
                channel: 'g',
                value: this.value.g,
                onChange: (channel, value) => this.updateFromRgb(channel, value),
            }),
            new ChannelInputTableRow({
                channel: 'b',
                value: this.value.b,
                onChange: (channel, value) => this.updateFromRgb(channel, value),
            }),
        ];

        const contentEl = BB.el({
            content: [
                hexRowEl,
                c('table.' + classes.table, [
                    c(
                        'tbody',
                        this.channelInputs.map((item) => item.getElement()),
                    ),
                ]),
            ],
        });

        const rootEl = c('.' + classes.root, [
            c('b.' + classes.title, LANG('manual-color-input')),
            contentEl,
        ]);

        this.floatingWindow = new FloatingWindow({
            content: rootEl,
            onClose: () => this.destroy(),
            onMove: p.onMove,
            position: p.position,
        });

        setTimeout(() => {
            if (this.isDestroyed) {
                return;
            }
            this.hexInput.focus();
            this.hexInput.select();
        });
    }

    setColor(color: TRgb): void {
        this.value = new BB.RGB(color.r, color.g, color.b);
        if (!this.hexInput.getIsFocused()) {
            this.hexInput.setValue('#' + BB.ColorConverter.toHexString(this.value));
        }
        this.channelInputs.forEach((item) => item.setColor(this.value));
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        BB.destroyEl(this.copyButton);
        this.hexInput.destroy();
        this.channelInputs.forEach((item) => item.destroy());
        this.channelInputs.splice(0, this.channelInputs.length);
        this.floatingWindow.destroy();
        this.onClose();
    }
}
