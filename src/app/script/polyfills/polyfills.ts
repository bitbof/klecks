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
        value: function flat(...args: any[]) {
            const depth = isNaN(args[0]) ? 1 : Number(args[0]);

            return depth
                ? Array.prototype.reduce.call(
                      this,
                      function (acc: any, cur) {
                          if (Array.isArray(cur)) {
                              // eslint-disable-next-line prefer-spread
                              acc.push.apply(acc, flat.call(cur, depth - 1));
                          } else {
                              acc.push(cur);
                          }

                          return acc;
                      },
                      [],
                  )
                : Array.prototype.slice.call(this);
        },
        writable: true,
    });
}

// Chrome 85, Firefox 77, Safari 13.1
// if there are problems, maybe use core-js
if (!String.prototype.replaceAll) {
    Object.defineProperty(String.prototype, 'replaceAll', {
        value: function (searchValue: string | RegExp, replaceValue: string): string {
            if (typeof replaceValue === 'function') {
                throw new Error('replaceAll polyfill does not support replaceValue: function');
            }
            return this.replace(new RegExp(searchValue, 'g'), replaceValue);
        },
    });
}

// Chrome 92, Firefox 90, Safari 15.4
if (!('at' in Array.prototype)) {
    Object.defineProperty(Array.prototype, 'at', {
        value: function (index: number) {
            if (index > 0) {
                return this[index];
            }
            if (index < 0) {
                return this[index + this.length];
            }
        },
    });
}

/*
    Copyright 2018  Alfredo Mungo <alfredo.mungo@protonmail.ch>

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to
    deal in the Software without restriction, including without limitation the
    rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
    sell copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
    IN THE SOFTWARE.
*/
if (!Object.fromEntries) {
    Object.defineProperty(Object, 'fromEntries', {
        value(entries: any) {
            if (!entries || !entries[Symbol.iterator]) {
                throw new Error('Object.fromEntries() requires a single iterable argument');
            }
            const o: any = {};
            Object.keys(entries).forEach((key) => {
                const [k, v] = entries[key];
                o[k] = v;
            });
            return o;
        },
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
