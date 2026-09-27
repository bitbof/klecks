import { getIconSvg } from '../../icon/icon';
import { BB } from '../../bb/bb';
import { BRUSHES } from '../brushes/brushes';
import { EVENT_RES_MS } from './brushes-consts';
import { Checkbox } from '../ui/components/checkbox';
import { KlSlider } from '../ui/components/kl-slider';
import { createPenPressureToggle } from '../ui/components/create-pen-pressure-toggle';
import { TBrushUi } from '../kl-types';
import { LANG, LANGUAGE_STRINGS } from '../../language/language';
import { Options } from '../ui/components/options';
import { PixelBrush, TPixelBrushTip } from '../brushes/pixel-brush';
import { getPixelDiscHalfWidths } from '../brushes/pixel-brush-disc';
import {
    DEFAULT_PIXEL_PATTERNS,
    loadCustomPixelPatterns,
    saveCustomPixelPatterns,
    TPixelPattern,
} from '../brushes/pixel-brush-patterns';
import { PixelPatternPicker } from '../ui/components/pixel-pattern-picker';
import { showPixelPatternDialog } from '../ui/modals/show-pixel-pattern-dialog';
import { showError } from '../ui/modals/base/show-modal';

function createTipPreview(tip: TPixelBrushTip): HTMLElement {
    // drawn at 1x, displayed at 3x -> crisp pixels. odd scale, so it can be centered in odd sized option
    const size = 7;
    const scale = 3;
    const canvas = BB.canvas(size, size);
    const ctx = BB.ctx(canvas);
    if (tip === 'round') {
        getPixelDiscHalfWidths(size).forEach((halfWidth, y) => {
            ctx.fillRect(size / 2 - halfWidth, y, halfWidth * 2, 1);
        });
    } else {
        ctx.fillRect(0, 0, size, size);
    }
    return BB.el({
        className: 'dark-invert',
        css: {
            // option size stays the same (35)
            width: size * scale,
            height: size * scale,
            margin: 7,
            backgroundImage: 'url(' + canvas.toDataURL('image/png') + ')',
            backgroundSize: `${size * scale}px ${size * scale}px`,
            imageRendering: 'pixelated',
        },
    });
}

export const pixelBrushUi = (function () {
    const brushInterface = {
        image: getIconSvg('brush-pixel'),
        tooltip: LANG('brush-pixel'),
        sizeSlider: {
            min: 0.5,
            max: 100,
            curve: BB.powerSplineInput(0.5, 100, 0.1),
        },
        opacitySlider: {
            min: 1 / 100,
            max: 1,
            curve: [
                [0, 1 / 100],
                [0.5, 0.3],
                [1, 1],
            ],
        },
    } as TBrushUi<PixelBrush>;

    LANGUAGE_STRINGS.subscribe(() => {
        brushInterface.tooltip = LANG('brush-pixel');
    });

    brushInterface.Ui = function (p) {
        const div = document.createElement('div'); // the gui
        const brush = new BRUSHES.PixelBrush();
        brush.setHistory(p.klHistory);
        p.onSizeChange(brush.getSize());
        let sizeSlider: KlSlider;
        let opacitySlider: KlSlider;

        const tipOptions = new Options<TPixelBrushTip>({
            optionArr: (['round', 'square'] as const).map((tip) => ({
                id: tip,
                label: createTipPreview(tip),
                title: LANG(tip === 'round' ? 'brush-pen-circle' : 'brush-pen-square'),
            })),
            initId: brush.getTip(),
            onChange: (tip) => {
                brush.setTip(tip);
                p.onConfigChange();
            },
            css: { marginTop: 10 },
        });

        const lockAlphaToggle = new Checkbox({
            init: brush.getLockAlpha(),
            label: LANG('lock-alpha'),
            callback: function (b) {
                brush.setLockAlpha(b);
            },
            doHighlight: true,
            title: LANG('lock-alpha-title'),
            name: 'lock-alpha-toggle',
        });

        const eraserToggle = new Checkbox({
            init: brush.getIsEraser(),
            label: LANG('eraser'),
            callback: function (b) {
                brush.setIsEraser(b);
            },
            name: 'eraser-toggle',
        });

        // patterns: defaults + the user's own. Identified by index, custom ones come after defaults.
        let customPatterns: TPixelPattern[] = loadCustomPixelPatterns();
        const getPatterns = (): TPixelPattern[] => [...DEFAULT_PIXEL_PATTERNS, ...customPatterns];
        const selectPattern = (index: number): void => {
            brush.setPattern(getPatterns()[index]);
        };
        const updateCustomPatterns = (patterns: TPixelPattern[], selectedIndex: number): void => {
            customPatterns = patterns;
            saveCustomPixelPatterns(customPatterns);
            patternPicker.setPatterns(getPatterns(), selectedIndex);
            selectPattern(selectedIndex);
        };
        const patternPicker = new PixelPatternPicker({
            patterns: getPatterns(),
            selectedIndex: 0, // solid
            onSelect: selectPattern,
            onClickSelected: (index) => {
                const customIndex = index - DEFAULT_PIXEL_PATTERNS.length;
                if (customIndex < 0) {
                    showError(LANG('brush-pixel-pattern-edit-default-error'));
                    return;
                }
                showPixelPatternDialog({
                    pattern: customPatterns[customIndex],
                    onOk: (pattern) => {
                        updateCustomPatterns(
                            customPatterns.map((item, i) => (i === customIndex ? pattern : item)),
                            index,
                        );
                    },
                    onDelete: () => {
                        updateCustomPatterns(
                            customPatterns.filter((_, i) => i !== customIndex),
                            0, // solid
                        );
                    },
                });
            },
            onAdd: () => {
                showPixelPatternDialog({
                    // new patterns start fully filled
                    pattern: { width: 4, height: 4, data: new Array<number>(16).fill(1) },
                    onOk: (pattern) => {
                        const patterns = [...customPatterns, pattern];
                        updateCustomPatterns(
                            patterns,
                            DEFAULT_PIXEL_PATTERNS.length + patterns.length - 1,
                        );
                    },
                });
            },
            css: { marginTop: 10 },
        });

        const spacingSpline = new BB.SplineInterpolator([
            [0.5, 0.45],
            [100, 4],
        ]);

        function setSize(size: number) {
            brush.setSize(size);
            brush.setSpacing(spacingSpline.interpolate(size) / size);
        }

        function init() {
            sizeSlider = new KlSlider({
                label: LANG('brush-size'),
                width: 225,
                height: 30,
                min: brushInterface.sizeSlider.min,
                max: brushInterface.sizeSlider.max,
                value: brush.getSize(),
                curve: brushInterface.sizeSlider.curve,
                eventResMs: EVENT_RES_MS,
                toDisplayValue: (val) => val * 2,
                toValue: (displayValue) => displayValue / 2,
                onChange: (val) => {
                    setSize(val);
                    p.onSizeChange(val);
                },
            });
            opacitySlider = new KlSlider({
                label: LANG('opacity'),
                width: 225,
                height: 30,
                min: brushInterface.opacitySlider.min,
                max: brushInterface.opacitySlider.max,
                value: brushInterface.opacitySlider.max,
                eventResMs: EVENT_RES_MS,
                toDisplayValue: (val) => val * 100,
                toValue: (displayValue) => displayValue / 100,
                onChange: (val) => {
                    brush.setOpacity(val);
                    p.onOpacityChange(val);
                },
            });

            const pressureSizeToggle = createPenPressureToggle(true, function (b) {
                brush.sizePressure(b);
            });

            div.append(
                BB.el({
                    content: [sizeSlider.getElement(), pressureSizeToggle],
                    css: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                    },
                }),
                opacitySlider.getElement(),
                tipOptions.getElement(),
                patternPicker.getElement(),
            );

            const toggleRow = BB.el({
                parent: div,
                css: {
                    display: 'flex',
                    marginTop: 10,
                    gap: 10,
                    flexWrap: 'wrap',
                },
            });

            toggleRow.append(lockAlphaToggle.getElement(), eraserToggle.getElement());
        }

        init();

        this.increaseSize = function (f) {
            if (!brush.isDrawing()) {
                sizeSlider.changeSliderValue(f);
            }
        };
        this.decreaseSize = function (f) {
            if (!brush.isDrawing()) {
                sizeSlider.changeSliderValue(-f);
            }
        };

        this.getSize = function () {
            return brush.getSize();
        };
        this.setSize = function (size) {
            setSize(size);
            sizeSlider.setValue(size * 2);
        };
        this.getOpacity = function () {
            return brush.getOpacity();
        };
        this.setOpacity = function (opacity) {
            brush.setOpacity(opacity);
            opacitySlider.setValue(opacity * 100);
        };

        this.setColor = function (c) {
            brush.setColor(c);
        };
        this.setLayer = function (layer) {
            brush.setContext(layer.context);
        };
        this.startLine = function (x, y, p) {
            brush.startLine(x, y, p);
        };
        this.goLine = function (x, y, p) {
            brush.goLine(x, y, p);
        };
        this.endLine = function () {
            brush.endLine();
        };
        this.getBrush = function () {
            return brush;
        };
        this.isDrawing = function () {
            return brush.isDrawing();
        };
        this.toggleEraser = () => {
            eraserToggle.setValue(!eraserToggle.getValue());
            brush.setIsEraser(eraserToggle.getValue());
        };
        this.getElement = function () {
            return div;
        };
    } as TBrushUi<PixelBrush>['Ui'];
    return brushInterface;
})();
