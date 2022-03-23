import {BB} from '../../../bb/bb';
import {Options} from '../base-components/options';
import {Checkbox} from '../base-components/checkbox';
import {KlSlider} from '../base-components/kl-slider';
import {LANG} from '../../../language/language';

/**
 * Shape Tool tab contents
 *
 * p = {
 *     colorSlider: KlColorSlider// when opening tab, inserts it (snatches it from where else it was)
 * }
 *
 * @param p
 * @constructor
 */
export function ShapeUi(p) {
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

    let previewSize = 35;
    let previewPadding = 8;
    let shape; // 'rect'|'ellipse'|'line'
    let mode; // 'stroke'|'fill'


    let rectStrokeSvgRect = BB.createSvg({
        elementType: 'rect',
        x: '' + previewPadding,
        width: '' + (previewSize - previewPadding * 2)
    });
    let rectStrokeSvg = BB.createSvg({
        elementType: 'svg',
        width: '' + previewSize,
        height: '' + previewSize
    });
    rectStrokeSvg.appendChild(rectStrokeSvgRect);
    BB.css(rectStrokeSvg, {
        display: 'block'
    });

    let rectFilledSvgRect = BB.createSvg({
        elementType: 'rect',
        x: '' + previewPadding,
        width: '' + (previewSize - previewPadding * 2)
    });
    let rectFilledSvg = BB.createSvg({
        elementType: 'svg',
        width: '' + previewSize,
        height: '' + previewSize
    });
    rectFilledSvg.appendChild(rectFilledSvgRect);
    BB.css(rectFilledSvg, {
        display: 'block'
    });


    let ellipseStrokeSvgEllipse = BB.createSvg({
        elementType: 'ellipse',
        cx: '' + (previewSize / 2),
        cy: '' + (previewSize / 2),
        rx: '' + (previewSize / 2 - previewPadding)
    });
    let ellipseStrokeSvg = BB.createSvg({
        elementType: 'svg',
        width: '' + previewSize,
        height: '' + previewSize,
    });
    ellipseStrokeSvg.appendChild(ellipseStrokeSvgEllipse);
    BB.css(ellipseStrokeSvg, {
        display: 'block'
    });

    let ellipseFilledSvgEllipse = BB.createSvg({
        elementType: 'ellipse',
        cx: '' + (previewSize / 2),
        cy: '' + (previewSize / 2),
        rx: '' + (previewSize / 2 - previewPadding)
    });
    let ellipseFilledSvg = BB.createSvg({
        elementType: 'svg',
        width: '' + previewSize,
        height: '' + previewSize,
    });
    ellipseFilledSvg.appendChild(ellipseFilledSvgEllipse);
    BB.css(ellipseFilledSvg, {
        display: 'block'
    });


    let lineSvgLine = BB.createSvg({
        elementType: 'line',
        x1: '' + previewPadding,
        x2: '' + (previewSize - previewPadding)
    });
    let lineSvg = BB.createSvg({
        elementType: 'svg',
        width: '' + previewSize,
        height: '' + previewSize
    });
    lineSvg.appendChild(lineSvgLine);
    BB.css(lineSvg, {
        display: 'block'
    });

    function updatePreviews() {
        let strokeWidth = BB.clamp(Math.round(lineWidthSlider.getValue() / 10), 1, 10) + 'px';

        let squish = 1.35;

        BB.css(rectStrokeSvgRect, { fill: 'none', stroke: 'black', strokeWidth: strokeWidth });
        BB.css(rectFilledSvgRect, { fill: 'black', stroke: 'none' });

        BB.css(ellipseStrokeSvgEllipse, { fill: 'none', stroke: 'black', strokeWidth: strokeWidth });
        BB.css(ellipseFilledSvgEllipse, { fill: 'black', stroke: 'none' });

        BB.css(
            lineSvgLine,
            { fill: 'none', stroke: 'black', strokeWidth: strokeWidth }
        );

        if ((fixedToggle as any).getValue()) {
            rectStrokeSvgRect.setAttribute('y', '' + previewPadding);
            rectStrokeSvgRect.setAttribute('height', '' + (previewSize - previewPadding * 2));
            rectFilledSvgRect.setAttribute('y', '' + previewPadding);
            rectFilledSvgRect.setAttribute('height', '' + (previewSize - previewPadding * 2));

            ellipseStrokeSvgEllipse.setAttribute('ry', '' + (previewSize / 2 - previewPadding));
            ellipseFilledSvgEllipse.setAttribute('ry', '' + (previewSize / 2 - previewPadding));
        } else {
            rectStrokeSvgRect.setAttribute('y', '' + (previewPadding * squish));
            rectStrokeSvgRect.setAttribute('height', '' + (previewSize - previewPadding * squish * 2));
            rectFilledSvgRect.setAttribute('y', '' + (previewPadding * squish));
            rectFilledSvgRect.setAttribute('height', '' + (previewSize - previewPadding * squish * 2));

            ellipseStrokeSvgEllipse.setAttribute('ry', '' + (previewSize / 2 - previewPadding * squish));
            ellipseFilledSvgEllipse.setAttribute('ry', '' + (previewSize / 2 - previewPadding * squish));
        }

        if ((snapToggle as any).getValue()) {
            lineSvgLine.setAttribute('y1', '' + (previewSize - previewPadding));
            lineSvgLine.setAttribute('y2', '' + previewPadding);
        } else {
            lineSvgLine.setAttribute('y1', '' + (previewSize - previewPadding * squish));
            lineSvgLine.setAttribute('y2', '' + (previewPadding * squish));
        }
    }

    let row1 = BB.el({
        parent: div,
        css: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start'
        }
    });

    let shapeOptions = new Options({
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
        initId: 'rect',
        onChange: function(id) {
            let split = id.split('-');
            shape = split[0];
            mode = split[1];

            BB.css(fixedToggle.getElement(), {
                display: shape === 'line' ? 'none' : null
            });
            BB.css(snapToggle.getElement(), {
                display: shape === 'line' ? null : 'none'
            });
            BB.css(lineWidthSlider.getElement(), {
                display: (shape !== 'line' && mode === 'fill') ? 'none' : null
            });
        },
        changeOnInit: true
    });
    shapeOptions.getElement().style.width = '120px';
    row1.appendChild(shapeOptions.getElement());

    let eraserToggle = new Checkbox({
        init: false,
        label: LANG('eraser'),
        callback: function(b) {
            updatePreviews();
        }
    });
    row1.appendChild(eraserToggle.getElement());

    let lineWidthSlider = new KlSlider({
        label: LANG('shape-line-width'),
        width: 250,
        height: 30,
        min: 1,
        max: 200,
        initValue: 4,
        curve: 'quadratic',
        onChange: function (val) {
            updatePreviews();
        },
        formatFunc: function (v) {
            return Math.round(v);
        }
    });
    BB.css(lineWidthSlider.getElement(), {
        marginTop: '10px'
    });
    div.appendChild(lineWidthSlider.getElement());

    let opacitySlider = new KlSlider({
        label: LANG('opacity'),
        width: 250,
        height: 30,
        min: 0,
        max: 1,
        initValue: 1,
        onChange: function (val) {
        },
        formatFunc: function (v) {
            return Math.round(v * 100);
        }
    });
    BB.css(opacitySlider.getElement(), {
        marginTop: '10px'
    });
    div.appendChild(opacitySlider.getElement());

    let row2 = BB.el({
        parent: div,
        css: {
            display: 'flex',
            alignItems: 'center',
            marginTop: '10px'
        }
    });

    let outwardsToggle = new Checkbox({
        init: false,
        label: LANG('shape-outwards'),
        callback: function(b) {},
        css: {
            width: '50%',
            marginRight: '10px',
        }
    });
    row2.appendChild(outwardsToggle.getElement());

    let fixedToggle = new Checkbox({
        init: false,
        label: LANG('shape-fixed'),
        callback: function(b) {
            updatePreviews();
        },
        css: {
            flexGrow: '1',
        }
    });
    row2.appendChild(fixedToggle.getElement());

    let snapToggle = new Checkbox({
        init: false,
        label: LANG('shape-snap'),
        title: LANG('shape-snap-title'),
        callback: function(b) {
            updatePreviews();
        },
        css: {
            flexGrow: '1',
        }
    });
    row2.appendChild(snapToggle.getElement());



    updatePreviews();

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
            //update();
        }
    };

    this.getShape = function() {
        return shape;
    };

    this.getMode = function() {
        return mode;
    };

    this.getIsEraser = function() {
        return (eraserToggle as any).getValue();
    };

    this.getOpacity = function() {
        return opacitySlider.getValue();
    };

    this.getLineWidth = function() {
        return lineWidthSlider.getValue();
    };

    this.getIsOutwards = function() {
        return (outwardsToggle as any).getValue();
    };

    this.getIsFixed = function() {
        return (fixedToggle as any).getValue();
    };

    this.getIsSnap = function() {
        return (snapToggle as any).getValue();
    };

}