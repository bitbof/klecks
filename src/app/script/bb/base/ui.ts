import { css } from './base';
import { BB } from '../bb';
import { IKeyStringOptional } from '../bb-types';

export function appendTextDiv(target: HTMLElement, text: string): HTMLDivElement {
    const div = document.createElement('div');
    div.innerHTML = text;
    target.append(div);
    return div;
}

/**
 * Is an input element focused.
 * Set attribute "data-ignore-focus" to "true" if its focus should be ignored.
 *
 * @param getAll - check all, even those with "data-ignore-focus" = "true"
 */
export function isInputFocused(getAll: boolean = false): boolean {
    const result: boolean =
        !!document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (getAll) {
        return result;
    } else {
        return result && !document.activeElement?.getAttribute('data-ignore-focus');
    }
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
                opacity: '0',
                width: '0',
                height: '0',
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

/**
 * prevents being able to focus element.
 * warning: it creates a listener
 *
 * @param el - dom element
 */
export const makeUnfocusable = (function (): (el: HTMLElement) => void {
    function preventFocus(event: FocusEvent): void {
        event.preventDefault();
        let didFocusRelated = false;
        if (event.relatedTarget) {
            try {
                (event.relatedTarget as HTMLElement).focus();
                didFocusRelated = true;
            } catch (e) {
                console.error('failed to focus');
            }
        }
        if (!didFocusRelated) {
            (event.currentTarget as HTMLElement).blur();
        }
    }

    return function (el) {
        el.setAttribute('tabindex', '-1');
        el.addEventListener('focus', preventFocus);
    };
})();

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
    css?: IKeyStringOptional;
    custom?: { [key: string]: string };
    content?: string | (HTMLElement | string | undefined)[] | Element;
    textContent?: string;
    className?: string;
    title?: string;
    id?: string;
    tagName?: GTag;
    onClick?: (e: Event) => void;
    onChange?: (e: Event) => void;
    noRef?: boolean; // don't keep references of listeners
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
        result.className = params.className;
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
