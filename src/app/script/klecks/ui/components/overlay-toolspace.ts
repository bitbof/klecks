import {BB} from '../../../bb/bb';
import {KlSmallColorSlider} from '../base-components/kl-color-slider-small';
import {KlSlider} from '../base-components/kl-slider';
import {BrushSettingService} from '../../brushes-ui/brush-setting-service';
import {LANG} from '../../../language/language';

/**
 * Compressed HUD toolspace. When you hold ctrl+alt.
 * small color picker, brush settings
 *
 * @param p
 * @constructor
 */
export function OverlayToolspace(
    p: {
        brushSettingService: BrushSettingService; // to sync with outside
        enabledTest: () => boolean; // calls to see if it's allowed to show
    }
) {

    const sizeObj = {
        width: 150,
        svHeight: 90,
        hHeight: 20,
        sliderHeight: 25
    };

    let isVisible = false;
    const div = BB.el({
        css: {
            position: 'absolute',
            left: '500px',
            top: '500px',
            background: 'rgb(221, 221, 221)',
            display: 'none',
            border: '1px solid #fff',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            colorScheme: 'only light',
        }
    });
    const queuedObj = {
        color: null,
        size: null,
        opacity: null
    };


    // --- inputs ---

    //color selection
    const colorSlider = new KlSmallColorSlider({
        width: sizeObj.width,
        heightSV: sizeObj.svHeight,
        heightH: sizeObj.hHeight,
        color: p.brushSettingService.getColor(),
        callback: function (rgbObj) {
            selectedColorEl.style.backgroundColor = "rgb(" + rgbObj.r + "," + rgbObj.g + "," + rgbObj.b + ")";
            p.brushSettingService.setColor(rgbObj, subscriptionFunc);
        }
    });
    const selectedColorEl = BB.el({
        css: {
            width: sizeObj.width + 'px',
            height: sizeObj.hHeight + 'px',
            pointerEvents: 'none'
        }
    });
    {
        const initialColor = p.brushSettingService.getColor();
        selectedColorEl.style.backgroundColor = "rgb(" + initialColor.r + "," + initialColor.g + "," + initialColor.b + ")";
    }

    div.appendChild(selectedColorEl);
    div.appendChild(colorSlider.getElement());


    function updateColor(rgbObj) {
        colorSlider.setColor(rgbObj);
        selectedColorEl.style.backgroundColor = "rgb(" + rgbObj.r + "," + rgbObj.g + "," + rgbObj.b + ")";
    }





    //brushsize slider

    const sizeSlider = new KlSlider({
        label: LANG('brush-size'),
        width: sizeObj.width,
        height: sizeObj.sliderHeight,
        min: 0,
        max: 500,
        initValue: 50,
        resolution: 225,
        eventResMs: 1000 / 30,
        onChange: function(v) {
            p.brushSettingService.setSize(v);
        },
        formatFunc: function(v) {
            if (v * 2 < 10) {
                return Math.round(v * 2 * 10) / 10;
            }
            return Math.round(v * 2);
        }
    });
    BB.css(sizeSlider.getElement(), {
        marginTop: '2px'
    });
    div.appendChild(sizeSlider.getElement());

    const opacitySlider = new KlSlider({
        label: LANG('opacity'),
        width: sizeObj.width,
        height: sizeObj.sliderHeight,
        min: 0,
        max: 1,
        initValue: 1,
        resolution: 225,
        eventResMs: 1000 / 30,
        onChange: function(v) {
            p.brushSettingService.setOpacity(v);
        },
        formatFunc: function(v) {
            return Math.round(v * 100);
        }
    });
    BB.css(opacitySlider.getElement(), {
        margin: '2px 0'
    });
    div.appendChild(opacitySlider.getElement());



    // --- general setup ---

    const subscriptionFunc = function(event) {
        if (event.type === 'color') {
            if (!isVisible) {
                queuedObj.color = event.value;
            } else {
                updateColor(event.value);
            }
        }
        if (event.type === 'size') {
            if (!isVisible) {
                queuedObj.size = event.value;
            } else {
                sizeSlider.setValue(event.value);
            }
        }
        if (event.type === 'opacity') {
            if (!isVisible) {
                queuedObj.opacity = event.value;
            } else {
                opacitySlider.setValue(event.value);
            }
        }
        if (event.type === 'sliderConfig') {
            sizeSlider.update(event.value.sizeSlider);
            opacitySlider.update(event.value.opacitySlider);
        }
    };
    p.brushSettingService.subscribe(subscriptionFunc);
    {
        const sliderConfig = p.brushSettingService.getSliderConfig();
        sizeSlider.update(sliderConfig.sizeSlider);
        opacitySlider.update(sliderConfig.opacitySlider);
        sizeSlider.setValue(p.brushSettingService.getSize());
        opacitySlider.setValue(p.brushSettingService.getOpacity());
    }

    function updateUI() {
        div.style.display = isVisible ? 'block' : 'none';
        if (isVisible && mousePos) {
            div.style.left = (mousePos.x - Math.round(sizeObj.width / 2)) + 'px';
            div.style.top = (mousePos.y - Math.round(sizeObj.svHeight + sizeObj.hHeight * 3 / 2)) + 'px';
        }
    }

    let mousePos = null;
    BB.addEventListener(document, 'pointermove', function(event) {
        mousePos = {
            x: event.pageX,
            y: event.pageY,
        };
    });

    const keyListener = new BB.KeyListener({
        onDown: function(keyStr, event, comboStr, isRepeat) {
            if (isRepeat) {
                return;
            }
            if (isVisible) {
                isVisible = false;
                updateUI();
                return;
            }

            if (!p.enabledTest() || !mousePos) {
                return;
            }

            if (['ctrl+alt', 'cmd+alt', 'alt+ctrl', 'alt+cmd'].includes(comboStr)) {
                event.preventDefault();
                isVisible = true;

                if (queuedObj.color !== null) {
                    updateColor(queuedObj.color);
                    queuedObj.color = null;
                }
                if (queuedObj.size !== null) {
                    sizeSlider.setValue(queuedObj.size);
                    queuedObj.size = null;
                }
                if (queuedObj.opacity !== null) {
                    opacitySlider.setValue(queuedObj.opacity);
                    queuedObj.opacity = null;
                }

                updateUI();
            }

        },
        onUp: function(keyStr, event, oldComboStr) {
            if (['ctrl+alt', 'cmd+alt', 'alt+ctrl', 'alt+cmd'].includes(oldComboStr) && isVisible) {
                isVisible = false;
                colorSlider.end();
                updateUI();
            }
        },
        onBlur: function() {
            if (isVisible) {
                isVisible = false;
                colorSlider.end();
                updateUI();
            }
        }
    });

    // --- interface ---
    this.getElement = function() {
        return div;
    };

}