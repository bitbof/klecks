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
import { clamp } from '../../../bb/math/math';

type TRgbChannel = 'r' | 'g' | 'b';

class ChannelInputTableRow {
    private readonly rootEl: HTMLElement;
    private readonly input: Input;
    private readonly channel: TRgbChannel;
    private readonly onChange: (channel: TRgbChannel, value: number) => void;
    private value: number;

    private updateFromInput(resetIfInvalid: boolean): void {
        const valueStr = this.input.getValue();
        const value = parseFloat(valueStr);
        if (valueStr === '' || !Number.isFinite(value)) {
            if (resetIfInvalid) {
                this.setValue(this.value, true);
            }
            return;
        }
        if (!resetIfInvalid && (value < 0 || value > 255)) {
            return;
        }
        this.value = Math.round(clamp(value, 0, 255));
        if (resetIfInvalid) {
            this.input.setValue(this.value);
        }
        this.onChange(this.channel, this.value);
    }

    constructor(p: {
        channel: TRgbChannel;
        value: number;
        onChange: (channel: TRgbChannel, value: number) => void;
    }) {
        this.channel = p.channel;
        this.value = p.value;
        this.onChange = p.onChange;
        this.input = new Input({
            name: 'manual-color-' + this.channel,
            init: this.value,
            min: 0,
            max: 255,
            type: 'number',
            css: {
                width: 80,
            },
            onBlur: () => this.updateFromInput(true),
            onInput: () => this.updateFromInput(false),
        });
        const label = {
            r: LANG('red'),
            g: LANG('green'),
            b: LANG('blue'),
        }[this.channel];
        this.rootEl = c('tr', [c('td,pr-10', label), c('td', [this.input.getElement()])]);
    }

    setColor(color: TRgb): void {
        this.setValue(color[this.channel], false);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.input.destroy();
    }

    private setValue(value: number, doForce: boolean): void {
        this.value = value;
        if (doForce || !this.input.getIsFocused()) {
            this.input.setValue(value);
        }
    }
}

/**
 * floating window for manually inputting the color
 */
export class HexColorWindow {
    private readonly floatingWindow: FloatingWindow;
    private readonly copyButton: HTMLElement;
    private readonly hexInput: Input;
    private readonly channelInputs: ChannelInputTableRow[];
    private readonly onClose: () => void;
    private readonly onChange: ((rgb: TRgb) => void) | undefined;
    private lastValidRgb: RGB;
    private isClosed = false;

    private emitChange(): void {
        this.onChange?.(new BB.RGB(this.lastValidRgb.r, this.lastValidRgb.g, this.lastValidRgb.b));
    }

    private updateFromHex(resetIfInvalid: boolean): void {
        const rgbObj = BB.ColorConverter.hexToRGB(this.hexInput.getValue());
        if (!rgbObj) {
            if (resetIfInvalid) {
                this.hexInput.setValue('#' + BB.ColorConverter.toHexString(this.lastValidRgb));
            }
            return;
        }
        const didChange =
            rgbObj.r !== this.lastValidRgb.r ||
            rgbObj.g !== this.lastValidRgb.g ||
            rgbObj.b !== this.lastValidRgb.b;
        if (didChange) {
            this.lastValidRgb = rgbObj;
            this.channelInputs.forEach((item) => item.setColor(this.lastValidRgb));
            this.emitChange();
        }
    }

    private updateFromRgb(channel: TRgbChannel, value: number): void {
        if (value === this.lastValidRgb[channel]) {
            return;
        }
        this.lastValidRgb[channel] = value;
        this.hexInput.setValue('#' + BB.ColorConverter.toHexString(this.lastValidRgb));
        this.emitChange();
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        color: TRgb;
        onClose: () => void;
        onChange?: (rgb: TRgb) => void;
        position?: TVector2D;
    }) {
        this.lastValidRgb = new BB.RGB(p.color.r, p.color.g, p.color.b);
        this.onClose = p.onClose;
        this.onChange = p.onChange;

        // hex input
        const hexLabel = BB.el({
            content: LANG('mci-hex'),
        });
        this.hexInput = new Input({
            name: 'manual-color-hex',
            init: '#' + BB.ColorConverter.toHexString(this.lastValidRgb),
            css: {
                width: 80,
            },
            onChange: () => this.updateFromHex(true),
            onInput: () => this.updateFromHex(false),
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
                value: this.lastValidRgb.r,
                onChange: (channel, value) => this.updateFromRgb(channel, value),
            }),
            new ChannelInputTableRow({
                channel: 'g',
                value: this.lastValidRgb.g,
                onChange: (channel, value) => this.updateFromRgb(channel, value),
            }),
            new ChannelInputTableRow({
                channel: 'b',
                value: this.lastValidRgb.b,
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
            onClose: () => this.close(),
            position: p.position,
        });
        document.body.append(this.floatingWindow.getElement());

        setTimeout(() => {
            if (this.isClosed) {
                return;
            }
            this.hexInput.focus();
            this.hexInput.select();
        });
    }

    setColor(color: TRgb): void {
        this.lastValidRgb = new BB.RGB(color.r, color.g, color.b);
        if (!this.hexInput.getIsFocused()) {
            this.hexInput.setValue('#' + BB.ColorConverter.toHexString(this.lastValidRgb));
        }
        this.channelInputs.forEach((item) => item.setColor(this.lastValidRgb));
    }

    getPosition(): TVector2D {
        return this.floatingWindow.getPosition();
    }

    close(): void {
        if (this.isClosed) {
            return;
        }
        this.isClosed = true;
        BB.destroyEl(this.copyButton);
        this.hexInput.destroy();
        this.channelInputs.forEach((item) => item.destroy());
        this.channelInputs.splice(0, this.channelInputs.length);
        this.floatingWindow.destroy();
        this.floatingWindow.getElement().remove();
        this.onClose();
    }
}
