import {BB} from '../../../bb/bb';

/**
 * selectable options
 * p = {
 *     optionArr: {
 *          id: string,
 *          label: string | HTMLElement
 *     }[],
 *     initialId?: string,
 *     onChange: function(id string): void,
 *     changeOnInit?: boolean, // trigger change on creation
 * }
 *
 * @param p
 * @constructor
 */
export const Options = function(p) {
    const div = BB.el({});

    const wrapperEl = BB.el({
        parent: div,
        className: 'kl-option-wrapper',
        css: {
            display: 'flex'
        }
    });

    const optionArr: {
        id: string;
        el: HTMLElement;
    }[] = [];
    let selectedId = 'initialId' in p ? p.initialId : p.optionArr[0].id;

    function createOption(o) {
        const optionObj = {
            id: o.id,
            el: null,
        };

        const classArr = ['kl-option'];
        if (p.isSmall) {
            classArr.push('kl-option--small');
        }
        if (typeof o.label !== 'string') {
            classArr.push('kl-option--custom-el');
            BB.css(o.label, {
                display: 'block',
                pointerEvents: 'none',
            });
        }

        optionObj.el = BB.el({
            parent: wrapperEl,
            content: o.label,
            className: classArr.join(' '),
            onClick: function() {
                if (selectedId !== optionObj.id) {
                    selectedId = optionObj.id;
                    update();
                    p.onChange(selectedId);
                }
            }
        });

        if (o.title) {
            optionObj.el.title = o.title;
        }

        optionArr.push(optionObj);
    }

    function update() {
        for (let i = 0; i < optionArr.length; i++) {
            if (optionArr[i].id === selectedId) {
                BB.addClassName(optionArr[i].el, 'kl-option-selected');
            } else {
                BB.removeClassName(optionArr[i].el, 'kl-option-selected');
            }
        }
    }

    for (let i = 0; i < p.optionArr.length; i++) {
        createOption(p.optionArr[i]);
    }

    update();

    if (p.changeOnInit) {
        setTimeout(function() {
            p.onChange(selectedId);
        }, 0);
    }

    function getIndex() {
        for (let i = 0; i < optionArr.length; i++) {
            if (optionArr[i].id === selectedId) {
                return i;
            }
        }
    }

    // --- interface ---
    this.getElement = function() {
        return div;
    };
    this.getValue = function() {
        return selectedId;
    }
    this.next = function() {
        selectedId = optionArr[(getIndex() + 1) % optionArr.length].id;
        update();
        p.onChange(selectedId);
    };
    this.previous = function() {
        selectedId = optionArr[(optionArr.length + getIndex() - 1) % optionArr.length].id;
        update();
        p.onChange(selectedId);
    };
    this.destroy = () => {
        optionArr.forEach(item => {
            BB.destroyEl(item.el);
        });
        optionArr.splice(0, optionArr.length);
    };
};