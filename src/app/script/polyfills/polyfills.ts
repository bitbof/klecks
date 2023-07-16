import './polyfills-nomodule';

/*
 * ---- Below ----------------------
 * features that didn't have support until *after* browsers supported the modules script tag:
 * Chrome 61
 * Edge 16
 * Safari 11
 * Firefox 60
 * https://caniuse.com/es6-module
 */

// chrome 61, edge 79, safari 16, firefox 107
if (!('scrollTo' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollTo', {
        value: function (x: number, y: number) {
            this.scrollLeft = x;
            this.scrollTop = y;
        },
    });
}

// chrome 61, edge 79, safari 16, firefox 107
if (!('scrollBy' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollBy', {
        value: function (x: number, y: number) {
            this.scrollLeft += x;
            this.scrollTop += y;
        },
    });
}

// chrome 69, edge 79, safari 12, firefox 62
if (!Array.prototype.flat) {
    Object.defineProperty(Array.prototype, 'flat', {
        configurable: true,
        value: function flat (...args: any[]) {
            const depth = isNaN(args[0]) ? 1 : Number(args[0]);

            return depth ? Array.prototype.reduce.call(this, function (acc: any, cur) {
                if (Array.isArray(cur)) {
                    // eslint-disable-next-line prefer-spread
                    acc.push.apply(acc, flat.call(cur, depth - 1));
                } else {
                    acc.push(cur);
                }

                return acc;
            }, []) : Array.prototype.slice.call(this);
        },
        writable: true,
    });
}

// sometimes Android WebView has no localStorage
if (!('localStorage' in window)) {
    try {
        (window as any).localStorage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        };
    } catch (e) {
        // maybe it fails?
    }
}
