import { BB } from '../../../bb/bb';
import { Options } from '../components/options';
import { Checkbox } from '../components/checkbox';
import { KlSlider } from '../components/kl-slider';
import { LANG } from '../../../language/language';
import { TShapeToolMode, TShapeToolType } from '../../kl-types';
import { KlColorSlider } from '../components/kl-color-slider';

/**
 * Shape Tool tab contents
 */
export class ShapeUi {
    private readonly rootEl: HTMLElement;
    private isVisible: boolean;
    private readonly colorDiv: HTMLElement;
    private readonly colorSlider: KlColorSlider;
    private shape: TShapeToolType = 'rect';
    private mode: TShapeToolMode = 'stroke';
    private readonly eraserToggle: Checkbox;
    private readonly opacitySlider: KlSlider;
    private readonly lineWidthSlider: KlSlider;
    private readonly outwardsToggle: Checkbox;
    private readonly fixedToggle: Checkbox;
    private readonly snapToggle: Checkbox;
    private readonly lockAlphaToggle: Checkbox;

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        colorSlider: KlColorSlider; // when opening tab, inserts it (snatches it from where else it was)
    }) {
        this.rootEl = BB.el({
            css: {
                margin: '10px',
            },
        });
        this.isVisible = true;

        this.colorDiv = BB.el({
            parent: this.rootEl,
            css: {
                marginBottom: '10px',
            },
        });

        this.colorSlider = p.colorSlider;

        const previewSize = 35;
        const previewPadding = 8;

        const rectStrokeSvgRect = BB.createSvg({
            elementType: 'rect',
            x: '' + previewPadding,
            width: '' + (previewSize - previewPadding * 2),
        });
        const rectStrokeSvg = BB.createSvg({
            elementType: 'svg',
            width: '' + previewSize,
            height: '' + previewSize,
        });
        rectStrokeSvg.classList.add('dark-invert');
        rectStrokeSvg.append(rectStrokeSvgRect);
        BB.css(rectStrokeSvg, {
            display: 'block',
        });

        const rectFilledSvgRect = BB.createSvg({
            elementType: 'rect',
            x: '' + previewPadding,
            width: '' + (previewSize - previewPadding * 2),
        });
        const rectFilledSvg = BB.createSvg({
            elementType: 'svg',
            width: '' + previewSize,
            height: '' + previewSize,
        });
        rectFilledSvg.classList.add('dark-invert');
        rectFilledSvg.append(rectFilledSvgRect);
        BB.css(rectFilledSvg, {
            display: 'block',
        });

        const ellipseStrokeSvgEllipse = BB.createSvg({
            elementType: 'ellipse',
            cx: '' + previewSize / 2,
            cy: '' + previewSize / 2,
            rx: '' + (previewSize / 2 - previewPadding),
        });
        const ellipseStrokeSvg = BB.createSvg({
            elementType: 'svg',
            width: '' + previewSize,
            height: '' + previewSize,
        });
        ellipseStrokeSvg.classList.add('dark-invert');
        ellipseStrokeSvg.append(ellipseStrokeSvgEllipse);
        BB.css(ellipseStrokeSvg, {
            display: 'block',
        });

        const ellipseFilledSvgEllipse = BB.createSvg({
            elementType: 'ellipse',
            cx: '' + previewSize / 2,
            cy: '' + previewSize / 2,
            rx: '' + (previewSize / 2 - previewPadding),
        });
        const ellipseFilledSvg = BB.createSvg({
            elementType: 'svg',
            width: '' + previewSize,
            height: '' + previewSize,
        });
        ellipseFilledSvg.classList.add('dark-invert');
        ellipseFilledSvg.append(ellipseFilledSvgEllipse);
        BB.css(ellipseFilledSvg, {
            display: 'block',
        });

        const lineSvgLine = BB.createSvg({
            elementType: 'line',
            x1: '' + previewPadding,
            x2: '' + (previewSize - previewPadding),
        });
        const lineSvg = BB.createSvg({
            elementType: 'svg',
            width: '' + previewSize,
            height: '' + previewSize,
        });
        lineSvg.classList.add('dark-invert');
        lineSvg.append(lineSvgLine);
        BB.css(lineSvg, {
            display: 'block',
        });

        const updatePreviews = () => {
            const strokeWidth =
                BB.clamp(Math.round(this.lineWidthSlider.getValue() / 10), 1, 10) + 'px';

            const squish = 1.35;

            BB.css(rectStrokeSvgRect, {
                fill: 'none',
                stroke: 'black',
                strokeWidth: strokeWidth,
            });
            BB.css(rectFilledSvgRect, { fill: 'black', stroke: 'none' });

            BB.css(ellipseStrokeSvgEllipse, {
                fill: 'none',
                stroke: 'black',
                strokeWidth: strokeWidth,
            });
            BB.css(ellipseFilledSvgEllipse, { fill: 'black', stroke: 'none' });

            BB.css(lineSvgLine, {
                fill: 'none',
                stroke: 'black',
                strokeWidth: strokeWidth,
            });

            if (this.fixedToggle.getValue()) {
                rectStrokeSvgRect.setAttribute('y', '' + previewPadding);
                rectStrokeSvgRect.setAttribute('height', '' + (previewSize - previewPadding * 2));
                rectFilledSvgRect.setAttribute('y', '' + previewPadding);
                rectFilledSvgRect.setAttribute('height', '' + (previewSize - previewPadding * 2));

                ellipseStrokeSvgEllipse.setAttribute('ry', '' + (previewSize / 2 - previewPadding));
                ellipseFilledSvgEllipse.setAttribute('ry', '' + (previewSize / 2 - previewPadding));
            } else {
                rectStrokeSvgRect.setAttribute('y', '' + previewPadding * squish);
                rectStrokeSvgRect.setAttribute(
                    'height',
                    '' + (previewSize - previewPadding * squish * 2),
                );
                rectFilledSvgRect.setAttribute('y', '' + previewPadding * squish);
                rectFilledSvgRect.setAttribute(
                    'height',
                    '' + (previewSize - previewPadding * squish * 2),
                );

                ellipseStrokeSvgEllipse.setAttribute(
                    'ry',
                    '' + (previewSize / 2 - previewPadding * squish),
                );
                ellipseFilledSvgEllipse.setAttribute(
                    'ry',
                    '' + (previewSize / 2 - previewPadding * squish),
                );
            }

            if (this.snapToggle.getValue()) {
                lineSvgLine.setAttribute('y1', '' + (previewSize - previewPadding));
                lineSvgLine.setAttribute('y2', '' + previewPadding);
            } else {
                lineSvgLine.setAttribute('y1', '' + (previewSize - previewPadding * squish));
                lineSvgLine.setAttribute('y2', '' + previewPadding * squish);
            }
        };

        const row1 = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
            },
        });

        const shapeOptions = new Options({
            optionArr: [
                {
                    id: 'rect-stroke',
                    label: rectStrokeSvg,
                    title: LANG('shape-rect') + ' ' + LANG('shape-stroke'),
                },
                {
                    id: 'ellipse-stroke',
                    label: ellipseStrokeSvg,
                    title: LANG('shape-ellipse') + ' ' + LANG('shape-stroke'),
                },
                {
                    id: 'line',
                    label: lineSvg,
                    title: LANG('shape-line'),
                },
                {
                    id: 'rect-fill',
                    label: rectFilledSvg,
                    title: LANG('shape-rect') + ' ' + LANG('shape-fill'),
                },
                {
                    id: 'ellipse-fill',
                    label: ellipseFilledSvg,
                    title: LANG('shape-ellipse') + ' ' + LANG('shape-fill'),
                },
            ],
            initId: this.shape + ' ' + this.mode,
            onChange: (id) => {
                const split = id.split('-');
                this.shape = split[0] as TShapeToolType;
                this.mode = split[1] as TShapeToolMode;

                BB.css(this.fixedToggle.getElement(), {
                    display: this.shape === 'line' ? 'none' : '',
                });
                BB.css(this.snapToggle.getElement(), {
                    display: this.shape === 'line' ? '' : 'none',
                });
                BB.css(this.lineWidthSlider.getElement(), {
                    display: this.shape !== 'line' && this.mode === 'fill' ? 'none' : '',
                });
            },
            changeOnInit: true,
        });
        shapeOptions.getElement().style.width = '120px';
        row1.append(shapeOptions.getElement());

        this.eraserToggle = new Checkbox({
            init: false,
            label: LANG('eraser'),
            callback: () => {
                updatePreviews();
            },
        });

        this.lockAlphaToggle = new Checkbox({
            init: false,
            label: LANG('lock-alpha'),
            title: LANG('lock-alpha-title'),
            doHighlight: true,
        });
        this.lockAlphaToggle.getElement().style.marginTop = '10px';

        row1.append(
            BB.el({
                content: [this.eraserToggle.getElement(), this.lockAlphaToggle.getElement()],
            }),
        );

        this.lineWidthSlider = new KlSlider({
            label: LANG('shape-line-width'),
            width: 250,
            height: 30,
            min: 1,
            max: 200,
            value: 4,
            curve: 'quadratic',
            onChange: () => {
                updatePreviews();
            },
        });
        BB.css(this.lineWidthSlider.getElement(), {
            marginTop: '10px',
        });
        this.rootEl.append(this.lineWidthSlider.getElement());

        this.opacitySlider = new KlSlider({
            label: LANG('opacity'),
            width: 250,
            height: 30,
            min: 1 / 100,
            max: 1,
            value: 1,
            toValue: (displayValue) => displayValue / 100,
            toDisplayValue: (value) => value * 100,
        });
        BB.css(this.opacitySlider.getElement(), {
            marginTop: '10px',
        });
        this.rootEl.append(this.opacitySlider.getElement());

        const row2 = BB.el({
            parent: this.rootEl,
            css: {
                display: 'flex',
                alignItems: 'center',
                marginTop: '10px',
            },
        });

        this.outwardsToggle = new Checkbox({
            init: false,
            label: LANG('shape-outwards'),
            css: {
                width: '50%',
                marginRight: '10px',
            },
        });
        row2.append(this.outwardsToggle.getElement());

        this.fixedToggle = new Checkbox({
            init: false,
            label: LANG('shape-fixed'),
            callback: () => {
                updatePreviews();
            },
            css: {
                flexGrow: '1',
            },
        });
        row2.append(this.fixedToggle.getElement());

        this.snapToggle = new Checkbox({
            init: false,
            label: LANG('angle-snap'),
            title: LANG('angle-snap-title'),
            callback: () => {
                updatePreviews();
            },
            css: {
                flexGrow: '1',
            },
        });
        row2.append(this.snapToggle.getElement());

        updatePreviews();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(pIsVisible: boolean): void {
        this.isVisible = !!pIsVisible;
        this.rootEl.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.colorDiv.append(this.colorSlider.getElement());
            this.colorDiv.append(this.colorSlider.getOutputElement());
            //update();
        }
    }

    getShape(): TShapeToolType {
        return this.shape;
    }

    getMode(): TShapeToolMode {
        return this.mode;
    }

    getIsEraser(): boolean {
        return this.eraserToggle.getValue();
    }

    getOpacity(): number {
        return this.opacitySlider.getValue();
    }

    getLineWidth(): number {
        return this.lineWidthSlider.getValue();
    }

    getIsOutwards(): boolean {
        return this.outwardsToggle.getValue();
    }

    getIsFixed(): boolean {
        return this.fixedToggle.getValue();
    }

    getIsSnap(): boolean {
        return this.snapToggle.getValue();
    }

    getDoLockAlpha(): boolean {
        return this.lockAlphaToggle.getValue();
    }
}
