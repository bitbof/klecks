import { BB } from '../../../bb/bb';
import { IRect, IVector2D } from '../../../bb/bb-types';
import { KeyListener } from '../../../bb/input/key-listener';
import { PointerListener } from '../../../bb/input/pointer-listener';

type TUpdateElement = {
    el: HTMLElement;
    update: () => void;
};

/**
 * Interactive preview for crop filter. Corners and edges can be dragged.
 * the div that you append this to must be relative
 */
export class Cropper {
    private readonly rootEl: HTMLElement;
    private x: number;
    private y: number;
    private width: number;
    private height: number;
    private scale: number;
    private readonly grips: IVector2D[]; // aka corner coordinates
    private readonly edges: TUpdateElement[];
    private readonly cornerElArr: TUpdateElement[];
    private readonly darken: TUpdateElement[];
    private readonly outline: TUpdateElement;
    private readonly thirdsHorizontal: TUpdateElement;
    private readonly thirdsVertical: TUpdateElement;
    private readonly keyListener: KeyListener;
    private readonly pointerRemainder: IVector2D;

    private readonly outlinePointerListener: PointerListener;

    private readonly corner0PointerListener: PointerListener;
    private readonly corner1PointerListener: PointerListener;
    private readonly corner2PointerListener: PointerListener;
    private readonly corner3PointerListener: PointerListener;

    private readonly edge0PointerListener: PointerListener;
    private readonly edge1PointerListener: PointerListener;
    private readonly edge2PointerListener: PointerListener;
    private readonly edge3PointerListener: PointerListener;

    private readonly callback: (val: IRect) => void;

    private update(): void {
        this.edges[0].update();
        this.edges[1].update();
        this.edges[2].update();
        this.edges[3].update();
        this.cornerElArr[0].update();
        this.cornerElArr[1].update();
        this.cornerElArr[2].update();
        this.cornerElArr[3].update();
        this.darken[0].update();
        this.darken[1].update();
        this.darken[2].update();
        this.darken[3].update();
        this.outline.update();
        this.thirdsHorizontal.update();
        this.thirdsVertical.update();
    }

    private commit(): void {
        this.pointerRemainder.x = 0;
        this.pointerRemainder.y = 0;
        this.callback(this.getTransform());
    }

    // ----------------------------------- public -----------------------------------
    constructor(params: {
        x: number; // int, pos in relation to image
        y: number; // int
        width: number; // int
        height: number; // int
        maxW: number;
        maxH: number;
        scale: number; // float, zoom
        callback: (val: IRect) => void;
    }) {
        this.x = params.x;
        this.y = params.y;
        this.width = params.width;
        this.height = params.height;
        this.scale = params.scale;
        this.callback = params.callback;

        const maxW = params.maxW;
        const maxH = params.maxW;
        this.rootEl = BB.el();
        const gripCursors = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

        this.keyListener = new BB.KeyListener({});

        BB.css(this.rootEl, {
            position: 'absolute',
            left: this.x * this.scale + 'px',
            top: this.y * this.scale + 'px',
        });

        this.outline = {
            el: BB.el({
                css: {
                    position: 'absolute',
                    border: '1px dashed #fff',
                    cursor: 'move',
                },
            }),
            update: () => {
                BB.css(this.outline.el, {
                    left: this.grips[0].x * this.scale - 1 + 'px',
                    top: this.grips[0].y * this.scale - 1 + 'px',
                    width: (this.grips[2].x - this.grips[0].x) * this.scale + 'px',
                    height: (this.grips[2].y - this.grips[0].y) * this.scale + 'px',
                });
            },
        };

        this.pointerRemainder = {
            // needs to be reset after dragging complete
            x: 0,
            y: 0,
        };
        this.outlinePointerListener = new BB.PointerListener({
            target: this.outline.el,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );

                    this.grips[0].x += dX;
                    this.grips[0].y += dY;
                    this.grips[1].x += dX;
                    this.grips[1].y += dY;
                    this.grips[2].x += dX;
                    this.grips[2].y += dY;
                    this.grips[3].x += dX;
                    this.grips[3].y += dY;

                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });

        this.thirdsHorizontal = {
            el: BB.el({
                css: {
                    position: 'absolute',
                    borderTop: '1px solid #0ff',
                    borderBottom: '1px solid #0ff',
                },
            }),
            update: () => {
                BB.css(this.thirdsHorizontal.el, {
                    left: this.grips[0].x * this.scale + 'px',
                    top:
                        (this.grips[0].y + (this.grips[2].y - this.grips[0].y) / 3) * this.scale +
                        'px',
                    width: (this.grips[2].x - this.grips[0].x) * this.scale + 'px',
                    height: ((this.grips[2].y - this.grips[0].y) / 3) * this.scale + 'px',
                });
            },
        };

        this.thirdsVertical = {
            el: BB.el({
                css: {
                    position: 'absolute',
                    borderLeft: '1px solid #0ff',
                    borderRight: '1px solid #0ff',
                },
            }),
            update: () => {
                BB.css(this.thirdsVertical.el, {
                    left:
                        (this.grips[0].x + (this.grips[2].x - this.grips[0].x) / 3) * this.scale +
                        'px',
                    top: this.grips[0].y * this.scale + 'px',
                    width: ((this.grips[2].x - this.grips[0].x) / 3) * this.scale + 'px',
                    height: (this.grips[2].y - this.grips[0].y) * this.scale + 'px',
                });
            },
        };

        const gripSize = 40;
        const gripOverlay = 10;

        this.grips = [
            { x: 0, y: 0 }, // top left
            { x: this.width, y: 0 }, // top right
            { x: this.width, y: this.height }, // bottom right
            { x: 0, y: this.height }, //bottom left
        ];

        const transformTop = (dY: number) => {
            this.grips[0].y += dY;
            this.grips[0].y = BB.clamp(
                this.grips[0].y,
                this.grips[3].y - maxH,
                this.grips[3].y - 1,
            );
            this.grips[1].y = this.grips[0].y;
        };
        const transformRight = (dX: number) => {
            this.grips[1].x += dX;
            this.grips[1].x = BB.clamp(
                this.grips[1].x,
                this.grips[0].x + 1,
                this.grips[0].x + maxW,
            );
            this.grips[2].x = this.grips[1].x;
        };
        const transformBottom = (dY: number) => {
            this.grips[2].y += dY;
            this.grips[2].y = BB.clamp(
                this.grips[2].y,
                this.grips[1].y + 1,
                this.grips[1].y + maxH,
            );
            this.grips[3].y = this.grips[2].y;
        };
        const transformLeft = (dX: number) => {
            this.grips[0].x += dX;
            this.grips[0].x = BB.clamp(
                this.grips[0].x,
                this.grips[1].x - maxW,
                this.grips[1].x - 1,
            );
            this.grips[3].x = this.grips[0].x;
        };

        this.edges = [];
        for (let i = 0; i < 4; i++) {
            ((i) => {
                const el = BB.el({
                    css: {
                        width: gripSize + 'px',
                        height: gripSize + 'px',
                        //background: '#0f0',
                        position: 'absolute',
                    },
                });

                const update = () => {
                    if (i === 0) {
                        //top
                        BB.css(el, {
                            left: this.grips[0].x * this.scale + gripOverlay + 'px',
                            top: this.grips[0].y * this.scale - gripSize * 2 + gripOverlay + 'px',
                            width:
                                (this.grips[1].x - this.grips[0].x) * this.scale -
                                gripOverlay * 2 +
                                'px',
                            height: gripSize * 2 + 'px',
                        });
                    } else if (i === 1) {
                        //right
                        BB.css(el, {
                            left: this.grips[1].x * this.scale - gripOverlay + 'px',
                            top: this.grips[1].y * this.scale + gripOverlay + 'px',
                            width: gripSize * 2 + 'px',
                            height:
                                (this.grips[2].y - this.grips[1].y) * this.scale -
                                gripOverlay * 2 +
                                'px',
                        });
                    } else if (i === 2) {
                        //bottom
                        BB.css(el, {
                            left: this.grips[3].x * this.scale + gripOverlay + 'px',
                            top: this.grips[3].y * this.scale - gripOverlay + 'px',
                            width:
                                (this.grips[2].x - this.grips[3].x) * this.scale -
                                gripOverlay * 2 +
                                'px',
                            height: gripSize * 2 + 'px',
                        });
                    } else if (i === 3) {
                        //left
                        BB.css(el, {
                            left: this.grips[0].x * this.scale - gripSize * 2 + gripOverlay + 'px',
                            top: this.grips[0].y * this.scale + gripOverlay + 'px',
                            width: gripSize * 2 + 'px',
                            height:
                                (this.grips[3].y - this.grips[0].y) * this.scale -
                                gripOverlay * 2 +
                                'px',
                        });
                    }
                    const angleOffset = i * 2 + 1;
                    el.style.cursor = gripCursors[angleOffset] + '-resize';
                };

                this.edges[i] = {
                    el,
                    update,
                };
            })(i);
        }

        this.darken = [];
        for (let i = 0; i < 4; i++) {
            ((i) => {
                const g = BB.el({
                    css: {
                        position: 'absolute',
                        background: '#000',
                        opacity: '0.5',
                    },
                });
                const update = () => {
                    if (i === 0) {
                        BB.css(g, {
                            left: this.grips[0].x * this.scale + 'px',
                            top: this.grips[0].y * this.scale - 8000 + 'px',
                            width: (this.grips[1].x - this.grips[0].x) * this.scale + 'px',
                            height: '8000px',
                        });
                    } else if (i === 1) {
                        BB.css(g, {
                            left: this.grips[1].x * this.scale + 'px',
                            top: this.grips[1].y * this.scale - 8000 + 'px',
                            width: '8000px',
                            height: 16000 + 'px',
                        });
                    } else if (i === 2) {
                        BB.css(g, {
                            left: this.grips[3].x * this.scale + 'px',
                            top: this.grips[3].y * this.scale + 'px',
                            width: (this.grips[2].x - this.grips[3].x) * this.scale + 'px',
                            height: '8000px',
                        });
                    } else if (i === 3) {
                        BB.css(g, {
                            left: this.grips[0].x * this.scale - 8000 + 'px',
                            top: this.grips[0].y * this.scale - 8000 + 'px',
                            width: '8000px',
                            height: 16000 + 'px',
                        });
                    }
                };

                this.darken[i] = {
                    el: g,
                    update,
                };
            })(i);
        }

        this.edge0PointerListener = new BB.PointerListener({
            target: this.edges[0].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformTop(dY);
                    if (this.keyListener.isPressed('shift')) {
                        transformBottom(-dY);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });
        this.edge1PointerListener = new BB.PointerListener({
            target: this.edges[1].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformRight(dX);
                    if (this.keyListener.isPressed('shift')) {
                        transformLeft(-dX);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });
        this.edge2PointerListener = new BB.PointerListener({
            target: this.edges[2].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformBottom(dY);
                    if (this.keyListener.isPressed('shift')) {
                        transformTop(-dY);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });
        this.edge3PointerListener = new BB.PointerListener({
            target: this.edges[3].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformLeft(dX);
                    if (this.keyListener.isPressed('shift')) {
                        transformRight(-dX);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });

        this.cornerElArr = [];
        (() => {
            for (let i = 0; i < 4; i++) {
                ((i) => {
                    const g = BB.el({
                        css: {
                            //background: '#f00',
                            width: gripSize * 2 + 'px',
                            height: gripSize * 2 + 'px',
                            position: 'absolute',
                            cursor: ['nwse-resize', 'nesw-resize'][i % 2],
                        },
                    });

                    const update = () => {
                        if (i === 0) {
                            //top left
                            BB.css(g, {
                                left:
                                    this.grips[0].x * this.scale -
                                    gripSize * 2 +
                                    gripOverlay +
                                    'px',
                                top:
                                    this.grips[0].y * this.scale -
                                    gripSize * 2 +
                                    gripOverlay +
                                    'px',
                            });
                        } else if (i === 1) {
                            //top right
                            BB.css(g, {
                                left: this.grips[1].x * this.scale - gripOverlay + 'px',
                                top:
                                    this.grips[1].y * this.scale -
                                    gripSize * 2 +
                                    gripOverlay +
                                    'px',
                            });
                        } else if (i === 2) {
                            //bottom right
                            BB.css(g, {
                                left: this.grips[1].x * this.scale - gripOverlay + 'px',
                                top: this.grips[2].y * this.scale - gripOverlay + 'px',
                            });
                        } else if (i === 3) {
                            //bottom left
                            BB.css(g, {
                                left:
                                    this.grips[0].x * this.scale -
                                    gripSize * 2 +
                                    gripOverlay +
                                    'px',
                                top: this.grips[2].y * this.scale - gripOverlay + 'px',
                            });
                        }
                    };

                    this.cornerElArr[i] = {
                        el: g,
                        update,
                    };
                })(i);
            }
        })();
        //top left
        this.corner0PointerListener = new BB.PointerListener({
            target: this.cornerElArr[0].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformLeft(dX);
                    transformTop(dY);
                    if (this.keyListener.isPressed('shift')) {
                        transformRight(-dX);
                        transformBottom(-dY);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });
        //top right
        this.corner1PointerListener = new BB.PointerListener({
            target: this.cornerElArr[1].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformRight(dX);
                    transformTop(dY);
                    if (this.keyListener.isPressed('shift')) {
                        transformLeft(-dX);
                        transformBottom(-dY);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });
        //bottom right
        this.corner2PointerListener = new BB.PointerListener({
            target: this.cornerElArr[2].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformRight(dX);
                    transformBottom(dY);
                    if (this.keyListener.isPressed('shift')) {
                        transformLeft(-dX);
                        transformTop(-dY);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });
        //bottom left
        this.corner3PointerListener = new BB.PointerListener({
            target: this.cornerElArr[3].el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const { dX, dY } = BB.intDxy(
                        this.pointerRemainder,
                        event.dX / this.scale,
                        event.dY / this.scale,
                    );
                    transformLeft(dX);
                    transformBottom(dY);
                    if (this.keyListener.isPressed('shift')) {
                        transformRight(-dX);
                        transformTop(-dY);
                    }
                    this.update();
                }
                if (event.type === 'pointerup') {
                    this.commit();
                }
            },
        });

        this.rootEl.append(
            this.darken[1].el,
            this.darken[0].el,
            this.darken[2].el,
            this.darken[3].el,
            this.thirdsHorizontal.el,
            this.thirdsVertical.el,
            this.outline.el,

            this.edges[1].el,
            this.edges[0].el,
            this.edges[2].el,
            this.edges[3].el,

            this.cornerElArr[0].el,
            this.cornerElArr[1].el,
            this.cornerElArr[2].el,
            this.cornerElArr[3].el,
        );

        this.update();
    }

    // ---- interface ----
    getTransform(): IRect {
        this.grips[1].x -= this.grips[0].x;
        this.grips[1].y -= this.grips[0].y;
        this.grips[2].x -= this.grips[0].x;
        this.grips[2].y -= this.grips[0].y;
        this.grips[3].x -= this.grips[0].x;
        this.grips[3].y -= this.grips[0].y;
        this.x += this.grips[0].x;
        this.y += this.grips[0].y;
        this.grips[0].x = 0;
        this.grips[0].y = 0;
        return {
            x: this.x,
            y: this.y,
            width: this.grips[1].x,
            height: this.grips[2].y,
        };
    }

    setTransform(p: IRect): void {
        this.x = p.x;
        this.y = p.y;
        this.width = p.width;
        this.height = p.height;

        BB.css(this.rootEl, {
            left: this.x * this.scale + 'px',
            top: this.y * this.scale + 'px',
        });

        this.grips[0].x = 0;
        this.grips[0].y = 0;
        this.grips[1].x = this.width;
        this.grips[1].y = 0;
        this.grips[2].x = this.width;
        this.grips[2].y = this.height;
        this.grips[3].x = 0;
        this.grips[3].y = this.height;

        this.update();
        this.commit();
    }

    setScale(s: number): void {
        this.scale = s;
        BB.css(this.rootEl, {
            left: this.x * this.scale + 'px',
            top: this.y * this.scale + 'px',
        });
        this.update();
    }

    showThirds(b: boolean): void {
        this.thirdsHorizontal.el.style.display = b ? 'block' : 'none';
        this.thirdsVertical.el.style.display = b ? 'block' : 'none';
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.keyListener.destroy();
        this.outlinePointerListener.destroy();
        this.corner0PointerListener.destroy();
        this.corner1PointerListener.destroy();
        this.corner2PointerListener.destroy();
        this.corner3PointerListener.destroy();
        this.edge0PointerListener.destroy();
        this.edge1PointerListener.destroy();
        this.edge2PointerListener.destroy();
        this.edge3PointerListener.destroy();
    }
}
