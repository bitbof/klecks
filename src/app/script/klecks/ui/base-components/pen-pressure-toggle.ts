import {BB} from '../../../bb/bb';
// @ts-ignore
import iconImg from 'url:~/src/app/img/ui/brush-pressure.svg';
import {LANG} from '../../../language/language';


/**
 * small toggle button with a pen icon - representing toggling pressure sensitivity
 * @param isChecked - boolean - initial value
 * @param changeCallback - function(isChecked boolean) - called on change
 * @returns {HTMLElement} - the toggle button
 */
export const penPressureToggle = function(isChecked, changeCallback) {

    const toggleDiv = BB.el({
        css: {
            cssFloat: 'right',
            borderRadius: '3px',
            width: '18px',
            height: '18px',
            backgroundImage: 'url("' + iconImg + '")',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            cursor: 'pointer',
            boxSizing: 'border-box',
            colorScheme: 'only light',
        }
    });

    if (!BB.hasPointerEvents) {
        toggleDiv.style.display = 'none';
    }

    function redraw() {
        if (isChecked) {
            BB.css(toggleDiv, {
                backgroundColor: '#fff',
                opacity: '0.9',
                border: '1px solid var(--active-highlight-color)'
            });
        } else {
            BB.css(toggleDiv, {
                backgroundColor: 'transparent',
                opacity: '0.5',
                border: '1px solid #666'
            });
        }
    }

    toggleDiv.title = LANG('brush-toggle-pressure');
    toggleDiv.onclick = function() {
        isChecked = !isChecked;
        redraw();
        changeCallback(isChecked);
    };

    redraw();
    changeCallback(isChecked);

    return toggleDiv;
};