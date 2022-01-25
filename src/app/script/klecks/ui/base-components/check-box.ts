import {BB} from '../../../bb/bb';

/**
 * CHECKBOX - with label
 * params = {
 *      init: false,
 *      label: "blabla"
 *      callback: myfunc(boolean),
 *      allowTab: boolean, // default false
 *      title?: string,
 *      doHighlight?: boolean,
 * }
 *
 * @param params
 * @returns {HTMLLabelElement}
 */
export const checkBox = function (params) {
    const div = BB.el({
        className: 'kl-checkbox'
    });

    const innerEl = BB.el({
        parent: div,
        tagName: 'label',
        className: 'kl-checkbox__inner'
    });

    const check = BB.el({
        parent: innerEl,
        tagName: 'input',
        css: {
            marginLeft: '0',
            display: 'inline-block'
        },
        custom: {
            type: 'checkbox'
        }
    }) as HTMLInputElement;
    check.checked = params.init;
    if (params.doHighlight && check.checked) {
        BB.addClassName(div, 'kl-checkbox--highlight');
    }
    if(!params.allowTab) {
        check.tabIndex = -1;
    }

    if (params.title) {
        innerEl.title = params.title;
    }

    const label = document.createElement('div');
    label.style.display = 'inline-block';
    label.innerHTML = params.label;
    (label as any).allowClick = true;
    innerEl.appendChild(label);

    check.onchange = function () {
        if (params.doHighlight) {
            if (check.checked) {
                BB.addClassName(div, 'kl-checkbox--highlight');
            } else {
                BB.removeClassName(div, 'kl-checkbox--highlight');
            }
        }
        params.callback(check.checked);
        setTimeout(function() {
            check.blur();
        }, 0);
    };
    if(params.css) {
        BB.css(div, params.css);
    }

    (div as any).getValue = function() {
        return check.checked;
    };

    return div;
};