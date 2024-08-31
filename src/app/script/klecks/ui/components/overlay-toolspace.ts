import { BB } from '../../../bb/bb';
import { KlColorSliderSmall } from './kl-color-slider-small';
import { KlSlider } from './kl-slider';
import { BrushSettingService, TBrushSettingEmit } from '../../brushes-ui/brush-setting-service';
import { LANG } from '../../../language/language';
import { IRGB } from '../../kl-types';
import { IVector2D } from '../../../bb/bb-types';

/**
 * Compressed HUD toolspace. When you hold ctrl+alt.
 * small color picker, brush settings
 */
export class OverlayToolspace {
    private readonly rootEl: HTMLElement;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        brushSettingService: BrushSettingService; // to sync with outside
        enabledTest: () => boolean; // calls to see if it's allowed to show
    }) {
        const sizeObj = {
            width: 150,
            svHeight: 90,
            hHeight: 20,
            sliderHeight: 25,
        };

        let isVisible = false;
        this.rootEl = BB.el({
            className: 'kl-overlay-toolspace',
        });
        const queuedObj: {
            color: IRGB | null;
            size: number | null;
            opacity: number | null;
        } = {
            color: null,
            size: null,
            opacity: null,
        };

        // --- inputs ---

        //color selection
        const colorEl = BB.el({
            parent: this.rootEl,
            className: 'kl-overlay-toolspace__color',
        });
        const colorSlider = new KlColorSliderSmall({
            width: sizeObj.width,
            heightSV: sizeObj.svHeight,
            heightH: sizeObj.hHeight,
            color: p.brushSettingService.getColor(),
            callback: (rgbObj: IRGB) => {
                selectedColorEl.style.backgroundColor =
                    'rgb(' + rgbObj.r + ',' + rgbObj.g + ',' + rgbObj.b + ')';
                p.brushSettingService.setColor(rgbObj, subscriptionFunc);
            },
        });
        const selectedColorEl = BB.el({
            css: {
                width: sizeObj.width + 'px',
                height: sizeObj.hHeight + 'px',
                pointerEvents: 'none',
            },
        });
        {
            const initialColor = p.brushSettingService.getColor();
            selectedColorEl.style.backgroundColor =
                'rgb(' + initialColor.r + ',' + initialColor.g + ',' + initialColor.b + ')';
        }

        colorEl.append(selectedColorEl, colorSlider.getElement());

        const updateColor = (rgbObj: IRGB) => {
            colorSlider.setColor(rgbObj);
            selectedColorEl.style.backgroundColor =
                'rgb(' + rgbObj.r + ',' + rgbObj.g + ',' + rgbObj.b + ')';
        };

        //brushsize slider

        const sizeSlider = new KlSlider({
            label: LANG('brush-size'),
            width: sizeObj.width,
            height: sizeObj.sliderHeight,
            min: 0,
            max: 500,
            value: 50,
            resolution: 225,
            eventResMs: 1000 / 30,
            toDisplayValue: (val) => val * 2,
            toValue: (displayValue) => displayValue / 2,
            onChange: (v) => {
                p.brushSettingService.setSize(v);
            },
            formatFunc: (displayValue) => {
                if (displayValue < 10) {
                    return BB.round(displayValue, 1);
                } else {
                    return Math.round(displayValue);
                }
            },
        });
        BB.css(sizeSlider.getElement(), {
            marginTop: '2px',
        });

        const opacitySlider = new KlSlider({
            label: LANG('opacity'),
            width: sizeObj.width,
            height: sizeObj.sliderHeight,
            min: 0,
            max: 1,
            value: 1,
            resolution: 225,
            eventResMs: 1000 / 30,
            toDisplayValue: (val) => val * 100,
            toValue: (displayValue) => displayValue / 100,
            onChange: (v) => {
                p.brushSettingService.setOpacity(v);
            },
        });
        BB.css(opacitySlider.getElement(), {
            margin: '2px 0',
        });
        this.rootEl.append(sizeSlider.getElement(), opacitySlider.getElement());

        // --- general setup ---

        const subscriptionFunc = (event: TBrushSettingEmit) => {
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

        const updateUI = () => {
            // unfocus manual slider input
            BB.unfocusAnyInput();

            this.rootEl.style.display = isVisible ? 'block' : 'none';
            if (isVisible && mousePos) {
                BB.css(this.rootEl, {
                    left: mousePos.x - Math.round(sizeObj.width / 2) + 'px',
                    top:
                        mousePos.y -
                        Math.round(sizeObj.svHeight + (sizeObj.hHeight * 3) / 2) +
                        'px',
                });
            }
        };

        let mousePos: IVector2D | null = null;
        document.addEventListener(
            'pointermove',
            (event) => {
                mousePos = {
                    x: event.pageX,
                    y: event.pageY,
                };
            },
            { passive: false },
        );

        const keyListener = new BB.KeyListener({
            onDown: (keyStr, event, comboStr, isRepeat) => {
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
            onUp: (keyStr, event, oldComboStr) => {
                if (
                    ['ctrl+alt', 'cmd+alt', 'alt+ctrl', 'alt+cmd'].includes(oldComboStr) &&
                    isVisible
                ) {
                    isVisible = false;
                    colorSlider.end();
                    updateUI();
                }
            },
            onBlur: () => {
                if (isVisible) {
                    isVisible = false;
                    colorSlider.end();
                    updateUI();
                }
            },
        });
    }

    // ---- interface ----
    getElement(): HTMLElement {
        return this.rootEl;
    }
}
