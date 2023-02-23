import {BB} from '../../../bb/bb';
import {IRGBA} from '../../kl-types';
import {theme} from '../../../theme/theme';

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

    private readonly updateCheckerboard: () => void;

    // ---- public ----
    constructor (
        p: {
            colorArr: IRGBA[]; // duplicates will be removed
            onChange: (rgbaObj: IRGBA) => void;
            label?: string;
            initialIndex?: number; // index before duplicates were removed
        }
    ) {
        this.rootEl = BB.el({
            content: p.label ? p.label : '',
            css: {
                display: 'flex',
                alignItems: 'center',
            },
        });

        let selectedIndex = 0;
        const colorArr: IRGBA[] = [];
        this.buttonArr = [];
        const buttonSize = 22;
        const checkerUrl = BB.createCheckerDataUrl(5, undefined, theme.isDark());

        // build colorArr while removing duplicates
        for (let i = 0; i < p.colorArr.length; i++) {
            const item = p.colorArr[i];
            let found = false;
            for (let e = 0; e < colorArr.length; e++) {
                const sItem = colorArr[e];
                if (sItem === null || item === null) {
                    continue;
                }
                if (sItem.r === item.r && sItem.g === item.g && sItem.b === item.b && sItem.a === item.a) {
                    found = true;
                    break;
                }
            }
            if (found) {
                continue;
            }
            colorArr.push(item);
            if ('initialIndex' in p && p.initialIndex === i) {
                selectedIndex = colorArr.length - 1;
            }
        }

        for (let i = 0; i < colorArr.length; i++) {
            ((i) => {

                const colorButton = BB.el({
                    parent: this.rootEl,
                    content: colorArr[i] ? '' : 'X',
                    className: 'kl-color-option',
                    css: {
                        width: buttonSize + 'px',
                        height: buttonSize + 'px',
                        backgroundColor: colorArr[i] ? BB.ColorConverter.toRgbaStr(colorArr[i]) : 'transparent',
                        lineHeight: (buttonSize + 1) + 'px',
                    },
                    onClick: (e) => {
                        e.preventDefault();
                        selectedIndex = i;
                        update();
                        p.onChange(colorArr[i]);
                    },
                });
                if (colorArr[i] && colorArr[i].a === 0) {
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


        const update = () => {
            for (let i = 0; i < this.buttonArr.length; i++) {
                this.buttonArr[i].setIsSelected(i === selectedIndex);
            }
        };
        update();

        this.updateCheckerboard = (): void => {
            const checkerUrl = BB.createCheckerDataUrl(5, undefined, theme.isDark());
            this.buttonArr.forEach((button, i) => {
                if (colorArr[i] && colorArr[i].a === 0) {
                    button.el.style.backgroundImage = 'url(' + checkerUrl + ')';
                }
            });
        };
        theme.addIsDarkListener(this.updateCheckerboard);
    }

    // ---- interface ----
    getElement (): HTMLElement {
        return this.rootEl;
    }

    destroy (): void {
        this.buttonArr.forEach(item => {
            BB.destroyEl(item.el);
        });
        this.buttonArr.splice(0, this.buttonArr.length);
        theme.removeIsDarkListener(this.updateCheckerboard);
    }

}

