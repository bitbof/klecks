import { BB } from '../../../bb/bb';
import rotateImg from '/src/app/img/ui/cursor-rotate.png';
import { KeyListener } from '../../../bb/input/key-listener';
import { IVector2D } from '../../../bb/bb-types';
import { PointerListener } from '../../../bb/input/pointer-listener';
import {
    copyTransform,
    IFreeTransform,
    snapToPixel,
    TFreeTransformCorner,
    TFreeTransformEdge,
    toImageSpace,
    toTransformSpace,
} from './free-transform-utils';

/**
 * Free Transform UI
 * rotate, scale, translate
 *
 * - if rotation is multiple of 90° it will snap to pixels, to be more useful for pixel art
 * - when rotation goes from non-multiple of 90° to a multiple, it will snap position and width height to pixels
 * - transform.x, transform.y can sit between pixels (by 0.5) if width or height is odd number.
 *      - this is what complicates things
 * - if transform region small, corner grips move out of the way
 *
 * iX iY, iP.x, iP.y - i indicates image space
 * tX tY, tP.x, tP.y - t indicates transform space
 *
 * Not sure if it can be used for navigable canvas. (especially if canvas rotates view)
 * Probably can't be extended for distort. Needs a different approach.
 *
 * --- DOM structure ---
 * rootEl {
 * 	transEl [
 * 		boundsEl
 * 		edges[]
 * 		corners[] - round grips in the corner of transform region
 * 		angleGrip
 * 	]
 * }
 *
 */
export class FreeTransform {
    // --- private ---
    private readonly value: IFreeTransform; // coordinates and dimensions of transformation
    private isConstrained: boolean;
    private ratio: number; // aspect ratio of transform
    private viewportTransform: { scale: number; x: number; y: number };
    private readonly scaled = {
        // scaled coordinates and dimensions for screen space
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        corners: [{ x: 0, y: 0 }], // in transform space
    };
    private readonly minSnapDist = 7; // minimal snapping distance in px screen space
    private snappingEnabled: boolean;
    private readonly snapX: number[];
    private readonly snapY: number[];
    private readonly callback: (transform: IFreeTransform) => void;

    private readonly cornerCursors = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    private readonly gripSize = 16;
    private readonly edgeSize = 10;

    private readonly rootEl: HTMLElement; // sits at origin of image
    private readonly transEl: HTMLElement; // at middle of transform. rotates
    private readonly boundsEl: HTMLElement; // draggable bounds rectangle with outline
    private readonly corners: TFreeTransformCorner[] = [];
    private keyListener: KeyListener;
    private boundsPointerListener: PointerListener; // BB.PointerListener
    private anglePointerListener: PointerListener; // BB.PointerListener
    private readonly edges: TFreeTransformEdge[] = [];
    private readonly angleGrip: {
        el: HTMLElement;
        x: number; // transform space
        y: number;
        snap: boolean;
        updateDOM: () => void;
    };

    private updateScaled(): void {
        this.scaled.x = this.value.x * this.viewportTransform.scale;
        this.scaled.y = this.value.y * this.viewportTransform.scale;
        this.scaled.width = this.value.width * this.viewportTransform.scale;
        this.scaled.height = this.value.height * this.viewportTransform.scale;
        this.scaled.corners = this.corners.map((item) => {
            return {
                x: item.x * this.viewportTransform.scale,
                y: item.y * this.viewportTransform.scale,
            };
        });
    }

    /**
     * Returns snapped point, if ix, iy snaps. If no snapping, returns point unchanged.
     * both in image space
     *
     * @param iX - image space
     * @param iY - image space
     * @private
     */
    private snapCorner(iX: number, iY: number): IVector2D {
        if (!this.snappingEnabled) {
            return { x: iX, y: iY };
        }
        let dist: number;
        const snap: {
            x?: number;
            y?: number;
            dist: {
                x?: number;
                y?: number;
            };
        } = {
            x: undefined,
            y: undefined,
            dist: {
                x: undefined,
                y: undefined,
            },
        };
        for (let e = 0; e < this.snapX.length; e++) {
            dist = Math.abs(iX - this.snapX[e]);
            if (dist < this.minSnapDist / this.viewportTransform.scale) {
                if (snap.x === undefined || dist < snap.dist.x!) {
                    snap.x = this.snapX[e];
                    snap.dist.x = dist;
                }
            }
        }
        for (let e = 0; e < this.snapY.length; e++) {
            dist = Math.abs(iY - this.snapY[e]);
            if (dist < this.minSnapDist / this.viewportTransform.scale) {
                if (snap.y === undefined || dist < snap.dist.y!) {
                    snap.y = this.snapY[e];
                    snap.dist.y = dist;
                }
            }
        }

        if (snap.x === undefined && snap.y === undefined) {
            return {
                x: iX,
                y: iY,
            };
        }
        return {
            x: snap.x ?? iX,
            y: snap.y ?? iY,
        };
    }

    /**
     * If constrained return nearest corner pos that fits aspect ratio
     *
     * @param cornerIndex
     * @param iX
     * @param iY
     * @private
     */
    private constrainCorner(cornerIndex: number, iX: number, iY: number): IVector2D {
        if (!this.isConstrained) {
            return {
                x: iX,
                y: iY,
            };
        }
        const flip = this.value.width * this.value.height < 0 ? -1 : 1;
        return BB.projectPointOnLine(
            { x: this.value.x, y: this.value.y },
            toImageSpace(this.ratio, flip * ([0, 2].includes(cornerIndex) ? 1 : -1), this.value),
            { x: iX, y: iY },
        );
    }

    /**
     * Update corners according to width height.
     * Not their DOM.
     */
    private updateCornerPositions(): void {
        this.corners[0].x = -this.value.width / 2; // top left
        this.corners[0].y = -this.value.height / 2;

        this.corners[1].x = this.value.width / 2; // top right
        this.corners[1].y = -this.value.height / 2;

        this.corners[2].x = this.value.width / 2; // bottom right
        this.corners[2].y = this.value.height / 2;

        this.corners[3].x = -this.value.width / 2; // bottom left
        this.corners[3].y = this.value.height / 2;
    }

    /**
     * If constrained and dragging an edge, restore aspect ratio
     * Updates corner positions.
     *
     * @param widthChanged
     * @param heightChanged
     * @private
     */
    private restoreRatio(widthChanged: boolean, heightChanged: boolean): void {
        if (!this.isConstrained) {
            return;
        }
        const angle90 = Math.abs(this.value.angleDeg) % 90 === 0;
        const whSwapped = Math.abs(this.value.angleDeg - 90) % 180 === 0;
        if (heightChanged && !widthChanged) {
            const newHeight = Math.abs(this.corners[3].y - this.corners[0].y);
            let newWidth = this.ratio * newHeight;
            if (angle90) {
                newWidth =
                    (whSwapped ? this.value.y % 1 : this.value.x % 1) === 0
                        ? BB.roundEven(newWidth)
                        : BB.roundUneven(newWidth);
            }
            if (this.corners[1].x - this.corners[0].x < 0) {
                newWidth *= -1;
            }
            this.corners[0].x = -newWidth / 2;
            this.corners[3].x = -newWidth / 2;
            this.corners[1].x = newWidth / 2;
            this.corners[2].x = newWidth / 2;
        }
        if (!heightChanged && widthChanged) {
            const newWidth = Math.abs(this.corners[0].x - this.corners[1].x);
            let newHeight = newWidth / this.ratio;
            if (angle90) {
                newHeight =
                    (whSwapped ? this.value.x % 1 : this.value.y % 1) === 0
                        ? BB.roundEven(newHeight)
                        : BB.roundUneven(newHeight);
            }
            if (this.corners[3].y - this.corners[0].y < 0) {
                newHeight *= -1;
            }
            this.corners[0].y = -newHeight / 2;
            this.corners[1].y = -newHeight / 2;
            this.corners[2].y = newHeight / 2;
            this.corners[3].y = newHeight / 2;
        }
    }

    /**
     * update transform based on corners
     * @private
     */
    private updateTransformViaCorners(): void {
        // calc transform center in image space
        const rot = BB.rotateAround(
            { x: 0, y: 0 },
            {
                x: (this.corners[0].x + this.corners[1].x) / 2,
                y: (this.corners[0].y + this.corners[3].y) / 2,
            },
            this.value.angleDeg,
        );
        this.value.x = rot.x + this.value.x;
        this.value.y = rot.y + this.value.y;

        // update size
        this.value.width = this.corners[1].x - this.corners[0].x;
        this.value.height = this.corners[3].y - this.corners[0].y;

        // new center means corners changed their position
        this.updateCornerPositions();

        this.updateDOM();
    }

    /**
     * updates DOM according to transform
     * @param skipCallback
     */
    private updateDOM(skipCallback?: boolean): void {
        this.updateScaled();

        BB.css(this.transEl, {
            left: this.viewportTransform.x + this.scaled.x + 'px',
            top: this.viewportTransform.y + this.scaled.y + 'px',
            transformOrigin: '0 0',
            transform: 'rotate(' + this.value.angleDeg + 'deg)',
        });

        BB.css(this.boundsEl, {
            width: Math.abs(this.scaled.width) + 'px',
            height: Math.abs(this.scaled.height) + 'px',
            left: Math.min(this.scaled.corners[0].x, this.scaled.corners[1].x) + 'px',
            top: Math.min(this.scaled.corners[0].y, this.scaled.corners[3].y) + 'px',
        });

        this.corners[0].updateDOM();
        this.corners[1].updateDOM();
        this.corners[2].updateDOM();
        this.corners[3].updateDOM();

        this.edges[0].updateDOM();
        this.edges[1].updateDOM();
        this.edges[2].updateDOM();
        this.edges[3].updateDOM();

        this.angleGrip.x = 0;
        this.angleGrip.y = -Math.abs(this.value.height * this.viewportTransform.scale) / 2 - 20;
        this.angleGrip.updateDOM();
        if (!skipCallback) {
            if (this.callback) {
                // why should updateDOM trigger the callback?
                this.callback(copyTransform(this.value));
            }
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(params: {
        x: number; // center of transform region. image space
        y: number;
        width: number; // size of transform region. image space
        height: number;
        angleDeg: number; // angle of transform region. degrees

        isConstrained: boolean; // proportions constrained
        snapX: number[]; // where snapping along X axis. image space
        snapY: number[]; // where snapping along X axis. image space
        viewportTransform: { scale: number; x: number; y: number };
        callback: (transform: IFreeTransform) => void;
    }) {
        this.viewportTransform = { ...params.viewportTransform };
        this.value = {
            // coordinates and dimensions of transformation
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
            angleDeg: params.angleDeg,
        };

        this.isConstrained = params.isConstrained;

        this.snapX = params.snapX;
        this.snapY = params.snapY;
        this.callback = params.callback;
        this.snappingEnabled = true;
        this.ratio = this.value.width / this.value.height;

        this.rootEl = BB.el({
            className: 'kl-free-transform',
            css: {
                userSelect: 'none',
            },
        });
        this.transEl = BB.el({
            parent: this.rootEl,
            css: {
                position: 'absolute',
            },
        });

        this.boundsEl = BB.el({
            css: {
                position: 'absolute',
                cursor: 'move',
                boxShadow: 'rgba(255, 255, 255, 0.5) 0 0 0 1px inset, rgba(0, 0, 0, 0.5) 0 0 0 1px',
            },
        });

        const pointerRemainder = {
            x: 0,
            y: 0,
        };
        function resetRemainder(): void {
            pointerRemainder.x = 0;
            pointerRemainder.y = 0;
        }
        this.keyListener = new BB.KeyListener({});

        let boundsStartP = {
            x: 0,
            y: 0,
        };
        this.boundsPointerListener = new BB.PointerListener({
            target: this.boundsEl,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointerdown') {
                    boundsStartP = { x: this.value.x, y: this.value.y };
                }
                if (event.type === 'pointermove' && event.button === 'left') {
                    this.value.x =
                        boundsStartP.x +
                        (event.pageX - event.downPageX!) / this.viewportTransform.scale;
                    this.value.y =
                        boundsStartP.y +
                        (event.pageY - event.downPageY!) / this.viewportTransform.scale;

                    let dist: number;
                    let snap: {
                        x?: number;
                        y?: number;
                        distX: number;
                        distY: number;
                    } = {
                        distX: -1,
                        distY: -1,
                    };
                    if (this.snappingEnabled) {
                        let i;
                        for (i = 0; i < this.snapX.length; i++) {
                            dist = Math.abs(this.value.x - this.snapX[i]);
                            if (dist < this.minSnapDist / this.viewportTransform.scale) {
                                if (snap.x === undefined || dist < snap.distX) {
                                    snap.x = this.snapX[i];
                                    snap.distX = dist;
                                }
                            }
                        }
                        for (i = 0; i < this.snapY.length; i++) {
                            dist = Math.abs(this.value.y - this.snapY[i]);
                            if (dist < this.minSnapDist / this.viewportTransform.scale) {
                                if (snap.y === undefined || dist < snap.distY) {
                                    snap.y = this.snapY[i];
                                    snap.distY = dist;
                                }
                            }
                        }

                        let iP;
                        for (i = 0; i < 4; i++) {
                            iP = toImageSpace(this.corners[i].x, this.corners[i].y, this.value);
                            let j;
                            for (j = 0; j < this.snapX.length; j++) {
                                dist = Math.abs(iP.x - this.snapX[j]);
                                if (dist < this.minSnapDist / this.viewportTransform.scale) {
                                    if (snap.x === undefined || dist < snap.distX) {
                                        snap.x = this.snapX[j] - (iP.x - this.value.x);
                                        snap.distX = dist;
                                    }
                                }
                            }
                            for (j = 0; j < this.snapY.length; j++) {
                                dist = Math.abs(iP.y - this.snapY[j]);
                                if (dist < this.minSnapDist / this.viewportTransform.scale) {
                                    if (snap.y === undefined || dist < snap.distY) {
                                        snap.y = this.snapY[j] - (iP.y - this.value.y);
                                        snap.distY = dist;
                                    }
                                }
                            }
                        }
                    }
                    if (this.keyListener.getComboStr() === 'shift') {
                        let projected = BB.projectPointOnLine(
                            { x: 0, y: boundsStartP.y },
                            { x: 10, y: boundsStartP.y },
                            { x: this.value.x, y: this.value.y },
                        );
                        let dist = BB.dist(projected.x, projected.y, this.value.x, this.value.y);
                        snap = {
                            x: projected.x,
                            y: projected.y,
                            distX: dist,
                            distY: dist,
                        };

                        projected = BB.projectPointOnLine(
                            { x: boundsStartP.x, y: 0 },
                            { x: boundsStartP.x, y: 10 },
                            { x: this.value.x, y: this.value.y },
                        );
                        dist = BB.dist(projected.x, projected.y, this.value.x, this.value.y);
                        if (dist < snap.distX) {
                            snap = {
                                x: projected.x,
                                y: projected.y,
                                distX: dist,
                                distY: dist,
                            };
                        }

                        projected = BB.projectPointOnLine(
                            { x: boundsStartP.x, y: boundsStartP.y },
                            { x: boundsStartP.x + 1, y: boundsStartP.y + 1 },
                            { x: this.value.x, y: this.value.y },
                        );
                        dist = BB.dist(projected.x, projected.y, this.value.x, this.value.y);
                        if (dist < snap.distX) {
                            snap = {
                                x: projected.x,
                                y: projected.y,
                                distX: dist,
                                distY: dist,
                            };
                        }

                        projected = BB.projectPointOnLine(
                            { x: boundsStartP.x, y: boundsStartP.y },
                            { x: boundsStartP.x + 1, y: boundsStartP.y - 1 },
                            { x: this.value.x, y: this.value.y },
                        );
                        dist = BB.dist(projected.x, projected.y, this.value.x, this.value.y);
                        if (dist < snap.distX) {
                            snap = {
                                x: projected.x,
                                y: projected.y,
                                distX: dist,
                                distY: dist,
                            };
                        }
                    }
                    if (snap.x != undefined) {
                        this.value.x = snap.x;
                    }
                    if (snap.y != undefined) {
                        this.value.y = snap.y;
                    }

                    // snap to pixels
                    if (Math.abs(this.value.angleDeg) % 90 === 0) {
                        snapToPixel(this.value);
                        this.updateCornerPositions();
                    }

                    this.updateDOM();
                }
            },
        });

        for (let i = 0; i < 4; i++) {
            ((i) => {
                const g = (this.corners[i] = {
                    i: i,
                    el: BB.el({
                        css: {
                            width: this.gripSize + 'px',
                            height: this.gripSize + 'px',
                            background: '#fff',
                            /*background: [
                                '#ff0000',
                                '#00ff00',
                                '#0000ff',
                                '#ff00ff',
                            ][i],*/
                            borderRadius: this.gripSize + 'px',
                            position: 'absolute',
                            border: '2px solid #000',
                        },
                    }) as HTMLElement,
                    x: 0,
                    y: 0,
                    virtualPos: {
                        x: 0,
                        y: 0,
                    },
                } as TFreeTransformCorner);
                g.updateDOM = (): void => {
                    // grip position
                    // if it gets small: slightly offset grips, so easier to handle
                    const offsetArr = [
                        [-1, -1],
                        [1, -1],
                        [1, 1],
                        [-1, 1],
                    ].map((item) => {
                        item[0] *= this.value.width > 0 ? 1 : -1;
                        item[1] *= this.value.height > 0 ? 1 : -1;
                        return item;
                    });
                    const tinyOffset =
                        Math.abs(this.scaled.width) < 20 || Math.abs(this.scaled.height) < 20
                            ? 10
                            : 0;

                    BB.css(g.el, {
                        left:
                            this.scaled.corners[g.i].x -
                            this.gripSize / 2 +
                            offsetArr[i][0] * tinyOffset +
                            'px',
                        top:
                            this.scaled.corners[g.i].y -
                            this.gripSize / 2 +
                            offsetArr[i][1] * tinyOffset +
                            'px',
                    });

                    // cursor
                    let angle =
                        BB.pointsToAngleDeg(
                            {
                                x: this.value.x,
                                y: this.value.y,
                            },
                            toImageSpace(g.x, g.y, this.value),
                        ) + 135; // offset so nw is 0
                    while (angle < 0) {
                        angle += 360;
                    }
                    const index = Math.round(angle / 45) % this.cornerCursors.length;
                    BB.css(g.el, {
                        cursor: this.cornerCursors[index] + '-resize',
                    });
                };

                g.pointerListener = new BB.PointerListener({
                    target: this.corners[i].el,
                    fixScribble: true,
                    onPointer: (event) => {
                        event.eventPreventDefault();
                        if (event.type === 'pointerdown' && event.button === 'left') {
                            this.corners[i].virtualPos = toImageSpace(
                                this.corners[i].x,
                                this.corners[i].y,
                                this.value,
                            );
                        } else if (event.type === 'pointermove' && event.button === 'left') {
                            this.corners[i].virtualPos.x += event.dX / this.viewportTransform.scale;
                            this.corners[i].virtualPos.y += event.dY / this.viewportTransform.scale;

                            let iP = {
                                x: this.corners[i].virtualPos.x,
                                y: this.corners[i].virtualPos.y,
                            };
                            iP = this.constrainCorner(i, iP.x, iP.y);
                            if (!this.isConstrained) {
                                iP = this.snapCorner(iP.x, iP.y);
                            }

                            if (Math.abs(this.value.angleDeg) % 90 === 0) {
                                iP.x = Math.round(iP.x);
                                iP.y = Math.round(iP.y);
                            }

                            const tP = toTransformSpace(iP.x, iP.y, this.value);

                            const dX = tP.x - this.corners[i].x;
                            const dY = tP.y - this.corners[i].y;
                            this.corners[i].x = tP.x;
                            this.corners[i].y = tP.y;

                            let indexes: number[] = [];
                            if (i === 0) {
                                // top left
                                indexes = [3, 1, 2];
                            } else if (i === 1) {
                                // top right
                                indexes = [2, 0, 3];
                            } else if (i === 2) {
                                // bottom right
                                indexes = [1, 3, 0];
                            } else if (i === 3) {
                                // bottom left
                                indexes = [0, 2, 1];
                            }

                            this.corners[indexes[0]].x = this.corners[i].x;
                            this.corners[indexes[1]].y = this.corners[i].y;
                            if (this.keyListener.isPressed('shift')) {
                                this.corners[indexes[2]].x -= dX;
                                this.corners[indexes[2]].y -= dY;
                                this.corners[indexes[1]].x = this.corners[indexes[2]].x;
                                this.corners[indexes[0]].y = this.corners[indexes[2]].y;
                            }

                            this.updateTransformViaCorners();
                        }
                    },
                });
            })(i);
        }

        this.updateCornerPositions();
        this.updateScaled();

        let isInverted: boolean;
        for (let i = 0; i < 4; i++) {
            ((i): void => {
                this.edges[i] = {
                    el: BB.el({
                        css: {
                            width: this.edgeSize + 'px',
                            height: this.edgeSize + 'px',
                            /*background: [
                                '#ff000044',
                                '#00ff0044',
                                '#0000ff44',
                                '#ff00ff44',
                            ][i],*/
                            position: 'absolute',
                        },
                    }) as HTMLElement,
                } as TFreeTransformEdge;
                const g = this.edges[i];
                g.updateDOM = () => {
                    if (i === 0) {
                        BB.css(g.el, {
                            left:
                                Math.min(this.scaled.corners[0].x, this.scaled.corners[1].x) + 'px',
                            top:
                                Math.min(this.scaled.corners[0].y, this.scaled.corners[3].y) -
                                this.edgeSize +
                                'px',
                            width: Math.abs(this.scaled.width) + 'px',
                            height: this.edgeSize + 'px',
                        });
                    } else if (i === 1) {
                        BB.css(g.el, {
                            left:
                                Math.max(this.scaled.corners[0].x, this.scaled.corners[1].x) + 'px',
                            top:
                                Math.min(this.scaled.corners[1].y, this.scaled.corners[2].y) + 'px',
                            width: this.edgeSize + 'px',
                            height: Math.abs(this.scaled.height) + 'px',
                        });
                    } else if (i === 2) {
                        BB.css(g.el, {
                            left:
                                Math.min(this.scaled.corners[3].x, this.scaled.corners[2].x) + 'px',
                            top:
                                Math.max(this.scaled.corners[0].y, this.scaled.corners[3].y) + 'px',
                            width: Math.abs(this.scaled.width) + 'px',
                            height: this.edgeSize + 'px',
                        });
                    } else if (i === 3) {
                        BB.css(g.el, {
                            left:
                                Math.min(this.scaled.corners[0].x, this.scaled.corners[1].x) -
                                this.edgeSize +
                                'px',
                            top:
                                Math.min(this.scaled.corners[0].y, this.scaled.corners[3].y) + 'px',
                            width: this.edgeSize + 'px',
                            height: Math.abs(this.scaled.height) + 'px',
                        });
                    }
                    let angleOffset = Math.round(this.value.angleDeg / 45);
                    while (angleOffset < 0) {
                        angleOffset += 8;
                    }
                    angleOffset = (i * 2 + 1 + angleOffset) % this.cornerCursors.length;
                    g.el.style.cursor = this.cornerCursors[angleOffset] + '-resize';
                };

                const isVertical = [0, 2].includes(i);
                g.pointerListener = new BB.PointerListener({
                    target: this.edges[i].el,
                    fixScribble: true,
                    onPointer: (event) => {
                        event.eventPreventDefault();
                        if (event.type === 'pointerdown' && event.button === 'left') {
                            if (isVertical) {
                                // top bottom
                                isInverted = this.corners[0].y >= this.corners[3].y;
                            } else {
                                // left right
                                isInverted = this.corners[0].x >= this.corners[1].x;
                            }
                            resetRemainder();
                        }
                        if (event.type === 'pointermove' && event.button === 'left') {
                            const tfD = BB.rotateAround(
                                { x: 0, y: 0 },
                                {
                                    x: event.dX / this.viewportTransform.scale,
                                    y: event.dY / this.viewportTransform.scale,
                                },
                                -this.value.angleDeg,
                            );
                            let ti = {
                                dX: tfD.x,
                                dY: tfD.y,
                            };
                            if (Math.abs(this.value.angleDeg) % 90 === 0) {
                                ti = BB.intDxy(pointerRemainder, tfD.x, tfD.y);
                            }

                            let indexes: number[] = [];
                            if (i === 0) {
                                // top
                                indexes = [2, 3, 0, 1];
                            } else if (i === 1) {
                                // right
                                indexes = [0, 3, 1, 2];
                            } else if (i === 2) {
                                // bottom
                                indexes = [0, 1, 2, 3];
                            } else if (i === 3) {
                                // left
                                indexes = [1, 2, 0, 3];
                            }

                            const dimension = isVertical ? 'y' : 'x';
                            const d = isVertical ? ti.dY : ti.dX;

                            if (isInverted) {
                                this.corners[indexes[0]][dimension] += d;
                                this.corners[indexes[1]][dimension] += d;
                            } else {
                                this.corners[indexes[2]][dimension] += d;
                                this.corners[indexes[3]][dimension] += d;
                            }
                            if (this.keyListener.isPressed('shift')) {
                                if (isInverted) {
                                    this.corners[indexes[2]][dimension] -= d;
                                    this.corners[indexes[3]][dimension] -= d;
                                } else {
                                    this.corners[indexes[0]][dimension] -= d;
                                    this.corners[indexes[1]][dimension] -= d;
                                }
                            }

                            if (isVertical) {
                                // top bottom
                                this.restoreRatio(false, true);
                            } else {
                                // left right
                                this.restoreRatio(true, false);
                            }

                            this.updateTransformViaCorners();
                        }
                    },
                });
            })(i);
        }

        this.angleGrip = {
            el: BB.el({
                css: {
                    cursor: 'url(' + rotateImg + ') 10 10, move',
                    width: this.gripSize + 'px',
                    height: this.gripSize + 'px',
                    background: '#0ff',
                    borderRadius: this.gripSize + 'px',
                    position: 'absolute',
                    boxShadow: 'inset 0 0 0 2px #000',
                },
            }),
            x: 0,
            y: 0,
            snap: false,
            updateDOM: () => {
                BB.css(this.angleGrip.el, {
                    left: this.angleGrip.x - this.gripSize / 2 + 'px',
                    top: this.angleGrip.y - this.gripSize / 2 + 'px',
                });
            },
        };
        BB.el({
            parent: this.angleGrip.el,
            css: {
                width: '2px',
                height: '13px',
                left: this.gripSize / 2 - 1 + 'px',
                top: this.gripSize + 'px',
                background: '#0ff',
                position: 'absolute',
            },
        });

        this.anglePointerListener = new BB.PointerListener({
            target: this.angleGrip.el,
            fixScribble: true,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.type === 'pointermove' && event.button === 'left') {
                    const bounds = this.rootEl.getBoundingClientRect();
                    const offset = {
                        x: bounds.left - this.rootEl.scrollLeft + this.viewportTransform.x,
                        y: bounds.top - this.rootEl.scrollTop + this.viewportTransform.y,
                    };
                    const iP = {
                        x: (event.clientX - offset.x) / this.viewportTransform.scale,
                        y: (event.clientY - offset.y) / this.viewportTransform.scale,
                    };

                    const a = BB.pointsToAngleDeg({ x: this.value.x, y: this.value.y }, iP) + 90;
                    this.value.angleDeg = a;
                    const snapDeg = Math.round((a / 360) * 8) * 45;
                    if (this.keyListener.getComboStr() === 'shift') {
                        this.value.angleDeg = snapDeg;
                    } else if (this.snappingEnabled && Math.abs(snapDeg - a) < 8) {
                        this.value.angleDeg = snapDeg;
                    }
                    this.updateDOM();
                }
                if (event.type === 'pointerup') {
                    if (Math.abs(this.value.angleDeg) % 90 === 0) {
                        snapToPixel(this.value);
                        this.updateCornerPositions();
                        this.updateDOM();
                    }
                }
            },
        });

        snapToPixel(this.value);
        this.updateDOM(true);
        BB.append(this.transEl, [
            this.boundsEl,
            this.edges[0].el,
            this.edges[1].el,
            this.edges[2].el,
            this.edges[3].el,
            this.corners[0].el,
            this.corners[1].el,
            this.corners[2].el,
            this.corners[3].el,
            this.angleGrip.el,
        ]);
    }

    getValue(): IFreeTransform {
        return copyTransform(this.value);
    }

    setIsConstrained(b: boolean): void {
        this.isConstrained = b;
        if (b && this.value.width !== 0 && this.value.height !== 0) {
            this.ratio = Math.abs(this.value.width / this.value.height);
        }
    }

    setSnapping(b: boolean): void {
        this.snappingEnabled = b;
    }

    setPos(p: IVector2D): void {
        this.value.x = p.x;
        this.value.y = p.y;
        this.updateDOM(true);
    }

    move(dX: number, dY: number): void {
        this.value.x += dX;
        this.value.y += dY;
        this.updateDOM(false);
    }

    setSize(w: number, h: number): void {
        this.value.width = w;
        this.value.height = h;
        if (Math.abs(this.value.angleDeg) % 90 === 0) {
            snapToPixel(this.value);
        }
        this.updateCornerPositions();
        this.updateDOM(false);
    }

    setAngleDeg(a: number): void {
        this.value.angleDeg = a;
        if (Math.abs(this.value.angleDeg) % 90 === 0) {
            snapToPixel(this.value);
            this.updateCornerPositions();
        }
        this.updateDOM(true);
    }

    setViewportTransform(transform: { scale: number; x: number; y: number }): void {
        this.viewportTransform = transform;
        this.updateScaled();
        this.updateDOM();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    getRatio(): number {
        return this.ratio;
    }

    destroy(): void {
        this.keyListener.destroy();
        this.boundsPointerListener.destroy();
        this.corners.forEach((item) => item.pointerListener.destroy());
        this.edges.forEach((item) => item.pointerListener.destroy());
        this.anglePointerListener.destroy();
    }
}
