import { getIconUrl } from '../../../icon/icon';
import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { BoxToggle } from './box-toggle';

const iconImg = getIconUrl('brush-pressure');
/**
 * small toggle button with a pen icon - representing toggling pressure sensitivity
 * @param isChecked initial value
 * @param changeCallback called on change
 */
export const createPenPressureToggle = function (
    isChecked: boolean,
    changeCallback: (b: boolean) => void,
): HTMLElement {
    const toggleEl = new BoxToggle({
        label: BB.el({
            className: 'dark-invert',
            css: {
                width: 17,
                height: 17,
                backgroundImage: 'url("' + iconImg + '")',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                margin: 1,
                borderRadius: 3,
            },
        }),
        title: LANG('brush-toggle-pressure'),
        init: isChecked,
        onChange: (b) => {
            changeCallback(b);
        },
    });

    return toggleEl.getElement();
};
