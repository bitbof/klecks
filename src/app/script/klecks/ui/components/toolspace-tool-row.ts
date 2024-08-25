import { BB } from '../../../bb/bb';
import { ToolDropdown } from './tool-dropdown';
import toolHandImg from '/src/app/img/ui/tool-hand.svg';
import toolZoomInImg from '/src/app/img/ui/tool-zoom-in.svg';
import toolZoomOutImg from '/src/app/img/ui/tool-zoom-out.svg';
import toolUndoImg from '/src/app/img/ui/tool-undo.svg';
import { LANG } from '../../../language/language';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { TToolType } from '../../kl-types';

type TBaseToolRowButton = {
    el: HTMLElement;
};

type TToolRowButton = TBaseToolRowButton & {
    pointerListener: PointerListener;
    setIsSmall: (b: boolean) => void;
};

type TToolRowTriangleButton = TBaseToolRowButton & {
    setIsEnabledLeft: (b: boolean) => void;
    setIsEnabledRight: (b: boolean) => void;
    leftPointerListener: PointerListener;
    rightPointerListener: PointerListener;
};

/**
 * Row of buttons in toolspace. image-operations (draw, hand), zoom, undo/redo
 * Need to do syncing. So tool is correct, and zoom/undo/redo buttons are properly enabled/disabled
 * heights: 54px tall, 36px small -> via setIsSmall
 */
export class ToolspaceToolRow {
    private readonly rootEl: HTMLElement;
    private readonly toolDropdown: ToolDropdown;
    private readonly handButton: TToolRowButton;
    private readonly zoomInButton: TToolRowButton;
    private readonly zoomOutButton: TToolRowButton;
    private readonly undoButton: TToolRowButton;
    private readonly redoButton: TToolRowButton;
    private readonly zoomInNOutButton: TToolRowTriangleButton;
    private readonly undoNRedoButton: TToolRowTriangleButton;
    private currentActiveStr: TToolType;
    private readonly onActivate: (activeStr: TToolType) => void;

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        onActivate: (activeStr: TToolType) => void; // clicking on tool button - activating it
        onZoomIn: () => void;
        onZoomOut: () => void;
        onUndo: () => void;
        onRedo: () => void;
    }) {
        this.rootEl = BB.el({
            className: 'kl-toolspace-row',
            css: {
                height: '54px',
                display: 'flex',
            },
        });

        this.onActivate = p.onActivate;
        this.currentActiveStr = 'brush';

        const createButton = (p: {
            onClick: () => void;
            image: string;
            contain: boolean;
            doLighten?: boolean;
            doMirror?: boolean;
        }): TToolRowButton => {
            const smallMargin = p.doLighten ? '6px 0' : '8px 0';

            const el = BB.el({
                className: 'toolspace-row-button nohighlight',
                //title: p.title,
                onClick: p.onClick,
                css: {
                    padding: p.contain ? '10px 0' : '',
                },
            });
            const im = BB.el({
                className: 'dark-invert',
                css: {
                    backgroundImage: "url('" + p.image + "')",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: p.contain ? 'contain' : '',
                    //filter: 'grayscale(1)',
                    height: '100%',
                    transform: p.doMirror ? 'scale(-1, 1)' : '',
                    pointerEvents: 'none',
                    opacity: p.doLighten ? '0.75' : '1',
                },
            });
            el.append(im);
            const pointerListener = new BB.PointerListener({
                // because :hover causes problems w touch
                target: el,
                onEnterLeave: (isOver) => {
                    el.classList.toggle('toolspace-row-button-hover', isOver);
                },
            });
            const setIsSmall = (b: boolean) => {
                el.style.padding = p.contain ? (b ? smallMargin : '10px 0') : '';
            };
            return {
                el,
                pointerListener,
                setIsSmall,
            };
        };

        const createTriangleButton = (p: {
            onLeft: () => void;
            onRight: () => void;
            leftImage: string;
            rightImage: string | null;
        }): TToolRowTriangleButton => {
            // because IE and Edge don't support clip path

            const result = BB.el({
                css: {
                    flexGrow: '1',
                    position: 'relative',
                },
            });

            const svg = BB.createSvg({
                elementType: 'svg',
                width: '67px', // can't think of a way doing with percentage
                height: '54px',
                viewBox: '0 0 100 100',
                preserveAspectRatio: 'none',
            });
            BB.css(svg, {
                position: 'absolute',
                left: '0',
                top: '0',
            });

            const blurRadius = 10;
            const blurOffsetX = 2;
            const blurOffsetY = 2;

            const defs = BB.createSvg({
                // inset shadow via svg
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
                                result: 'blur',
                            },
                            {
                                elementType: 'feOffset',
                                dx: '' + blurOffsetX,
                                dy: '' + blurOffsetY,
                            },
                            {
                                elementType: 'feComposite',
                                in2: 'SourceAlpha',
                                operator: 'arithmetic',
                                k2: '-1',
                                k3: '1',
                                result: 'shadowDiff',
                            },

                            {
                                elementType: 'feFlood',
                                'flood-color': '#000',
                                'flood-opacity': '0.2',
                            },
                            {
                                elementType: 'feComposite',
                                in2: 'shadowDiff',
                                operator: 'in',
                            },
                            {
                                elementType: 'feComposite',
                                in2: 'SourceGraphic',
                                operator: 'over',
                                result: 'firstfilter',
                            },

                            {
                                elementType: 'feGaussianBlur',
                                in: 'firstfilter',
                                stdDeviation: '' + blurRadius,
                                result: 'blur2',
                            },
                            {
                                elementType: 'feOffset',
                                dx: '' + blurOffsetX,
                                dy: '' + blurOffsetY,
                            },
                            {
                                elementType: 'feComposite',
                                in2: 'firstfilter',
                                operator: 'arithmetic',
                                k2: '-1',
                                k3: '1',
                                result: 'shadowDiff',
                            },

                            {
                                elementType: 'feFlood',
                                'flood-color': '#000',
                                'flood-opacity': '0.2',
                            },
                            {
                                elementType: 'feComposite',
                                in2: 'shadowDiff',
                                operator: 'in',
                            },
                            {
                                elementType: 'feComposite',
                                in2: 'firstfilter',
                                operator: 'over',
                            },
                        ],
                    },
                ],
            });

            const svgTriangleLeft = BB.createSvg({
                elementType: 'path',
                'vector-effect': 'non-scaling-stroke',
                d: 'M0,0 L 100,0 0,100 z',
                fill: 'rgba(0,0,0,0)',
                class: 'toolspace-svg-triangle-button',
            });
            svgTriangleLeft.onclick = () => {
                p.onLeft();
                svgTriangleLeft.classList.remove('toolspace-svg-triangle-button-hover');
            };

            const svgTriangleRight = BB.createSvg({
                elementType: 'path',
                'vector-effect': 'non-scaling-stroke',
                d: 'M100,100 L 100,0 0,100 z',
                fill: 'rgba(0,0,0,0)',
                class: 'toolspace-svg-triangle-button',
            });
            svgTriangleRight.onclick = () => {
                p.onRight();
                svgTriangleRight.classList.remove('toolspace-svg-triangle-button-hover');
            };

            // because :hover causes problems w touch
            const leftPointerListener = new BB.PointerListener({
                target: svgTriangleLeft,
                onEnterLeave: (isOver) => {
                    svgTriangleLeft.classList.toggle('toolspace-svg-triangle-button-hover', isOver);
                },
            });
            const rightPointerListener = new BB.PointerListener({
                target: svgTriangleRight,
                onEnterLeave: (isOver) => {
                    svgTriangleRight.classList.toggle(
                        'toolspace-svg-triangle-button-hover',
                        isOver,
                    );
                },
            });

            svg.append(defs, svgTriangleLeft, svgTriangleRight);
            result.append(svg);

            const leftIm = BB.el({
                parent: result,
                className: 'dark-invert',
                css: {
                    backgroundImage: "url('" + p.leftImage + "')",
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'contain',
                    width: '20px',
                    height: '20px',
                    position: 'absolute',
                    left: '10px',
                    top: '8px',
                    //transform: p.doMirror ? 'scale(-1, 1)' : '',
                    pointerEvents: 'none',
                },
            });
            result.append(leftIm);

            const rightIm = BB.el({
                parent: result,
                className: 'dark-invert',
                css: {
                    backgroundImage: "url('" + (p.rightImage ? p.rightImage : p.leftImage) + "')",
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'contain',
                    width: '20px',
                    height: '20px',
                    position: 'absolute',
                    right: '10px',
                    bottom: '8px',
                    transform: p.rightImage ? '' : 'scale(-1, 1)',
                    pointerEvents: 'none',
                },
            });

            const setIsEnabledLeft = (b: boolean) => {
                svgTriangleLeft.classList.toggle('toolspace-row-button-disabled', !b);
                leftIm.classList.toggle('toolspace-row-button-disabled', !b);
            };

            const setIsEnabledRight = (b: boolean) => {
                svgTriangleRight.classList.toggle('toolspace-row-button-disabled', !b);
                rightIm.classList.toggle('toolspace-row-button-disabled', !b);
            };

            return {
                el: result,
                setIsEnabledLeft,
                setIsEnabledRight,
                leftPointerListener,
                rightPointerListener,
            };
        };

        this.toolDropdown = new ToolDropdown({
            onChange: (activeStr) => {
                this.setActive(activeStr, true);
            },
        });
        this.rootEl.append(this.toolDropdown.getElement());

        this.handButton = createButton({
            onClick: () => {
                this.setActive('hand', true);
            },
            image: toolHandImg,
            contain: true,
            doLighten: true,
        });
        this.handButton.el.classList.add('kl-tool-row-border-right');
        this.handButton.el.title = LANG('tool-hand');
        this.rootEl.append(this.handButton.el);

        this.zoomInNOutButton = createTriangleButton({
            onLeft: p.onZoomIn,
            onRight: p.onZoomOut,
            leftImage: toolZoomInImg,
            rightImage: toolZoomOutImg,
        });
        this.zoomInNOutButton.el.title = LANG('tool-zoom');
        this.rootEl.append(this.zoomInNOutButton.el);

        this.zoomInButton = createButton({
            onClick: p.onZoomIn,
            image: toolZoomInImg,
            contain: true,
        });
        this.zoomInButton.el.title = LANG('zoom-in');
        this.rootEl.append(this.zoomInButton.el);

        this.zoomOutButton = createButton({
            onClick: p.onZoomOut,
            image: toolZoomOutImg,
            contain: true,
        });
        this.zoomOutButton.el.title = LANG('zoom-out');
        this.rootEl.append(this.zoomOutButton.el);

        this.undoNRedoButton = createTriangleButton({
            onLeft: p.onUndo,
            onRight: p.onRedo,
            leftImage: toolUndoImg,
            rightImage: null,
        });
        this.undoNRedoButton.el.title = LANG('undo') + '/' + LANG('redo');
        this.undoNRedoButton.setIsEnabledLeft(false);
        this.undoNRedoButton.setIsEnabledRight(false);
        this.rootEl.append(this.undoNRedoButton.el);

        this.undoButton = createButton({
            onClick: p.onUndo,
            image: toolUndoImg,
            contain: true,
        });
        this.undoButton.el.title = LANG('undo');
        this.undoButton.el.classList.add('toolspace-row-button-disabled');
        this.rootEl.append(this.undoButton.el);

        this.redoButton = createButton({
            onClick: p.onRedo,
            image: toolUndoImg,
            contain: true,
            doMirror: true,
        });
        this.redoButton.el.title = LANG('redo');
        this.redoButton.el.classList.add('toolspace-row-button-disabled');
        this.rootEl.append(this.redoButton.el);

        this.zoomInButton.el.style.display = 'none';
        this.zoomOutButton.el.style.display = 'none';
        this.undoButton.el.style.display = 'none';
        this.redoButton.el.style.display = 'none';
    }

    // ---- interface ----

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsSmall(b: boolean): void {
        BB.css(this.rootEl, {
            height: b ? '36px' : '54px',
        });

        this.toolDropdown.setIsSmall(b);
        this.handButton.setIsSmall(b);
        this.zoomInButton.setIsSmall(b);
        this.zoomOutButton.setIsSmall(b);
        this.undoButton.setIsSmall(b);
        this.redoButton.setIsSmall(b);

        if (b) {
            this.zoomInNOutButton.el.style.display = 'none';
            this.undoNRedoButton.el.style.display = 'none';
            this.zoomInButton.el.style.display = 'block';
            this.zoomOutButton.el.style.display = 'block';
            this.undoButton.el.style.display = 'block';
            this.redoButton.el.style.display = 'block';
        } else {
            this.zoomInNOutButton.el.style.display = 'block';
            this.undoNRedoButton.el.style.display = 'block';
            this.zoomInButton.el.style.display = 'none';
            this.zoomOutButton.el.style.display = 'none';
            this.undoButton.el.style.display = 'none';
            this.redoButton.el.style.display = 'none';
        }
    }

    setEnableZoomIn(b: boolean): void {
        this.zoomInButton.el.classList.toggle('toolspace-row-button-disabled', !b);
        this.zoomInNOutButton.setIsEnabledLeft(b);
    }

    setEnableZoomOut(b: boolean): void {
        this.zoomOutButton.el.classList.toggle('toolspace-row-button-disabled', !b);
        this.zoomInNOutButton.setIsEnabledRight(b);
    }

    setEnableUndo(b: boolean): void {
        this.undoButton.el.classList.toggle('toolspace-row-button-disabled', !b);
        this.undoNRedoButton.setIsEnabledLeft(b);
    }

    setEnableRedo(b: boolean): void {
        this.redoButton.el.classList.toggle('toolspace-row-button-disabled', !b);
        this.undoNRedoButton.setIsEnabledRight(b);
    }

    setActive(activeStr: TToolType, doEmit?: boolean): void {
        if (this.currentActiveStr === activeStr) {
            return;
        }

        this.currentActiveStr = activeStr;

        this.toolDropdown.setActive(this.currentActiveStr);
        this.handButton.el.classList.toggle(
            'toolspace-row-button-activated',
            this.currentActiveStr === 'hand',
        );

        if (doEmit) {
            this.onActivate(this.currentActiveStr);
        }
    }

    getActive(): TToolType {
        return this.currentActiveStr;
    }
}
