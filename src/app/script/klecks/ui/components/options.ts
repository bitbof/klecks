import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';
import { TCss } from '../../../bb/bb-types';
import * as classes from './options.module.scss';

/**
 * selectable options
 */
export class Options<IdType> {
    private readonly rootEl: HTMLElement;
    private readonly wrapperEl: HTMLElement;
    private readonly isFocusable: boolean;
    private selectedId: IdType;
    private readonly optionArr: {
        id: IdType;
        el: HTMLButtonElement;
    }[];
    private readonly onChange: ((id: IdType) => void) | undefined;
    private readonly onBeforeChange: ((id: IdType) => boolean) | undefined;
    private readonly keydownListener: ((event: KeyboardEvent) => void) | undefined;

    private getIndex(): number {
        for (let i = 0; i < this.optionArr.length; i++) {
            if (this.optionArr[i].id === this.selectedId) {
                return i;
            }
        }
        return -1;
    }

    private update(): void {
        for (let i = 0; i < this.optionArr.length; i++) {
            const isSelected = this.optionArr[i].id === this.selectedId;
            this.optionArr[i].el.setAttribute('aria-checked', '' + isSelected);
            this.optionArr[i].el.tabIndex = this.isFocusable && isSelected ? 0 : -1;
        }
    }

    private selectValue(val: IdType, skipEmit?: boolean): boolean {
        if (this.selectedId === val) {
            return true;
        }
        if (this.onBeforeChange && !this.onBeforeChange(val)) {
            return false;
        }
        this.selectedId = val;
        this.update();
        !skipEmit && this.onChange && this.onChange(this.selectedId);
        return true;
    }

    private focusSelected(): void {
        const index = this.getIndex();
        if (index > -1) {
            this.optionArr[index].el.focus();
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        optionArr: {
            id: IdType;
            label?: string | HTMLElement | SVGElement;
            title?: string;
            ariaLabel?: string;
            css?: TCss;
        }[];
        initId?: IdType;
        onChange?: (id: IdType) => void;
        onClickSelected?: (id: IdType) => void;
        /** before the change happens, check if you allow it. true -> yes */
        onBeforeChange?: (id: IdType) => boolean;
        changeOnInit?: boolean; // trigger change on creation
        isFocusable?: boolean; // default false
        ariaLabel?: string;
        isSmall?: boolean;
        optionCss?: TCss;
        isColumn?: boolean; // displayed as column. default row
        css?: TCss;
    }) {
        this.rootEl = BB.el({ css: p.css });
        this.isFocusable = !!p.isFocusable;

        this.wrapperEl = BB.el({
            parent: this.rootEl,
            className: classes.wrapper,
            custom: {
                role: 'radiogroup',
                'aria-orientation': p.isColumn ? 'vertical' : 'horizontal',
                ...(p.ariaLabel ? { 'aria-label': p.ariaLabel } : {}),
            },
            css: {
                display: 'flex',
                flexDirection: p.isColumn ? 'column' : 'row',
            },
        });

        this.onChange = p.onChange;
        this.onBeforeChange = p.onBeforeChange;
        this.optionArr = [];
        this.selectedId = p.initId !== undefined ? p.initId : p.optionArr[0].id;

        const createOption = (o: {
            id: IdType;
            label?: string | HTMLElement | SVGElement;
            title?: string;
            ariaLabel?: string;
            css?: TCss;
        }) => {
            const classArr = [classes.option];
            if (p.isSmall) {
                classArr.push(classes.small);
            }
            if (o.label && typeof o.label !== 'string') {
                classArr.push(classes.customEl);
                css(o.label, {
                    display: 'block',
                    pointerEvents: 'none',
                });
            }

            const ariaLabel =
                o.ariaLabel ?? (o.title && typeof o.label !== 'string' ? o.title : undefined);

            const optionObj = {
                id: o.id,
                el: BB.el({
                    parent: this.wrapperEl,
                    tagName: 'button',
                    content: o.label ?? '',
                    className: classArr.join(' '),
                    onClick: () => {
                        if (this.selectedId === optionObj.id) {
                            p.onClickSelected?.(optionObj.id);
                        } else {
                            this.selectValue(optionObj.id);
                        }
                        if (this.isFocusable) {
                            this.focusSelected();
                        }
                    },
                    css: {
                        ...p.optionCss,
                        ...o.css,
                    },
                    custom: {
                        // per default would be "submit"
                        type: 'button',
                        role: 'radio',
                        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
                    },
                }),
            };

            if (o.title) {
                optionObj.el.title = o.title;
            }

            this.optionArr.push(optionObj);
        };

        for (let i = 0; i < p.optionArr.length; i++) {
            createOption(p.optionArr[i]);
        }

        if (this.isFocusable) {
            this.keydownListener = (event: KeyboardEvent): void => {
                let nextIndex: number | undefined;
                const currentIndex = this.getIndex();
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    nextIndex = (currentIndex + 1) % this.optionArr.length;
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    nextIndex = (this.optionArr.length + currentIndex - 1) % this.optionArr.length;
                } else if (event.key === 'Home') {
                    nextIndex = 0;
                } else if (event.key === 'End') {
                    nextIndex = this.optionArr.length - 1;
                } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                    event.stopPropagation();
                    return;
                } else {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                this.selectValue(this.optionArr[nextIndex].id);
                this.focusSelected();
            };
            this.wrapperEl.addEventListener('keydown', this.keydownListener);
        }
        this.update();

        if (p.changeOnInit) {
            setTimeout(() => {
                this.onChange && this.onChange(this.selectedId);
            }, 0);
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getValue(): IdType {
        return this.selectedId;
    }

    next(): void {
        this.setValue(this.optionArr[(this.getIndex() + 1) % this.optionArr.length].id);
    }

    setValue(val: IdType, skipEmit?: boolean): void {
        this.selectValue(val, skipEmit);
    }

    updateOption(
        id: IdType,
        p: {
            title?: string;
            ariaLabel?: string;
            css?: TCss;
        },
    ): void {
        const option = this.optionArr.find((item) => item.id === id);
        if (!option) {
            return;
        }
        if (p.title !== undefined) {
            option.el.title = p.title;
        }
        if (p.ariaLabel !== undefined) {
            option.el.setAttribute('aria-label', p.ariaLabel);
        }
        if (p.css) {
            css(option.el, p.css);
        }
    }

    previous(): void {
        this.setValue(
            this.optionArr[(this.optionArr.length + this.getIndex() - 1) % this.optionArr.length]
                .id,
        );
    }

    destroy(): void {
        if (this.keydownListener) {
            this.wrapperEl.removeEventListener('keydown', this.keydownListener);
        }
        this.rootEl.remove();
        this.optionArr.forEach((item) => {
            BB.destroyEl(item.el);
        });
        this.optionArr.splice(0, this.optionArr.length);
    }
}
