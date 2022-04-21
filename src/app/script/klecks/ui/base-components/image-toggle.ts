import {BB} from '../../../bb/bb';


/**
 * Toggle button with an image
 *
 * p = {
 *     initValue: boolean,
 *     title: string,
 *     isRadio: boolean, // if true, can't click when active
 *     onChange: function(boolean)
 * }
 *
 * @param p
 * @constructor
 */
export const ImageToggle = function(p) {
    let isActive = !!p.initValue;
    const div = BB.el({
        className: 'image-toggle',
        title: p.title,
        css: {
            backgroundImage: "url('" + p.image + "')"
        },
        onClick: function(e) {
            e.preventDefault();
            if (p.isRadio && isActive) {
                return;
            }
            isActive = !isActive;
            update();
            p.onChange(isActive);
        },
    });

    function update() {
        if (isActive) {
            BB.addClassName(div, 'image-toggle-active');
        } else {
            BB.removeClassName(div, 'image-toggle-active');
        }
    }

    update();

    // --- interface ---
    this.setValue = function(b) {
        isActive = !!b;
        update();
    };
    this.getElement = function() {
        return div;
    };
    this.getValue = function() {
        return isActive;
    };
    this.destroy = () => {
        BB.destroyEl(div);
    };

};