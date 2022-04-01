import 'core-js';
import 'mdn-polyfills/Node.prototype.append';

if (!('scrollTo' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollTo', {
        value: function (x, y) {
            this.scrollLeft = x;
            this.scrollTop = y;
        }
    });
}