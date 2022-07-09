import {BB} from '../../../bb/bb';
import {ToolDropdown} from './tool-dropdown';
// @ts-ignore
import toolHandImg from 'url:~/src/app/img/ui/tool-hand.svg';
// @ts-ignore
import toolZoomInImg from 'url:~/src/app/img/ui/tool-zoom-in.svg';
// @ts-ignore
import toolZoomOutImg from 'url:~/src/app/img/ui/tool-zoom-out.svg';
// @ts-ignore
import toolUndoImg from 'url:~/src/app/img/ui/tool-undo.svg';
import {LANG} from '../../../language/language';


/**
 * Row of buttons in toolspace. image-operations (draw, hand), zoom, undo/redo
 * Need to do syncing. So tool is correct, and zoom/undo/redo buttons are properly enabled/disabled
 * heights: 54px tall, 36px small -> via setIsSmall
 *
 * p = {
 *     onActivate: function(activeStr), // clicking on tool button - activating it
 *     onZoomIn: function(),
 *     onZoomOut: function(),
 *     onUndo: function(),
 *     onRedo: function(),
 * }
 *
 * activeStr = 'draw' | 'hand' | 'fill' | 'text'
 *
 * @param p
 * @constructor
 */
export function ToolspaceToolRow(p) {
    let div = document.createElement('div');
    BB.css(div, {
        height: '54px',
        //height: '36px',
        display: 'flex',
        backgroundImage: 'linear-gradient(to top, rgba(255, 255, 255, 0) 20%, rgba(255, 255, 255, 0.6) 100%)'
    });

    let currentActiveStr = 'draw'; // 'draw' | 'hand' | 'fill'

    function setActive(activeStr, doEmit?) {
        if (currentActiveStr === activeStr) {
            return;
        }

        currentActiveStr = activeStr;

        toolDropdown.setActive(currentActiveStr);
        handButton.classList.toggle('toolspace-row-button-activated', currentActiveStr === 'hand');

        if (doEmit) {
            p.onActivate(currentActiveStr);
        }
    }

    function createButton(p) {

        let smallMargin = p.doLighten ? '6px 0' : '8px 0';

        let result = BB.el({
            className: 'toolspace-row-button nohighlight',
            //title: p.title,
            onClick: p.onClick,
            css: {
                padding: p.contain ? '10px 0' : ''
            }
        });
        let im = BB.el({
            css: {
                backgroundImage: 'url(\'' + p.image + '\')',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: p.contain ? 'contain' : '',
                //filter: 'grayscale(1)',
                height: '100%',
                transform: p.doMirror ? 'scale(-1, 1)' : '',
                pointerEvents: 'none',
                opacity: p.doLighten ? '0.75' : '1'
            }
        });
        result.appendChild(im);
        (result as any).pointerListener = new BB.PointerListener({ // because :hover causes problems w touch
            target: result,
            onEnterLeave: function(isOver) {
                result.classList.toggle('toolspace-row-button-hover', isOver);
            }
        });
        (result as any).setIsSmall = function(b) {
            result.style.padding = p.contain ? (b ? smallMargin : '10px 0') : '';
        }
        return result;
    }


    function createTriangleButton(p) { // because IE and Edge don't support clip path

        let result = document.createElement('div');
        BB.css(result, {
            flexGrow: '1',
            position: 'relative'
        });

        let svg = BB.createSvg({
            elementType: 'svg',
            width: '67px', // can't think of a way doing with percentage
            height: '54px',
            viewBox: '0 0 100 100',
            preserveAspectRatio: 'none'
        });
        BB.css(svg, {
            position: 'absolute',
            left: '0',
            top: '0'
        });

        let blurRadius = 10;
        let blurOffsetX = 2;
        let blurOffsetY = 2;

        let defs = BB.createSvg( { // inset shadow via svg
            elementType: 'defs',
            childrenArr: [
                {
                    elementType: 'filter',
                    id: 'innershadow',
                    x0: '-50%',
                    y0: '-50%',
                    width: '200%',
                    height: '200%',
                    childrenArr: [
                        {
                            elementType: 'feGaussianBlur',
                            in: 'SourceAlpha',
                            stdDeviation: '' + blurRadius,
                            result: 'blur'
                        }, {
                            elementType: 'feOffset',
                            dx: '' + blurOffsetX,
                            dy: '' + blurOffsetY
                        }, {
                            elementType: 'feComposite',
                            in2: 'SourceAlpha',
                            operator: 'arithmetic',
                            k2: '-1',
                            k3: '1',
                            result: 'shadowDiff'
                        },

                        {
                            elementType: 'feFlood',
                            'flood-color': '#000',
                            'flood-opacity': '0.2'
                        }, {
                            elementType: 'feComposite',
                            in2: 'shadowDiff',
                            operator: 'in'
                        }, {
                            elementType: 'feComposite',
                            in2: 'SourceGraphic',
                            operator: 'over',
                            result: 'firstfilter'
                        },

                        {
                            elementType: 'feGaussianBlur',
                            in: 'firstfilter',
                            stdDeviation: '' + blurRadius,
                            result: 'blur2'
                        }, {
                            elementType: 'feOffset',
                            dx: '' + blurOffsetX,
                            dy: '' + blurOffsetY
                        }, {
                            elementType: 'feComposite',
                            in2: 'firstfilter',
                            operator: 'arithmetic',
                            k2: '-1',
                            k3: '1',
                            result: 'shadowDiff'
                        },

                        {
                            elementType: 'feFlood',
                            'flood-color': '#000',
                            'flood-opacity': '0.2'
                        }, {
                            elementType: 'feComposite',
                            in2: 'shadowDiff',
                            operator: 'in'
                        }, {
                            elementType: 'feComposite',
                            in2: 'firstfilter',
                            operator: 'over'
                        }
                    ]
                }
            ]
        });


        let svgTriangleLeft = BB.createSvg({
            elementType: 'path',
            'vector-effect': 'non-scaling-stroke',
            d: 'M0,0 L 100,0 0,100 z',
            fill: 'rgba(0,0,0,0)',
            class: 'toolspace-svg-triangle-button'
        });
        svgTriangleLeft.onclick = function() {
            p.onLeft();
            svgTriangleLeft.classList.remove('toolspace-svg-triangle-button-hover');
        };

        let svgTriangleRight = BB.createSvg({
            elementType: 'path',
            'vector-effect': 'non-scaling-stroke',
            d: 'M100,100 L 100,0 0,100 z',
            fill: 'rgba(0,0,0,0)',
            class: 'toolspace-svg-triangle-button'
        });
        svgTriangleRight.onclick = function() {
            p.onRight();
            svgTriangleRight.classList.remove('toolspace-svg-triangle-button-hover');
        };

        // because :hover causes problems w touch
        (result as any).leftPointerListener = new BB.PointerListener({
            target: svgTriangleLeft,
            onEnterLeave: function(isOver) {
                svgTriangleLeft.classList.toggle('toolspace-svg-triangle-button-hover', isOver);
            }
        });
        (result as any).rightPointerListener = new BB.PointerListener({
            target: svgTriangleRight,
            onEnterLeave: function(isOver) {
                svgTriangleRight.classList.toggle('toolspace-svg-triangle-button-hover', isOver);
            }
        });


        svg.appendChild(defs);
        svg.appendChild(svgTriangleLeft);
        svg.appendChild(svgTriangleRight);
        result.appendChild(svg);


        let leftIm = BB.el({
            css: {
                backgroundImage: 'url(\'' + p.leftImage + '\')',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                width: '20px',
                height: '20px',
                position: 'absolute',
                left: '10px',
                top: '8px',
                //transform: p.doMirror ? 'scale(-1, 1)' : '',
                pointerEvents: 'none'
            }
        });
        result.appendChild(leftIm);


        let rightIm = BB.el({
            css: {
                backgroundImage: 'url(\'' + (p.rightImage ? p.rightImage : p.leftImage) + '\')',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                width: '20px',
                height: '20px',
                position: 'absolute',
                right: '10px',
                bottom: '8px',
                transform: p.rightImage ? '' : 'scale(-1, 1)',
                pointerEvents: 'none'
            }
        });
        result.appendChild(rightIm);





        (result as any).setIsEnabledLeft = function(b) {
            svgTriangleLeft.classList.toggle('toolspace-row-button-disabled', !b);
            leftIm.classList.toggle('toolspace-row-button-disabled', !b);
        };
        (result as any).setIsEnabledRight = function(b) {
            svgTriangleRight.classList.toggle('toolspace-row-button-disabled', !b);
            rightIm.classList.toggle('toolspace-row-button-disabled', !b);
        };

        return result;
    }

    function createTriangleButtonViaClipPath(p) {
        let result = document.createElement('div');
        BB.css(result, {
            flexGrow: '1',
            position: 'relative'
        });


        let leftButton = BB.el({
            className: 'toolspace-triangle-button',
            onClick: p.onLeft,
            css: {
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 100%)'
            }
        });

        let leftIm = BB.el({
            css: {
                backgroundImage: 'url(\'' + p.leftImage + '\')',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                width: '20px',
                height: '20px',
                position: 'absolute',
                left: '10px',
                top: '8px',
                //transform: p.doMirror ? 'scale(-1, 1)' : '',
                pointerEvents: 'none'
            }
        });
        leftButton.appendChild(leftIm);



        let rightButton = BB.el({
            className: 'toolspace-triangle-button',
            onClick: p.onRight,
            css: {
                clipPath: 'polygon(0% 100%, 100% 0%, 100% 100%, 0% 100%)'
            }
        });

        let rightIm = BB.el({
            css: {
                backgroundImage: 'url(\'' + (p.rightImage ? p.rightImage : p.leftImage) + '\')',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                width: '20px',
                height: '20px',
                position: 'absolute',
                right: '10px',
                bottom: '8px',
                transform: p.rightImage ? '' : 'scale(-1, 1)',
                pointerEvents: 'none'
            }
        });
        rightButton.appendChild(rightIm);



        result.appendChild(leftButton);
        result.appendChild(rightButton);


        // because :hover causes problems w touch
        (result as any).leftPointerListener = new BB.PointerListener({
            target: leftButton,
            onEnterLeave: function(isOver) {
                leftButton.classList.toggle('toolspace-row-button-hover', isOver);
            }
        });
        (result as any).rightPointerListener = new BB.PointerListener({
            target: rightButton,
            onEnterLeave: function(isOver) {
                rightButton.classList.toggle('toolspace-row-button-hover', isOver);
            }
        });



        (result as any).setIsEnabledLeft = function(b) {
            leftButton.classList.toggle('toolspace-row-button-disabled', !b);
        };
        (result as any).setIsEnabledRight = function(b) {
            rightButton.classList.toggle('toolspace-row-button-disabled', !b);
        };
        return result;
    }

    let toolDropdown = new ToolDropdown({
        onChange: function(activeStr) {
            setActive(activeStr, true);
        }
    });
    div.appendChild(toolDropdown.getElement());

    let handButton = createButton({
        onClick: function() {
            setActive('hand', true);
        },
        image: toolHandImg,
        contain: true,
        doLighten: true
    });
    handButton.style.borderRight = '1px solid rgb(212, 212, 212)';
    handButton.title = LANG('tool-hand');
    div.appendChild(handButton);

    let zoomInNOutButton = createTriangleButton({
        onLeft: p.onZoomIn,
        onRight: p.onZoomOut,
        leftImage: toolZoomInImg,
        rightImage: toolZoomOutImg,
    });
    zoomInNOutButton.title = LANG('tool-zoom');
    div.appendChild(zoomInNOutButton);

    let zoomInButton = createButton({
        onClick: p.onZoomIn,
        image: toolZoomInImg,
        contain: true
    });
    zoomInButton.title = LANG('zoom-in');
    div.appendChild(zoomInButton);

    let zoomOutButton = createButton({
        onClick: p.onZoomOut,
        image: toolZoomOutImg,
        contain: true
    });
    zoomOutButton.title = LANG('zoom-out');
    div.appendChild(zoomOutButton);

    let undoNRedoButton = createTriangleButton({
        onLeft: p.onUndo,
        onRight: p.onRedo,
        leftImage: toolUndoImg,
        rightImage: null,
    });
    undoNRedoButton.title = LANG('tool-undo-redo');
    (undoNRedoButton as any).setIsEnabledLeft(false);
    (undoNRedoButton as any).setIsEnabledRight(false);
    div.appendChild(undoNRedoButton);

    let undoButton = createButton({
        onClick: p.onUndo,
        image: toolUndoImg,
        contain: true
    });
    undoButton.title = LANG('undo');
    undoButton.classList.add('toolspace-row-button-disabled');
    div.appendChild(undoButton);

    let redoButton = createButton({
        onClick: p.onRedo,
        image: toolUndoImg,
        contain: true,
        doMirror: true
    });
    redoButton.title = LANG('redo');
    redoButton.classList.add('toolspace-row-button-disabled');
    div.appendChild(redoButton);

    zoomInButton.style.display = 'none';
    zoomOutButton.style.display = 'none';
    undoButton.style.display = 'none';
    redoButton.style.display = 'none';






    // --- interface ---
    this.getElement = function() {
        return div;
    };
    this.setIsSmall = function(b) {
        BB.css(div, {
            height: b ? '36px' : '54px'
        });

        toolDropdown.setIsSmall(b);
        (handButton as any).setIsSmall(b);
        (zoomInButton as any).setIsSmall(b);
        (zoomOutButton as any).setIsSmall(b);
        (undoButton as any).setIsSmall(b);
        (redoButton as any).setIsSmall(b);

        if (b) {
            zoomInNOutButton.style.display = 'none';
            undoNRedoButton.style.display = 'none';
            zoomInButton.style.display = 'block';
            zoomOutButton.style.display = 'block';
            undoButton.style.display = 'block';
            redoButton.style.display = 'block';
        } else {
            zoomInNOutButton.style.display = 'block';
            undoNRedoButton.style.display = 'block';
            zoomInButton.style.display = 'none';
            zoomOutButton.style.display = 'none';
            undoButton.style.display = 'none';
            redoButton.style.display = 'none';
        }

    };

    this.setEnableZoomIn = function(b) {
        zoomInButton.classList.toggle('toolspace-row-button-disabled', !b);
        (zoomInNOutButton as any).setIsEnabledLeft(b);
    };
    this.setEnableZoomOut = function(b) {
        zoomOutButton.classList.toggle('toolspace-row-button-disabled', !b);
        (zoomInNOutButton as any).setIsEnabledRight(b);
    };
    this.setEnableUndo = function(b) {
        undoButton.classList.toggle('toolspace-row-button-disabled', !b);
        (undoNRedoButton as any).setIsEnabledLeft(b);
    };
    this.setEnableRedo = function(b) {
        redoButton.classList.toggle('toolspace-row-button-disabled', !b);
        (undoNRedoButton as any).setIsEnabledRight(b);
    };
    this.setActive = function(activeStr) {
        setActive(activeStr);
    };
    this.getActive = function() {
        return currentActiveStr;
    };

}