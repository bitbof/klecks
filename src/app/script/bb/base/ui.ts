import { css } from './base';
import { TCss } from '../bb-types';
import { BB } from '../bb';

export function appendTextDiv(target: HTMLElement, text: string): HTMLDivElement {
    const div = document.createElement('div');
    div.innerHTML = text;
    target.append(div);
    return div;
}

export const focusableElementClassName = 'kl-focusable-element';
/**
 * Is an input element focused.
 * Set attribute "data-ignore-focus" to "true" if its focus should be ignored.
 *
 * @param getAll - check all, even those with "data-ignore-focus" = "true"
 */
export function isInputFocused(getAll: boolean = false): boolean {
    const activeElement = document.activeElement;
    const result: boolean =
        !!activeElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) ||
            (activeElement.tagName === 'BUTTON' &&
                activeElement.classList.contains(focusableElementClassName)));

    return result && (getAll || !activeElement?.getAttribute('data-ignore-focus'));
}

export function unfocusAnyInput(): void {
    if (isInputFocused(true)) {
        /*
            Unfocus anything that is focused.

            If an Input is focused in Firefox, and it gets detached from the DOM via a Node
            that isn't its direct parent, then Firefox will keep anything attached to this
            Input in memory. It will not be garbage collected until a new Input is focused.

            Workaround: Temporarily create an input, focus it, detach it.
             */
        const focusEl = BB.el({
            parent: document.body,
            tagName: 'input',
            css: {
                opacity: 0,
                width: 0,
                height: 0,
            },
        });
        setTimeout(() => {
            focusEl.select();
            focusEl.focus();
            focusEl.remove();
        }, 10);
    }
}

/**
 * clears text selection in window
 */
export function clearSelection(): void {
    if (window.getSelection) {
        const sel = window.getSelection();
        if (sel) {
            if (sel.empty) {
                sel.empty();
            } else if (sel.removeAllRanges) {
                sel.removeAllRanges();
            }
        }
    }
}

const els: {
    el: HTMLElement;
    listeners: [keyof HTMLElementEventMap, EventListener][];
}[] = [];
// window['els'] = els;

/**
 *
 * Create DOM element - div by default
 * params = {
 * 	    parent: someOtherDiv,
 * 	    css: {
 * 		    width: "500px",
 * 		    backgroundColor: "#fff"
 * 	    },
 * 	    content: "test", //or  content: [divA, divB, divC]   or content: someDiv
 * 	    className: "bla",
 *      id: "bla"
 * }
 *
 *  If onClick or onChange is used, then BB.destroyEl MUST be called
 *  to prevent a memory leak.
 *
 * @param params
 */
export function el<GTag extends keyof HTMLElementTagNameMap = 'div'>(params?: {
    parent?: HTMLElement;
    css?: TCss;
    custom?: { [key: string]: string };
    content?: string | (HTMLElement | SVGSVGElement | string | undefined)[] | Element;
    textContent?: string;
    className?: string | string[];
    title?: string;
    id?: string;
    tagName?: GTag;
    onClick?: (e: Event) => void;
    onChange?: (e: Event) => void;
    // Don't keep references of listeners.
    // If false and has onClick/onChange handler, must call destroyEl.
    // default = false
    noRef?: boolean;
}) {
    if (!params) {
        return document.createElement('div') as HTMLElementTagNameMap[GTag];
    }
    const result = document.createElement(params.tagName ? params.tagName : 'div');
    params.css && css(result, params.css);

    if (params.content) {
        if (typeof params.content === typeof 'aa') {
            result.innerHTML = params.content as string;
        } else if (Array.isArray(params.content)) {
            BB.append(result, params.content);
        } else {
            result.append(params.content as HTMLElement);
        }
    }
    if (params.textContent) {
        result.textContent = params.textContent;
    }
    if (params.className) {
        result.className = Array.isArray(params.className)
            ? params.className.join(' ')
            : params.className;
    }
    if (params.id) {
        result.id = params.id;
    }
    if (params.parent) {
        params.parent.append(result);
    }
    if ('title' in params && params.title !== undefined) {
        result.title = params.title;
    }
    const listeners: [keyof HTMLElementEventMap, EventListener][] = [];
    if (params.onClick !== undefined) {
        result.addEventListener('click', params.onClick);
        !params.noRef && listeners.push(['click', params.onClick as EventListener]);
    }
    if (params.onChange !== undefined) {
        result.addEventListener('change', params.onChange);
        !params.noRef && listeners.push(['change', params.onChange]);
    }
    if (listeners.length > 0) {
        els.push({
            el: result,
            listeners,
        });
        /*div.style.backgroundColor = '#ff0';
        div.style.border = '1px solid #ff0';*/
    }
    if ('custom' in params && params.custom) {
        const customKeyArr = Object.keys(params.custom);
        for (let i = 0; i < customKeyArr.length; i++) {
            result.setAttribute(customKeyArr[i], params.custom[customKeyArr[i]]);
        }
    }
    return result as HTMLElementTagNameMap[GTag];
}

/**
 * removes event listeners for Elements created via el()
 * @param el
 */
export function destroyEl(el?: HTMLElement): void {
    if (!el) {
        return;
    }
    for (let i = 0; i < els.length; i++) {
        const item = els[i];
        if (item.el === el) {
            item.listeners.forEach((item) => {
                el.removeEventListener(item[0], item[1]);
            });
            els.splice(i, 1);
            return;
        }
    }
    // not found
    return;
}

export function createImage(p: {
    src?: string;
    alt?: string;
    width?: number;
    height?: number;
    className?: string;
    css?: TCss;
}): HTMLImageElement {
    const result = new Image();
    if (p.src !== undefined) {
        result.src = p.src;
    }
    if (p.alt !== undefined) {
        result.alt = p.alt;
    }
    if (p.width !== undefined) {
        result.width = p.width;
    }
    if (p.height !== undefined) {
        result.height = p.height;
    }
    if (p.className !== undefined) {
        result.className = p.className;
    }
    p.css && css(result, p.css);
    return result;
}

/**
 * Creates a monochrome element using any image URL as its CSS mask.
 * Transparent image pixels remain transparent; visible pixels use currentColor.
 */
export function createImageMask(imageUrl: string, styleObj?: TCss): HTMLDivElement {
    const result = document.createElement('div');
    const mask = `url("${imageUrl}") center / contain no-repeat`;
    result.style.setProperty('mask', mask);
    result.style.setProperty('-webkit-mask', mask);
    result.setAttribute('aria-hidden', 'true');
    css(result, {
        display: 'inline-block',
        width: '1em',
        height: '1em',
        backgroundColor: 'currentColor',
        ...styleObj,
    });
    return result;
}
