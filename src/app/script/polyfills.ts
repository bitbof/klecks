// import 'core-js';
import 'mdn-polyfills/Node.prototype.append';
import 'mdn-polyfills/Node.prototype.prepend';
import 'mdn-polyfills/String.prototype.padStart';

if (!('scrollTo' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollTo', {
        value: function (x, y) {
            this.scrollLeft = x;
            this.scrollTop = y;
        }
    });
}

if (!('scrollBy' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollBy', {
        value: function (x, y) {
            this.scrollLeft += x;
            this.scrollTop += y;
        }
    });
}

// sometimes Android WebView has no localStorage
if (!('localStorage' in window)) {
    try {
        window['localStorage'] = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        } as any;
    } catch (e) {
        // maybe it doesn't let me set this
    }
}