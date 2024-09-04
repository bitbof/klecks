import { BB } from '../../../bb/bb';
import { dialogCounter } from '../modals/modal-count';
import toolPaintImg from '/src/app/img/ui/tool-paint.svg';
import toolFillImg from '/src/app/img/ui/tool-fill.svg';
import toolGradientImg from '/src/app/img/ui/tool-gradient.svg';
import toolTextImg from '/src/app/img/ui/tool-text.svg';
import toolShapeImg from '/src/app/img/ui/tool-shape.svg';
import toolSelectImg from '/src/app/img/ui/tool-select.svg';
import caretDownImg from '/src/app/img/ui/caret-down.svg';
import { LANG } from '../../../language/language';
import { TToolType } from '../../kl-types';
import { PointerListener } from '../../../bb/input/pointer-listener';

type TDropdownButton = {
    wrapper: HTMLElement;
    show: (b: boolean) => void;
    setIsSmall: (b: boolean) => void;
};

/**
 * Toolrow Dropdown. The button where you select: brush, fill, select, transform, etc.
 */
export class ToolDropdown {
    private readonly rootEl: HTMLElement;
    private readonly activeButton: HTMLElement;
    private readonly smallMargin: string = '6px 0';
    private readonly optionArr: TToolType[] = [
        'brush',
        'paintBucket',
        'gradient',
        'text',
        'shape',
        'select',
    ];
    private readonly dropdownBtnArr: TDropdownButton[];
    private readonly arrowButton: HTMLElement;
    private isActive: boolean;
    private currentActiveIndex: number;
    private readonly titleArr: string[];
    private activeButtonIm: HTMLElement;
    private readonly imArr;

    private updateButton() {
        this.activeButton.title = this.titleArr[this.currentActiveIndex];
        this.activeButtonIm.style.backgroundImage =
            "url('" + this.imArr[this.currentActiveIndex] + "')";
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: { onChange: (activeStr: TToolType) => void }) {
        this.imArr = [
            toolPaintImg,
            toolFillImg,
            toolGradientImg,
            toolTextImg,
            toolShapeImg,
            toolSelectImg,
        ];
        this.titleArr = [
            `${LANG('tool-brush')} [B]`,
            `${LANG('tool-paint-bucket')} [G]`,
            `${LANG('tool-gradient')} [G]`,
            `${LANG('tool-text')} [T]`,
            `${LANG('tool-shape')} [U]`,
            `${LANG('tool-select')} [L]`,
        ];
        this.currentActiveIndex = 0;
        this.isActive = true;
        let isOpen = false;

        //preload images
        setTimeout(() => {
            for (let i = 1; i < this.imArr.length; i++) {
                const im = new Image();
                im.src = this.imArr[i];
            }
        }, 100);

        this.rootEl = BB.el({
            css: {
                position: 'relative',
                flexGrow: '1',
            },
        });

        let openTimeout: ReturnType<typeof setTimeout>;
        let isDragging = false;
        let startX: number;
        let startY: number;
        let pointerListener;
        if (BB.hasPointerEvents) {
            pointerListener = new BB.PointerListener({
                target: this.rootEl,
                onPointer: (event) => {
                    if (event.type === 'pointerdown') {
                        if (isOpen) {
                            return;
                        }

                        openTimeout = setTimeout(() => {
                            showDropdown();
                        }, 400);
                        isDragging = true;
                        startX = event.pageX;
                        startY = event.pageY;
                    } else if (event.type === 'pointermove' && isDragging) {
                        if (!isOpen && BB.dist(startX, startY, event.pageX, event.pageY) > 5) {
                            clearTimeout(openTimeout);
                            showDropdown();
                        }
                    } else if (event.type === 'pointerup' && isDragging) {
                        clearTimeout(openTimeout);
                        isDragging = false;
                        if (isOpen) {
                            const target = document.elementFromPoint(event.pageX, event.pageY);
                            for (let i = 0; i < this.dropdownBtnArr.length; i++) {
                                if (target === this.dropdownBtnArr[i].wrapper) {
                                    closeDropdown();
                                    this.isActive = true;
                                    this.currentActiveIndex = i;
                                    this.updateButton();
                                    p.onChange(this.optionArr[this.currentActiveIndex]);
                                    break;
                                }
                            }
                        }
                    }
                },
            });
        }

        this.activeButton = BB.el({
            parent: this.rootEl,
            className: 'toolspace-row-button nohighlight toolspace-row-button-activated',
            title: this.titleArr[this.currentActiveIndex],
            onClick: (e) => {
                if (this.isActive && !isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    showDropdown();
                    return;
                }

                this.isActive = true;
                p.onChange(this.optionArr[this.currentActiveIndex]);
                if (isOpen) {
                    closeDropdown();
                }
            },
            css: {
                padding: '10px 0',
                pointerEvents: 'auto',
                height: '100%',
                boxSizing: 'border-box',
                zIndex: '1',
            },
        });

        // hover via JS, so hover-state not stuck on mobile
        const activeButtonPointerListener = new PointerListener({
            target: this.activeButton,
            onEnterLeave: (isOver) => {
                this.activeButton.classList.toggle('kl-tool-button--hover', isOver);
            },
        });

        this.activeButtonIm = BB.el({
            parent: this.activeButton,
            className: 'dark-invert',
            css: {
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: 'contain',
                width: 'calc(100% - 7px)',
                height: '100%',
                pointerEvents: 'none',
                opacity: '0.75',
            },
        });

        this.arrowButton = BB.el({
            parent: this.activeButton,
            className: 'kl-tooldropdown-caret dark-invert',
            css: {
                position: 'absolute',
                right: '1px',
                width: '18px',
                height: '18px',
                cursor: 'pointer',

                backgroundImage: "url('" + caretDownImg + "')",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
            },
            title: 'More Tools',
            onClick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                showDropdown();
            },
        });

        const overlay = BB.el({
            css: {
                position: 'absolute',
                //background: 'rgba(255,0,0,0.5)',
                left: '0',
                top: '0',
                right: '0',
                bottom: '0',
            },
        });
        const overlayPointerListener = new BB.PointerListener({
            target: overlay,
            onPointer: (e) => {
                if (e.type === 'pointerdown') {
                    e.eventPreventDefault();
                    closeDropdown();
                }
            },
        });

        const dropdownWrapper = BB.el({
            className: 'tool-dropdown-wrapper',
            css: {
                position: 'absolute',
                width: '100%',
                height: 100 * (this.optionArr.length - 1) + '%',
                top: '100%',
                left: '0',
                zIndex: '-1',
                boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'height 0.1s ease-in-out, opacity 0.1s ease-in-out',
                borderBottomLeftRadius: '5px',
                borderBottomRightRadius: '5px',
                overflow: 'hidden',
            },
        });

        this.dropdownBtnArr = [];

        const createDropdownButton = (p: {
            index: number;
            id: TToolType;
            image: string;
            title: string;
            onClick: (index: number) => void;
        }): TDropdownButton => {
            const wrapper = BB.el({
                parent: dropdownWrapper,
                className: 'tool-dropdown-button',
                title: p.title,
                css: {
                    padding: '10px 0',
                    height: 100 / (this.optionArr.length - 1) + '%',
                    boxSizing: 'border-box',
                },
                onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    p.onClick(p.index);
                },
            });

            BB.el({
                parent: wrapper,
                className: 'dark-invert',
                css: {
                    backgroundImage: "url('" + p.image + "')",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: 'contain',
                    height: '100%',
                    pointerEvents: 'none',
                    opacity: '0.75',
                },
            });

            // --- interface ---
            const show = (b: boolean) => {
                wrapper.style.display = b ? 'block' : 'none';
            };

            const setIsSmall = (b: boolean) => {
                wrapper.style.padding = b ? this.smallMargin : '10px 0';
            };

            return {
                wrapper,
                show,
                setIsSmall,
            };
        };

        const onClickDropdownBtn = (index: number) => {
            closeDropdown();

            this.isActive = true;
            this.currentActiveIndex = index;

            this.updateButton();

            p.onChange(this.optionArr[this.currentActiveIndex]);
        };

        for (let i = 0; i < this.optionArr.length; i++) {
            this.dropdownBtnArr.push(
                createDropdownButton({
                    index: i,
                    id: this.optionArr[i],
                    image: this.imArr[i],
                    title: this.titleArr[i],
                    onClick: onClickDropdownBtn,
                }),
            );
        }

        const showDropdown = () => {
            if (dialogCounter.get() > 0) {
                return;
            }
            dialogCounter.increase(0.5);
            isOpen = true;

            for (let i = 0; i < this.optionArr.length; i++) {
                this.dropdownBtnArr[i].show(this.currentActiveIndex !== i);
            }

            this.arrowButton.style.opacity = '0';
            this.arrowButton.style.setProperty('opacity', '0');
            this.arrowButton.style.pointerEvents = 'none';
            this.rootEl.style.zIndex = '1';
            document.body.append(overlay);
            this.rootEl.append(dropdownWrapper);
        };

        const closeDropdown = () => {
            dialogCounter.decrease(0.5);
            isOpen = false;
            this.arrowButton.style.removeProperty('opacity');
            this.arrowButton.style.removeProperty('pointerEvents');
            this.rootEl.style.removeProperty('z-index');
            overlay.remove();
            dropdownWrapper.remove();
        };

        this.updateButton();
    }

    // ---- interface ----

    setIsSmall(b: boolean): void {
        this.activeButton.style.padding = b ? this.smallMargin : '10px 0';
        for (let i = 0; i < this.optionArr.length; i++) {
            this.dropdownBtnArr[i].setIsSmall(b);
        }
        if (b) {
            this.arrowButton.style.width = '14px';
            this.arrowButton.style.height = '14px';
        } else {
            this.arrowButton.style.width = '18px';
            this.arrowButton.style.height = '18px';
        }
    }

    setActive(activeStr: TToolType): void {
        if (this.optionArr.includes(activeStr)) {
            this.isActive = true;
            for (let i = 0; i < this.optionArr.length; i++) {
                if (this.optionArr[i] === activeStr) {
                    this.currentActiveIndex = i;
                    break;
                }
            }
            this.activeButton.classList.add('toolspace-row-button-activated');
            this.updateButton();
        } else {
            this.isActive = false;
            this.activeButton.classList.remove('toolspace-row-button-activated');
        }
    }

    getActive(): TToolType {
        return this.optionArr[this.currentActiveIndex];
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
