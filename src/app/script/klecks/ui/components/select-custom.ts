import { css } from '../../../bb/base/base';
import { BB } from '../../../bb/bb';
import { TCss } from '../../../bb/bb-types';
import * as classes from './select-custom.module.scss';

type TSelectItem<ValueType> = [ValueType, string] | [ValueType, string, { css: TCss }];

// A select with a DOM popup, independent of the browser's native select picker.
export class SelectCustom<ValueType extends string> {
    private readonly rootEl: HTMLButtonElement;
    private readonly labelEl: HTMLSpanElement;
    // ensures the input doesn't change size when changing the value
    private readonly sizeEl: HTMLSpanElement;
    private optionArr: (TSelectItem<ValueType> | undefined)[] = [];
    private value = '' as ValueType;
    private readonly isFocusable: boolean;
    private readonly onChange?: (val: ValueType) => void;
    private popupEl?: HTMLDivElement;
    private listEl?: HTMLDivElement;
    private optionEls: HTMLDivElement[] = [];
    private activeIndex = 0;
    private observer?: MutationObserver;
    private search = '';
    private searchTime = 0;
    private static nextId = 0;
    private readonly onDocumentPointerDown = (event: PointerEvent): void => {
        const target = event.target as Node | null;
        if (this.rootEl.contains(target) || this.popupEl?.contains(target)) {
            return;
        }
        this.close();
    };

    private getItems(): TSelectItem<ValueType>[] {
        return this.optionArr.filter((item): item is TSelectItem<ValueType> => !!item);
    }

    private update(): void {
        this.labelEl.textContent =
            this.getItems().find((item) => item[0] === this.value)?.[1] ?? '';
    }

    private updateSize(): void {
        this.sizeEl.replaceChildren(
            ...this.getItems().map((item) => {
                const el = document.createElement('span');
                el.textContent = item[1];
                return el;
            }),
        );
    }

    private readonly toggle = (): void => {
        if (this.popupEl) {
            this.close();
        } else {
            this.open();
        }
    };

    private readonly preventMouseFocus = (event: PointerEvent): void => {
        if (!this.isFocusable && event.pointerType !== 'touch') {
            event.preventDefault();
        }
    };

    private highlight(index: number, shouldScroll = false): void {
        this.activeIndex = BB.clamp(index, 0, this.optionEls.length - 1);
        this.optionEls.forEach((el, i) => {
            el.classList.toggle(classes.active, i === this.activeIndex);
        });
        const el = this.optionEls[this.activeIndex];
        if (el) {
            this.listEl?.setAttribute('aria-activedescendant', el.id);
            if (shouldScroll) {
                el.scrollIntoView?.({ block: 'nearest' });
            }
        }
    }

    private select(index: number): void {
        const item = this.getItems()[index];
        if (!item) {
            return;
        }
        const hasChanged = this.value !== item[0];
        hasChanged && this.setValue(item[0]);
        this.close();
        hasChanged && this.onChange?.(this.value);
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (!this.popupEl) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault();
                event.stopPropagation();
                this.open(true);
            }
            return;
        }
        // Keep popup keys away from drawing shortcuts and the parent dialog.
        event.stopImmediatePropagation();
        if (event.key === 'Tab') {
            this.close();
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        event.preventDefault();
        if (event.key === 'Escape') {
            this.close();
        } else if (event.key === 'Enter' || event.key === ' ') {
            this.select(this.activeIndex);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            this.highlight(this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1), true);
        } else if (event.key === 'Home' || event.key === 'End') {
            this.highlight(event.key === 'Home' ? 0 : this.optionEls.length - 1, true);
        } else if (event.key.length === 1) {
            const now = Date.now();
            this.search =
                (now - this.searchTime < 700 ? this.search : '') + event.key.toLocaleLowerCase();
            this.searchTime = now;
            const items = this.getItems();
            const index = items.findIndex((item) =>
                item[1].toLocaleLowerCase().startsWith(this.search),
            );
            if (index !== -1) {
                this.highlight(index, true);
            }
        }
    };

    private readonly reposition = (): void => {
        if (!this.rootEl.isConnected || !this.rootEl.getClientRects().length) {
            this.close(false);
            return;
        }
        if (!this.listEl) {
            return;
        }
        const rect = this.rootEl.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        const margin = 6;
        css(this.listEl, {
            minWidth: Math.min(rect.width, width - margin * 2),
            maxWidth: Math.max(0, width - margin * 2),
            maxHeight: Math.max(0, height - margin * 2),
        });
        const listRect = this.listEl.getBoundingClientRect();
        css(this.listEl, {
            left: Math.max(
                left + margin,
                Math.min(rect.left, left + width - listRect.width - margin),
            ),
            top: Math.max(
                top + margin,
                Math.min(
                    rect.bottom + listRect.height <= top + height - margin
                        ? rect.bottom
                        : rect.top - listRect.height,
                    top + height - listRect.height - margin,
                ),
            ),
        });
    };

    private open(shouldScroll = false): void {
        if (!this.getItems().length || !this.rootEl.isConnected) {
            return;
        }
        this.popupEl = BB.el({
            tagName: 'div',
            className: classes.overlay,
        });
        this.listEl = BB.el({
            tagName: 'div',
            className: classes.list,
            props: {
                tabIndex: -1,
                role: 'listbox',
                ariaLabel: this.rootEl.title || this.rootEl.name,
            },
        });
        this.listEl.id = `kl-select-custom-${SelectCustom.nextId++}`;
        this.rootEl.setAttribute('aria-controls', this.listEl.id);
        this.rootEl.setAttribute('aria-expanded', 'true');
        this.optionEls = [];
        for (const item of this.optionArr) {
            const el = BB.el({
                tagName: 'div',
                className: item ? classes.option : classes.separator,
                props: item
                    ? {
                          role: 'option',
                          ariaSelected: '' + (item[0] === this.value),
                      }
                    : { role: 'separator' },
            });
            if (item) {
                const index = this.optionEls.length;
                el.id = `${this.listEl.id}-${index}`;
                el.textContent = item[1];
                if (item[2]) {
                    css(el, item[2].css);
                }
                el.addEventListener('click', () => this.select(index));
                el.addEventListener('pointermove', (event) => {
                    if (event.pointerType !== 'touch') {
                        this.highlight(index);
                    }
                });
                this.optionEls.push(el);
            }
            this.listEl.append(el);
        }
        this.popupEl.append(this.listEl);
        this.popupEl.addEventListener('wheel', (event) => event.stopPropagation());
        document.body.append(this.popupEl);
        document.addEventListener('pointerdown', this.onDocumentPointerDown);
        this.reposition();
        if (!this.popupEl) {
            return;
        }
        this.listEl?.focus({ preventScroll: true });
        this.highlight(
            Math.max(
                0,
                this.getItems().findIndex((item) => item[0] === this.value),
            ),
            shouldScroll,
        );
        this.search = '';
        document.addEventListener('keydown', this.onKeyDown, true);
        window.addEventListener('resize', this.reposition);
        window.visualViewport?.addEventListener('resize', this.reposition);
        window.visualViewport?.addEventListener('scroll', this.reposition);
        this.observer = new MutationObserver(() => {
            if (!this.rootEl.isConnected) {
                this.close(false);
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    private close(restoreFocus = true): void {
        if (!this.popupEl) {
            return;
        }
        this.observer?.disconnect();
        document.removeEventListener('pointerdown', this.onDocumentPointerDown);
        document.removeEventListener('keydown', this.onKeyDown, true);
        window.removeEventListener('resize', this.reposition);
        window.visualViewport?.removeEventListener('resize', this.reposition);
        window.visualViewport?.removeEventListener('scroll', this.reposition);
        this.popupEl.remove();
        this.popupEl = undefined;
        this.listEl = undefined;
        this.optionEls = [];
        this.rootEl.setAttribute('aria-expanded', 'false');
        this.rootEl.removeAttribute('aria-controls');
        if (restoreFocus && this.isFocusable && this.rootEl.isConnected) {
            this.rootEl.focus({ preventScroll: true });
        } else {
            this.rootEl.blur();
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        isFocusable?: boolean;
        optionArr: (TSelectItem<ValueType> | undefined)[];
        initValue?: ValueType;
        onChange?: (val: ValueType) => void;
        css?: TCss;
        title?: string;
        name: string;
    }) {
        this.isFocusable = !!p.isFocusable;
        this.onChange = p.onChange;
        this.rootEl = BB.el({
            tagName: 'button',
            className: [classes.root, 'kl-focusable-element'],
            css: p.css,
            props: {
                type: 'button',
                name: p.name,
                title: p.title,
                ariaHasPopup: 'listbox',
                ariaExpanded: 'false',
                ...(this.isFocusable ? {} : { tabIndex: -1 }),
            },
        });
        this.labelEl = BB.el({
            tagName: 'span',
            parent: this.rootEl,
            className: classes.label,
        });
        this.sizeEl = BB.el({
            tagName: 'span',
            parent: this.rootEl,
            className: classes.size,
            props: {
                ariaHidden: 'true',
            },
        });
        this.optionArr = p.optionArr;
        this.updateSize();
        this.setValue(p.initValue);
        this.rootEl.addEventListener('click', this.toggle);
        this.rootEl.addEventListener('pointerdown', this.preventMouseFocus);
        this.rootEl.addEventListener('keydown', this.onKeyDown);
    }

    setValue(val: ValueType | undefined): void {
        this.value = this.getItems().some((item) => item[0] === val) ? val! : ('' as ValueType);
        this.update();
    }

    getValue(): ValueType {
        return this.value;
    }

    setDeltaValue(delta: number): void {
        const items = this.getItems();
        if (!items.length) {
            return;
        }
        const index = Math.max(
            0,
            items.findIndex((item) => item[0] === this.value),
        );
        this.setValue(items[Math.max(0, Math.min(items.length - 1, index + Math.trunc(delta)))][0]);
        this.onChange?.(this.value);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    updateLabel(id: ValueType, label: string): void {
        this.optionArr.forEach((item) => {
            if (item?.[0] === id) {
                item[1] = label;
            }
        });
        this.setOptionArr(this.optionArr);
    }

    setOptionArr(optionArr: (TSelectItem<ValueType> | undefined)[]): void {
        this.close();
        const oldValue = this.value;
        this.optionArr = optionArr;
        this.updateSize();
        this.setValue(
            oldValue === '' || this.getItems().some((item) => item[0] === oldValue)
                ? oldValue
                : this.getItems()[0]?.[0],
        );
    }

    destroy(): void {
        this.close(false);
        this.rootEl.removeEventListener('click', this.toggle);
        this.rootEl.removeEventListener('pointerdown', this.preventMouseFocus);
        this.rootEl.removeEventListener('keydown', this.onKeyDown);
    }
}
