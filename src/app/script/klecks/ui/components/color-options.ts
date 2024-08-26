import { BB } from '../../../bb/bb';
import { IRGBA } from '../../kl-types';
import { theme } from '../../../theme/theme';
import { ColorConverter } from '../../../bb/color/color';
import { c } from '../../../bb/base/c';

/**
 * UI to pick between colors in colorArr. can display full transparent (checkerboard).
 * Can't deal with 0.5 alpha.
 * Rectangular buttons.
 */
export class ColorOptions {
    private readonly rootEl: HTMLElement;
    private readonly buttonArr: {
        el: HTMLElement;
        setIsSelected: (b: boolean) => void;
    }[];
    private readonly colorArr: (IRGBA | null)[] = [];
    private selectedIndex: number = 0;
    private colorInput: HTMLInputElement;

    private readonly updateCheckerboard: () => void;
    private readonly onColorInputChange: () => void;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        colorArr: (IRGBA | null)[]; // duplicates will be removed
        onChange: (rgbaObj: IRGBA | null) => void;
        label?: string;
        initialIndex?: number; // index before duplicates were removed
        title?: string;
    }) {
        this.rootEl = BB.el({
            content: p.label ? p.label : '',
            title: p.title ?? undefined,
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                position: 'relative',
            },
        });

        this.buttonArr = [];
        const buttonSize = 22;
        const checkerUrl = BB.createCheckerDataUrl(5, undefined, theme.isDark());

        this.onColorInputChange = () => {
            const i = this.selectedIndex;
            const color = this.colorArr[i];
            if (!color || color.a < 1) {
                // ignore
                return;
            }

            const newRawColor = this.colorInput.value;
            this.buttonArr[this.selectedIndex].el.style.backgroundColor = newRawColor;
            this.colorArr[i] = {
                ...ColorConverter.hexToRGB(newRawColor)!,
                a: 1,
            };
            p.onChange(this.colorArr[i]);
        };
        this.colorInput = BB.el({
            tagName: 'input',
            custom: {
                type: 'color',
                tabIndex: '-1',
            },
        });
        this.colorInput.onchange = this.onColorInputChange;
        this.colorInput.oninput = this.onColorInputChange;

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
                this.selectedIndex = this.colorArr.length - 1;
            }
        }

        for (let i = 0; i < this.colorArr.length; i++) {
            ((i) => {
                const color = this.colorArr[i];

                const colorButton = BB.el({
                    parent: this.rootEl,
                    content: color ? '' : 'X',
                    className: 'kl-color-option',
                    css: {
                        width: buttonSize + 'px',
                        height: buttonSize + 'px',
                        backgroundColor: color ? BB.ColorConverter.toRgbaStr(color) : 'transparent',
                        lineHeight: buttonSize + 1 + 'px',
                    },
                    onClick: (e) => {
                        if (this.selectedIndex === i) {
                            if (color && color.a === 1) {
                                this.colorInput.showPicker
                                    ? this.colorInput.showPicker()
                                    : this.colorInput.click();
                            }
                            return;
                        }

                        e.preventDefault();
                        this.selectedIndex = i;
                        update();
                        p.onChange(this.colorArr[i]); // color may change
                    },
                });
                if (color && color.a === 0) {
                    colorButton.style.backgroundImage = 'url(' + checkerUrl + ')';
                }

                const setIsSelected = (b: boolean): void => {
                    colorButton.classList.toggle('kl-color-option--active', b);
                };

                this.buttonArr.push({
                    el: colorButton,
                    setIsSelected,
                });
            })(i);
        }

        this.rootEl.append(c(',w-0,h-0,overflow-hidden,abs-0-0', [this.colorInput]));

        const update = () => {
            for (let i = 0; i < this.buttonArr.length; i++) {
                this.buttonArr[i].setIsSelected(i === this.selectedIndex);
            }
        };
        update();

        this.updateCheckerboard = (): void => {
            const checkerUrl = BB.createCheckerDataUrl(5, undefined, theme.isDark());
            this.buttonArr.forEach((button, i) => {
                const color = this.colorArr[i];
                if (color && color.a === 0) {
                    button.el.style.backgroundImage = 'url(' + checkerUrl + ')';
                }
            });
        };
        theme.addIsDarkListener(this.updateCheckerboard);
    }

    // ---- interface ----
    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): IRGBA | null {
        return this.colorArr[this.selectedIndex];
    }

    destroy(): void {
        this.rootEl.remove();
        this.buttonArr.forEach((item) => {
            BB.destroyEl(item.el);
        });
        this.buttonArr.splice(0, this.buttonArr.length);
        theme.removeIsDarkListener(this.updateCheckerboard);
        this.colorInput.onchange = null;
        this.colorInput.oninput = null;
    }
}
