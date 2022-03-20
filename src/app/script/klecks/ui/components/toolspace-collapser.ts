import {BB} from '../../../bb/bb';
// @ts-ignore
import collapseImg from 'url:~/src/app/img/ui/ui-collapse.svg';
import {LANG} from "../../../language/language";

/**
 * button that allows to collapse toolspace (for mobile)
 *
 * p = {
 *     onChange: function()
 * }
 *
 * @param p
 * @constructor
 */
export function ToolspaceCollapser(p) {
    let isOpen = true;
    let directionStr = 'right'; // 'left' | 'right'

    function update() {
        if (directionStr === 'left') {
            icon.style.transform = isOpen ? 'rotate(180deg)' : '';
        } else {
            icon.style.transform = isOpen ? '' : 'rotate(180deg)';
        }
    }

    let div = BB.el({
        css: {
            width: '36px',
            height: '36px',
            background: 'rgba(100, 100, 100, 0.9)',
            color: '#fff',
            position: 'absolute',
            top: '0',
            textAlign: 'center',
            lineHeight: '36px',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '6px',
            boxSizing: 'border-box'
        },
        title: LANG('toggle-show-tools'),
        onClick: function(e) {
            e.preventDefault();
            isOpen = !isOpen;
            update();
            p.onChange();
        }
    });

    let icon = BB.el({
        parent: div,
        css: {
            backgroundImage: `url(${collapseImg})`,
            width: '100%',
            height: '100%',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            userSelect: 'none'
        }
    });
    div.oncontextmenu = function () {
        return false;
    };

    // --- interface ---
    this.isOpen = function() {
        return isOpen;
    };

    /**
     *
     * @param dirStr
     */
    this.setDirection = function(dirStr) {
        directionStr = dirStr;
        update();
    };

    this.getElement = function() {
        return div;
    };
}