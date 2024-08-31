import { BB } from '../../../bb/bb';
import { Select } from './select';
import { LANG } from '../../../language/language';
import { PointerListener } from '../../../bb/input/pointer-listener';

/**
 * Ui to select stabilizer level. 4 options. returned as 0-3
 */
export class ToolspaceStabilizerRow {
    private readonly rootEl: HTMLElement;
    private readonly pointerListener: PointerListener;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        smoothing: number; // initial level [0,3]
        onSelect: (level: number) => void; // [0-3], when level changes
    }) {
        this.rootEl = BB.el({
            tagName: 'label',
            className: 'kl-stabilizer',
            content: LANG('stabilizer') + '&nbsp;',
            title: LANG('stabilizer-title'),
        });

        const strengthSelect = new Select({
            optionArr: [
                ['0', '0'],
                ['1', '1'],
                ['2', '2'],
                ['3', '3'],
                ['4', '4'],
                ['5', '5'],
            ],
            initValue: '' + p.smoothing,
            onChange: function (val) {
                p.onSelect(parseInt(val));
            },
        });
        this.rootEl.append(strengthSelect.getElement());

        this.pointerListener = new BB.PointerListener({
            target: this.rootEl,
            onWheel: function (e) {
                strengthSelect.setDeltaValue(e.deltaY);
            },
        });
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
