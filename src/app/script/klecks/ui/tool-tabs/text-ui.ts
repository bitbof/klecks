import {BB} from '../../../bb/bb';
import {LANG} from '../../../language/language';

/**
 * Text Tool tab contents (color slider)
 *
 * p = {
 *     colorSlider: KlColorSlider// when opening tab, inserts it (snatches it from where else it was)
 * }
 *
 * @param p
 * @constructor
 */
export function TextUi(p) {
    let div = BB.el({
        css: {
            margin: '10px'
        }
    });
    let isVisible = true;

    let colorDiv = BB.el({
        parent: div,
        css: {
            marginBottom: '10px'
        }
    });

    let hint = BB.el({
        parent: div,
        content: LANG('text-instruction'),
    });


    // --- interface ---

    this.getElement = function() {
        return div;
    };

    this.setIsVisible = function(pIsVisible) {
        isVisible = !!pIsVisible;
        div.style.display = isVisible ? 'block' : 'none';
        if (isVisible) {
            colorDiv.appendChild(p.colorSlider.getElement());
            colorDiv.appendChild(p.colorSlider.getOutputElement());
            //update();
        }
    };

}