import { BB } from '../../../bb/bb';
import { TRgba } from '../../kl-types';
import { Options } from './options';
import * as classes from './color-options.module.scss';
import { KlColorSliderSmall } from './kl-color-slider-small';
import { FloatingWindow } from './floating-window';
import { TCss, TVector2D } from '../../../bb/bb-types';

/**
 * UI to pick between colors in colorArr. can display full transparent (checkerboard).
 * Can't deal with 0.5 alpha.
 * Rectangular buttons.
 */
export class ColorOptions {
    private readonly rootEl: HTMLElement;
    private readonly options: Options<number>;
    private readonly colorArr: (TRgba | null)[] = [];
    private readonly onChange: (color: TRgba | null) => void;
    private colorPicker: KlColorSliderSmall | undefined;
    private colorPickerWindow: FloatingWindow | undefined;
    private colorPickerPosition: TVector2D | undefined;

    private closeColorPicker(): void {
        if (this.colorPickerWindow) {
            this.colorPickerPosition = this.colorPickerWindow.getPosition();
            this.colorPickerWindow.destroy();
            this.colorPickerWindow.getElement().remove();
            this.colorPickerWindow = undefined;
        }
        this.colorPicker?.destroy();
        this.colorPicker = undefined;
    }

    private toggleColorPicker(index: number): void {
        if (this.colorPicker) {
            this.closeColorPicker();
            return;
        }

        const color = this.colorArr[index];
        if (!color || color.a !== 1) {
            return;
        }

        if (!this.colorPickerPosition) {
            const rect = this.options.getElement().getBoundingClientRect();
            this.colorPickerPosition = {
                x: rect.left,
                y: rect.bottom + 8,
            };
        }

        this.colorPicker = new KlColorSliderSmall({
            width: 200,
            heightSV: 200,
            heightH: 30,
            color,
            callback: (newColor) => {
                const rgba = { ...newColor, a: 1 };
                const colorStr = BB.ColorConverter.toRgbaStr(rgba);
                this.colorArr[index] = rgba;
                this.options.updateOption(index, {
                    ariaLabel: colorStr,
                    css: { backgroundColor: colorStr },
                });
                this.onChange(rgba);
            },
        });
        this.colorPickerWindow = new FloatingWindow({
            content: BB.el({ content: this.colorPicker.getElement() }),
            onClose: () => this.closeColorPicker(),
            position: this.colorPickerPosition,
            closeOnOutsideClick: true,
        });
        document.body.append(this.colorPickerWindow.getElement());
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        colorArr: (TRgba | null)[]; // duplicates will be removed
        onChange: (rgbaObj: TRgba | null) => void;
        label?: string;
        initialIndex?: number; // index before duplicates were removed
        title?: string;
        css?: TCss;
    }) {
        this.onChange = p.onChange;
        this.rootEl = BB.el({
            content: p.label ? p.label : '',
            title: p.title ?? undefined,
            className: classes.root,
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                position: 'relative',
                width: 'fit-content',
                ...p.css,
            },
        });

        let selectedIndex = 0;

        // build colorArr while removing duplicates
        for (let i = 0; i < p.colorArr.length; i++) {
            const item = p.colorArr[i];
            let found = false;
            for (let e = 0; e < this.colorArr.length; e++) {
                const sItem = this.colorArr[e];
                if (sItem === item) {
                    found = true;
                    break;
                }
                if (sItem === null || item === null) {
                    continue;
                }
                if (
                    sItem.r === item.r &&
                    sItem.g === item.g &&
                    sItem.b === item.b &&
                    sItem.a === item.a
                ) {
                    found = true;
                    break;
                }
            }
            if (found) {
                continue;
            }
            this.colorArr.push(item);
            if ('initialIndex' in p && p.initialIndex === i) {
                selectedIndex = this.colorArr.length - 1;
            }
        }

        this.options = new Options<number>({
            optionArr: this.colorArr.map((color, index) => {
                const colorStr = color ? BB.ColorConverter.toRgbaStr(color) : 'X';
                return {
                    id: index,
                    label: color ? undefined : 'X',
                    ariaLabel: color ? colorStr : undefined,
                    css:
                        color && color.a === 0
                            ? { background: 'var(--kl-checkerboard-background)' }
                            : { backgroundColor: color ? colorStr : 'transparent' },
                };
            }),
            initId: selectedIndex,
            isFocusable: true,
            ariaLabel: p.title ?? p.label,
            onChange: (index) => {
                this.closeColorPicker();
                this.onChange(this.colorArr[index]);
            },
            onClickSelected: (index) => {
                this.toggleColorPicker(index);
            },
        });
        this.rootEl.append(this.options.getElement());
    }

    // ---- interface ----
    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): TRgba | null {
        return this.colorArr[this.options.getValue()];
    }

    destroy(): void {
        this.closeColorPicker();
        this.options.destroy();
        this.rootEl.remove();
    }
}
