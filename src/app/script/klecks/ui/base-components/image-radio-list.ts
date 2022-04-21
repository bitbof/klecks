import {BB} from '../../../bb/bb';
import {ImageToggle} from './image-toggle';

/**
 * Radio input group. each one has an image
 *
 * p = {
 *     optionArr: {
 *         id: string,
 *         title: string,
 *         image: string,
 *     }[],
 *     initId: string,
 *     sizePx: number,
 *     onChange: function(id: string): void
 * }
 *
 * @param p
 */
export const ImageRadioList = function(p) {

    const div = BB.el({
        className: 'image-radio-wrapper',
        css: {
            display: 'flex'
        }
    });

    let activeIndex;
    const optionArr = [];

    function select(index, id) {
        activeIndex = index;
        for (let i = 0; i < optionArr.length; i++) {
            optionArr[i].setValue(i === activeIndex);
        }
        p.onChange(id);
    }

    function createOption(index, o) {
        if (o.id === p.initId) {
            activeIndex = index;
        }
        const radioEl = new ImageToggle({
            image: o.image,
            title: o.title,
            initValue: o.id === p.initId,
            isRadio: true,
            onChange: function() {
                select(index, o.id);
            }
        });
        div.appendChild(radioEl.getElement());

        return radioEl;

    }

    for (let i = 0; i < p.optionArr.length; i++) {
        optionArr.push(createOption(i, p.optionArr[i]));
    }


    // --- interface ---
    this.getElement = function() {
        return div;
    };
    this.getValue = function() {
        return p.optionArr[activeIndex].id;
    };
    this.destroy = () => {
        optionArr.forEach(item => {
            item.destroy();
        })
    };
};