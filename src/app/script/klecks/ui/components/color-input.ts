import { BB } from '../../../bb/bb';
import { TCss, TVector2D } from '../../../bb/bb-types';
import { focusableElementClassName } from '../../../bb/base/ui';
import { TRgb } from '../../kl-types';
import * as classes from './color-input.module.scss';
import { ColorPickerWindow } from './color-picker-window';

export class ColorInput {
    private readonly rootEl: HTMLButtonElement;
    private readonly colorEl: HTMLSpanElement;
    private readonly onChange: (color: TRgb) => void;
    private readonly ariaLabel: string | undefined;
    private readonly title: string | undefined;
    private color: TRgb;
    private colorPickerWindow: ColorPickerWindow | undefined;
    private colorPickerPosition: TVector2D | undefined;

    private update(): void {
        const colorStr = '#' + BB.ColorConverter.toHexString(this.color);
        this.colorEl.style.backgroundColor = colorStr;
        this.rootEl.title = this.title ?? colorStr;
        this.rootEl.setAttribute(
            'aria-label',
            this.ariaLabel ? `${this.ariaLabel}: ${colorStr}` : colorStr,
        );
    }

    private closeColorPicker(): boolean {
        if (this.colorPickerWindow) {
            this.colorPickerWindow.destroy();
            this.colorPickerWindow = undefined;
            return true;
        }
        return false;
    }

    private toggleColorPicker(): void {
        if (this.closeColorPicker()) {
            return;
        }

        if (!this.colorPickerPosition) {
            const rect = this.rootEl.getBoundingClientRect();
            this.colorPickerPosition = {
                x: rect.left,
                y: rect.bottom + 8,
            };
        }

        this.colorPickerWindow = new ColorPickerWindow({
            color: this.color,
            onChange: (newColor) => {
                this.color = { ...newColor };
                this.update();
                this.onChange({ ...this.color });
            },
            onMove: (position) => {
                this.colorPickerPosition = position;
            },
            onClose: () => this.closeColorPicker(),
            position: this.colorPickerPosition,
            closeOnOutsideClick: true,
            triggerElement: this.rootEl,
        });
    }

    constructor(p: {
        init: TRgb;
        onChange: (color: TRgb) => void;
        name: string;
        title?: string;
        ariaLabel?: string;
        css?: TCss;
    }) {
        this.color = { ...p.init };
        this.onChange = p.onChange;
        this.title = p.title;
        this.ariaLabel = p.ariaLabel;
        this.rootEl = BB.el({
            tagName: 'button',
            className: [classes.button, focusableElementClassName],
            onClick: () => this.toggleColorPicker(),
            css: p.css,
            custom: {
                type: 'button',
                name: p.name,
            },
        });
        this.colorEl = BB.el({
            tagName: 'span',
            parent: this.rootEl,
            className: classes.color,
        });
        this.update();
    }

    getElement(): HTMLButtonElement {
        return this.rootEl;
    }

    getValue(): TRgb {
        return { ...this.color };
    }

    setValue(color: TRgb): void {
        this.color = { ...color };
        this.colorPickerWindow?.setColor(this.color);
        this.update();
    }

    destroy(): void {
        this.closeColorPicker();
        this.rootEl.remove();
        BB.destroyEl(this.rootEl);
    }
}
