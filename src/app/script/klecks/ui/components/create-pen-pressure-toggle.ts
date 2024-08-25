import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import iconImg from '/src/app/img/ui/brush-pressure.svg';
import { BoxToggle } from './box-toggle';

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
                width: '17px',
                height: '17px',
                backgroundImage: 'url("' + iconImg + '")',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                margin: '1px',
                borderRadius: '3px',
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
