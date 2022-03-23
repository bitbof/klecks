import {BB} from '../../../bb/bb';
import {KlSlider} from '../base-components/kl-slider';
import {Select} from '../base-components/select';
import {Checkbox} from '../base-components/checkbox';
import {LANG} from '../../../language/language';

/**
 * Paint Bucket tab contents (color slider, opacity slider, etc)
 *
 * p = {
 *     colorSlider: KlColorSlider// when opening tab, inserts it (snatches it from where else it was)
 * }
 *
 * @param p
 * @constructor
 */
export function FillUi(p) {
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

    let opacitySlider = new KlSlider({
        label: LANG('opacity'),
        width: 250,
        height: 30,
        min: 0,
        max: 1,
        initValue: 1,
        onChange: function (val) {
        },
        formatFunc: function(v) {
            return Math.round(v * 100);
        }
    });
    div.appendChild(opacitySlider.getElement());

    let toleranceSlider = new KlSlider({
        label: LANG('bucket-tolerance'),
        width: 250,
        height: 30,
        min: 0,
        max: 255,
        initValue: 255 / 100 * 20,
        onChange: function (val) {
        },
        formatFunc: function(v) {
            return Math.round(v / 255 * 100);
        }
    });
    BB.css(toleranceSlider.getElement(), {
        marginTop: '10px'
    });
    div.appendChild(toleranceSlider.getElement());

    let selectRow = BB.el({
        parent: div,
        css: {
            display: 'flex',
            marginTop: '10px'
        }
    });

    let modeWrapper;
    let modeSelect;
    modeWrapper = BB.el({
        content: LANG('bucket-sample') + '&nbsp;',
        title: LANG('bucket-sample-title'),
        css: {
            fontSize: '15px'
        }
    });
    modeSelect = new Select({
        optionArr: [
            ['all', LANG('bucket-sample-all')],
            ['current', LANG('bucket-sample-active')],
            ['above', LANG('bucket-sample-above')]
        ],
        initValue: 'all',
        onChange: function(val) {}
    });
    let modePointerListener = new BB.PointerListener({
        target: modeSelect.getElement(),
        onWheel: function(e) {
            modeSelect.setDeltaValue(e.deltaY);
        }
    });
    modeWrapper.appendChild(modeSelect.getElement());
    selectRow.appendChild(modeWrapper);

    let growWrapper;
    let growSelect;
    growWrapper = BB.el({
        content: LANG('bucket-grow') + '&nbsp;',
        title: LANG('bucket-grow-title'),
        css: {
            fontSize: '15px',
            marginLeft: '10px'
        }
    });
    growSelect = new Select({
        optionArr: [
            ['0', '0'],
            ['1', '1'],
            ['2', '2'],
            ['3', '3'],
            ['4', '4'],
            ['5', '5'],
            ['6', '6'],
            ['7', '7'],
        ],
        initValue: '0',
        onChange: function(val) {}
    });
    let growPointerListener = new BB.PointerListener({
        target: growSelect.getElement(),
        onWheel: function(e) {
            growSelect.setDeltaValue(e.deltaY);
        }
    });
    growWrapper.appendChild(growSelect.getElement());
    selectRow.appendChild(growWrapper);


    let isContiguous = true;
    let contiguousToggle = new Checkbox({
        init: true,
        label: LANG('bucket-contiguous'),
        title: LANG('bucket-contiguous-title'),
        callback: function (b) {
            isContiguous = b;
        },
        css: {
            marginTop: '10px',
            paddingRight: '5px',
            display: 'inline-block',
        }
    });
    div.appendChild(contiguousToggle.getElement());




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
        }
    };

    this.getTolerance = function() {
        return toleranceSlider.getValue();
    };

    this.getOpacity = function() {
        return opacitySlider.getValue();
    };

    /**
     * returns string 'current' | 'all' | 'above'
     */
    this.getSample = function() {
        return modeSelect.getValue();
    };

    this.getGrow = function() {
        return parseInt(growSelect.getValue(), 10);
    }

    this.getContiguous = function() {
        return isContiguous;
    };

}