import { BB } from '../../../bb/bb';
import { SelectCustom } from './select-custom';
import { LANG } from '../../../language/language';
import { PointerListener } from '../../../bb/input/pointer-listener';

/**
 * Ui to select stabilizer level.
 */
export class ToolspaceStabilizerRow {
    private readonly rootEl: HTMLElement;
    private readonly pointerListener: PointerListener;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        smoothing: number; // initial level
        onSelect: (level: number) => void;
    }) {
        this.rootEl = BB.el({
            tagName: 'label',
            className: 'kl-stabilizer',
            content: LANG('stabilizer') + '&nbsp;',
            title: LANG('stabilizer-title'),
        });

        const strengthSelect = new SelectCustom({
            optionArr: [
                ['0', '0'],
                ['0.5', '0.5'],
                ['1', '1'],
                ['1.5', '1.5'],
                ['2', '2'],
                ['3', '3'],
                ['4', '4'],
                ['5', '5'],
            ],
            initValue: '' + p.smoothing,
            onChange: function (val) {
                p.onSelect(parseFloat(val));
            },
            name: 'stabilizer-strength',
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
