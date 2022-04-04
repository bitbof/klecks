import {BB} from '../../bb/bb';
import {eventResMs} from './brushes-consts';
import {Checkbox} from '../ui/base-components/checkbox';
import {brushes} from '../brushes/brushes';
import {klHistory} from '../history/kl-history';
import {KlSlider} from '../ui/base-components/kl-slider';
// @ts-ignore
import brushIconImg from 'url:~/src/app/img/ui/brush-chemy.svg';
import {IBrushUi} from '../kl.types';
import {Options} from '../ui/base-components/options';
import {BoxToggle} from '../ui/base-components/box-toggle';
import {LANG, languageStrings} from '../../language/language';

export const chemyBrushUi = (function () {
    const brushInterface: IBrushUi = {
        image: brushIconImg,
        tooltip: LANG('brush-chemy'),
        sizeSlider: {
            min: 0.25,
            max: 25,
            curve: BB.quadraticSplineInput(0.25, 25, 0.1),
            isDisabled: true,
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1
        },
        Ui: null,
    };

    languageStrings.subscribe(() => {
        brushInterface.tooltip = LANG('brush-chemy');
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement("div"); // the gui
        const brush = new brushes.ChemyBrush();
        brush.setHistory(klHistory);
        p.onSizeChange(brush.getSize());

        let sizeSlider;
        let opacitySlider;

        function setSize(size) {
            brush.setSize(size);
        }

        function init() {
            sizeSlider = new KlSlider({
                label: LANG('brush-size'),
                width: 250,
                height: 30,
                min: brushInterface.sizeSlider.min,
                max: brushInterface.sizeSlider.max,
                initValue: brush.getSize(),
                eventResMs: eventResMs,
                isEnabled: brush.getMode() === 'stroke',
                onChange: function (val) {
                    setSize(val);
                    p.onSizeChange(brush.getSize());
                },
                curve: brushInterface.sizeSlider.curve,
                formatFunc: function (v) {
                    v *= 2;
                    return v < 5 ? (Math.round(v * 10) / 10) : Math.round(v);
                }
            });
            opacitySlider = new KlSlider({
                label: LANG('opacity'),
                width: 250,
                height: 30,
                min: brushInterface.opacitySlider.min,
                max: brushInterface.opacitySlider.max,
                initValue: brush.getOpacity(),
                eventResMs: eventResMs,
                onChange: function (val) {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
                formatFunc: function(v) {
                    return Math.round(v * 100);
                }
            });

            BB.css(opacitySlider.getElement(), {
                marginTop: '10px',
            });

            let eraserToggle = new Checkbox({
                init: brush.getIsEraser(),
                label: LANG('eraser'),
                callback: function (b) {
                    brush.setIsEraser(b);
                },
                css: {
                    marginTop: '10px',
                    marginLeft: '10px',
                }
            });

            const lockAlphaToggle = new Checkbox({
                init: brush.getLockAlpha(),
                label: LANG('brush-lock-alpha'),
                callback: function (b) {
                    brush.setLockAlpha(b);
                },
                doHighlight: true,
                title: LANG('brush-lock-alpha-title'),
                css: {
                    marginTop: '10px',
                }
            });

            const toggleRow = BB.el({
                css: {
                    display: 'flex',
                    marginTop: '10px',
                }
            });

            const iconSize = 35;
            const padding = 8;
            const actualIconSize = iconSize - padding * 2;
            const halfSize = actualIconSize / 2;

            const modeOptions = new Options({
                optionArr: [
                    {
                        id: 'fill',
                        label: BB.createSvg({
                            elementType: 'svg',
                            width: iconSize + '',
                            height: iconSize + '',
                            childrenArr: [
                                {
                                    elementType: 'path',
                                    fill: '#000',
                                    style: `transform-origin: 0 0; transform: translate(-0.5px, -0.5px) scale(${actualIconSize}, ${actualIconSize}) translate(0.5px, 0.5px)`,
                                    d: 'M 0,0 C 1.5,0 -0.5,1 1,1',
                                },
                            ],
                        }),
                        title: LANG('brush-chemy-fill'),
                    },
                    {
                        id: 'stroke',
                        label: BB.createSvg({
                            elementType: 'svg',
                            width: iconSize + '',
                            height: iconSize + '',
                            childrenArr: [
                                {
                                    elementType: 'path',
                                    fill: 'none',
                                    stroke: '#000',
                                    style: `stroke-width: 0.12px; transform-origin: 0 0; transform: translate(-0.5px, -0.5px) scale(${actualIconSize}, ${actualIconSize}) translate(0.5px, 0.5px)`,
                                    d: 'M 0,0 C 1.5,0 -0.5,1 1,1',
                                },
                            ],
                        }),
                        title: LANG('brush-chemy-stroke'),
                    }
                ],
                initId: brush.getMode(),
                onChange: (id: string): void => {
                    brush.setMode(id as 'stroke' | 'fill');
                    brushInterface.sizeSlider.isDisabled = brush.getMode() === 'fill';
                    sizeSlider.setIsEnabled(!brushInterface.sizeSlider.isDisabled);
                    sizeSlider.setValue(brush.getSize());
                    p.onSizeChange(brush.getSize());
                    p.onConfigChange();
                }
            });

            const mirrorXToggle = new BoxToggle({
                label: BB.createSvg({
                    elementType: 'svg',
                    width: iconSize + '',
                    height: iconSize + '',
                    childrenArr: [
                        {
                            elementType: 'path',
                            fill: 'none',
                            stroke: '#000',
                            style: 'stroke-width: 1px',
                            d: `M ${halfSize + padding},${padding} ${halfSize + padding},${actualIconSize + padding}`,
                        },
                    ]
                }),
                title: LANG('brush-chemy-mirror-x'),
                init: brush.getXSymmetry(),
                onChange: (b) => {
                    brush.setXSymmetry(b);
                },
            });

            const mirrorYToggle = new BoxToggle({
                label: BB.createSvg({
                    elementType: 'svg',
                    width: iconSize + '',
                    height: iconSize + '',
                    childrenArr: [
                        {
                            elementType: 'path',
                            fill: 'none',
                            stroke: '#000',
                            style: 'stroke-width: 1px',
                            d: `M ${padding},${halfSize + padding} ${actualIconSize + padding},${halfSize + padding}`,
                        },
                    ]
                }),
                title: LANG('brush-chemy-mirror-y'),
                init: brush.getYSymmetry(),
                onChange: (b) => {
                    brush.setYSymmetry(b);
                },
            });

            const gradientToggle = new BoxToggle({
                label: BB.createSvg({
                    elementType: 'svg',
                    width: iconSize + '',
                    height: iconSize + '',
                    childrenArr: [
                        {
                            elementType: 'defs',
                            childrenArr: [
                                {
                                    elementType: 'linearGradient',
                                    id: 'gradient',
                                    x1: '0',
                                    y1: '0',
                                    x2: '0',
                                    y2: '1',
                                    childrenArr: [
                                        {
                                            elementType: 'stop',
                                            offset: '0%',
                                            'stop-color': 'rgba(0,0,0,0)',
                                        },
                                        {
                                            elementType: 'stop',
                                            offset: '100%',
                                            'stop-color': 'rgba(0,0,0,1)',
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            elementType: 'rect',
                            fill: "url('#gradient')",
                            x: '' + padding,
                            y: '' + padding,
                            width: '' + actualIconSize,
                            height: '' + actualIconSize,
                        },
                    ]
                }),
                title: LANG('brush-chemy-gradient'),
                init: brush.getGradient(),
                onChange: (b) => {
                    brush.setGradient(b);
                },
            });

            BB.css(mirrorXToggle.getElement(), {
                marginLeft: '10px',
            });
            {
                const margin = {
                    marginLeft: '4px',
                };
                BB.css(mirrorYToggle.getElement(), margin);
                BB.css(gradientToggle.getElement(), margin);
            }

            toggleRow.append(
                modeOptions.getElement(),
                mirrorXToggle.getElement(),
                mirrorYToggle.getElement(),
                gradientToggle.getElement(),
            );

            div.append(
                sizeSlider.getElement(),
                opacitySlider.getElement(),
                toggleRow,
                BB.el({
                    content: [
                        lockAlphaToggle.getElement(),
                        eraserToggle.getElement(),
                    ],
                    css: {
                        display: 'flex',
                    }
                })
            );
        }

        init();

        this.increaseSize = function (f) {
            if (!brush.getIsDrawing() && brush.getMode() === 'stroke') {
                sizeSlider.increaseValue(f);
            }
        };
        this.decreaseSize = function (f) {
            if (!brush.getIsDrawing() && brush.getMode() === 'stroke') {
                sizeSlider.decreaseValue(f);
            }
        };

        this.getSize = function () {
            return brush.getSize();
        };
        this.setSize = function(size) {
            setSize(size);
            sizeSlider.setValue(size);
        };
        this.getOpacity = function () {
            return brush.getOpacity();
        };
        this.setOpacity = function(opacity) {
            brush.setOpacity(opacity);
            opacitySlider.setValue(opacity);
        };

        this.setColor = function (c) {
            brush.setColor(c);
        };
        this.setContext = function (c) {
            brush.setContext(c);
        };
        this.startLine = function (x, y, p) {
            brush.startLine(x, y);
        };
        this.goLine = function (x, y, p, isCoalesced) {
            brush.goLine(x, y);
        };
        this.endLine = function () {
            brush.endLine();
        };
        this.getBrush = function () {
            return brush;
        };
        this.isDrawing = function () {
            return brush.getIsDrawing();
        };
        this.getElement = function () {
            return div;
        };
    };

    return brushInterface;
})();