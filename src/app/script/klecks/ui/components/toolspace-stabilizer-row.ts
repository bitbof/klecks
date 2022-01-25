import {BB} from '../../../bb/bb';
import {Select} from '../base-components/select';

/**
 * Ui to select stabilizer level. 4 options. returned as 0-3
 *
 * p = {
 *     smoothing: number, // initial level 0-3
 *     onSelect: function(level number) // 0-3, when level changes
 * }
 *
 * @param p
 * @constructor
 */
export function ToolspaceStabilizerRow(p) {

    let div = BB.el({
        tagName: 'label',
        content: 'Stabilizer&nbsp;',
        title: 'Line Stabilizer',
        css: {
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            color: 'rgba(0,0,0,0.6)'
        }
    });

    let strengthSelect = new Select({
        optionArr: [
            [0, '0'],
            [1, '1'],
            [2, '2'],
            [3, '3'],
            [4, '4'],
            [5, '5']
        ],
        initValue: p.smoothing,
        onChange: function(val) {
            p.onSelect(val);
        }
    });
    div.appendChild(strengthSelect.getElement());

    let pointerListener = new BB.PointerListener({
        target: div,
        onWheel: function(e) {
            strengthSelect.setDeltaValue(e.deltaY);
        }
    });


    // --- interface ---
    this.getElement = function() {
        return div;
    };
}