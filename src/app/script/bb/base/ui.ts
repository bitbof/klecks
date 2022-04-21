import {addEventListener} from '../input/event-listener';
import {css} from './base';
import {BB} from '../bb';


export function appendTextDiv(target: HTMLElement, text: string): HTMLDivElement {
    const div = document.createElement('div');
    div.innerHTML = text;
    target.appendChild(div);
    return div;
}

/**
 * Is an input element focused.
 * Set attribute "data-ignore-focus" to "true" if its focus should be ignored.
 *
 * @param getAll - check all, even those with "data-ignore-focus" = "true"
 */
export function isInputFocused(getAll: boolean = false): boolean {
    let result = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (getAll) {
        return result;
    } else {
        return result && !document.activeElement.getAttribute('data-ignore-focus');
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
    } else if ('selection' in document) {
        (document as any).selection.empty();
    }
}

/**
 * prevents being able to focus element.
 * warning: it creates a listener
 *
 * @param el - dom element
 */
export const makeUnfocusable = (function() {

    function preventFocus(event: MouseEvent) {
        event.preventDefault();
        let didFocusRelated = false;
        if (event.relatedTarget) {
            try {
                (event.relatedTarget as HTMLElement).focus();
                didFocusRelated = true;
            } catch(e) {
                console.error('failed to focus');
            }
        }
        if (!didFocusRelated) {
            (event.currentTarget as HTMLElement).blur();
        }
    }

    return function(el) {
        el.setAttribute('tabindex', '-1');
        addEventListener(el, 'focus', preventFocus);
    };
})();


const els: {
    el: HTMLElement;
    listeners: [string, any][];
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
export function el(
    params: {
        parent?: HTMLElement,
        css?: { [key: string]: string },
        custom?: { [key: string]: any },
        content?: string | (HTMLElement | string | null)[] | HTMLElement | SVGElement,
        textContent?: string,
        className?: string,
        title?: string,
        id?: string,
        tagName?: string,
        onClick?: (e: Event) => void,
        onChange?: (e: Event) => void,
    }
): HTMLElement {
    const div = document.createElement(params.tagName ? params.tagName : 'div');
    if (params.css) {
        css(div, params.css);
    }

    if (params.content) {
        if (typeof params.content === typeof 'aa') {
            div.innerHTML = params.content as string;

        } else if (Array.isArray(params.content)) {
            BB.append(div, params.content);

        } else {
            div.appendChild(params.content as HTMLElement);

        }
    }
    if (params.textContent) {
        div.textContent = params.textContent;
    }
    if (params.className) {
        div.className = params.className;
    }
    if (params.id) {
        div.id = params.id;
    }
    if (params.parent) {
        params.parent.appendChild(div);
    }
    if ('title' in params && params.title !== undefined) {
        div.title = params.title;
    }
    const listeners = [];
    if ('onClick' in params) {
        addEventListener(div, 'click', params.onClick);
        listeners.push(['click', params.onClick]);
    }
    if ('onChange' in params) {
        addEventListener(div, 'change', params.onChange);
        listeners.push(['change', params.onChange]);
    }
    if (listeners.length > 0) {
        els.push({
            el: div,
            listeners: listeners,
        })
        /*div.style.backgroundColor = '#ff0';
        div.style.border = '1px solid #ff0';*/
    }
    if ('custom' in params) {
        const customKeyArr = Object.keys(params.custom);
        for (let i = 0; i < customKeyArr.length; i++) {
            div.setAttribute(customKeyArr[i], params.custom[customKeyArr[i]]);
        }
    }
    return div;
}

/**
 * removes event listeners for Elements created via el()
 * @param el
 */
export function destroyEl(el: HTMLElement) {
    for (let i = 0; i < els.length; i++) {
        const item = els[i];
        if (item.el === el) {
            item.listeners.forEach(item => {
                el.removeEventListener(item[0], item[1]);
            });
            els.splice(i, 1);
            return;
        }
    }
    // not found
    return;
}
