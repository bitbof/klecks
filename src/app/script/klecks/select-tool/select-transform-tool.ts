import { IBounds, IVector2D } from '../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import {
    compose,
    Matrix,
    scale,
    translate,
    identity,
    rotate,
    applyToPoint,
    decomposeTSR,
} from 'transformation-matrix';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { TLayerComposite, TSelectionSample } from '../canvas/kl-canvas';
import { BB } from '../../bb/bb';
import { IFreeTransform, snapToPixel } from '../ui/components/free-transform-utils';
import { integerBounds } from '../../bb/math/math';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';

function matrixToFreeTransform(transform: Matrix, bounds: IBounds): IFreeTransform {
    const centerBefore = {
        x: bounds.x1 + (bounds.x2 - bounds.x1) / 2,
        y: bounds.y1 + (bounds.y2 - bounds.y1) / 2,
    };
    const centerAfter = applyToPoint(transform, centerBefore);
    const decomposed = decomposeTSR(transform);
    const angleDeg = BB.round((decomposed.rotation.angle / Math.PI) * 180, 7);

    const tlBefore = {
        x: bounds.x1,
        y: bounds.y1,
    };
    const trBefore = {
        x: bounds.x2,
        y: bounds.y1,
    };
    const blBefore = {
        x: bounds.x1,
        y: bounds.y2,
    };

    const [tlAfter, trAfter, blAfter] = [tlBefore, trBefore, blBefore].map((p) => {
        return applyToPoint(transform, p);
    });
    let width = BB.Vec2.dist(trAfter, tlAfter);
    let height = BB.Vec2.dist(blAfter, tlAfter);

    if (decomposed.scale.sx < 0) {
        width = -width;
    }
    if (decomposed.scale.sy < 0) {
        height = -height;
    }

    return {
        ...centerAfter,
        width,
        height,
        angleDeg,
    };
}

function freeTransformToMatrix(transform: IFreeTransform, bounds: IBounds): Matrix {
    const centerBefore = {
        x: bounds.x1 + (bounds.x2 - bounds.x1) / 2,
        y: bounds.y1 + (bounds.y2 - bounds.y1) / 2,
    };

    const widthBefore = bounds.x2 - bounds.x1;
    const heightBefore = bounds.y2 - bounds.y1;

    const scaleX = transform.width / widthBefore;
    const scaleY = transform.height / heightBefore;

    const angleRad = (transform.angleDeg / 180) * Math.PI;

    return compose(
        translate(transform.x, transform.y),
        rotate(angleRad),
        scale(scaleX, scaleY),
        translate(-centerBefore.x, -centerBefore.y),
    );
}

/**
 * to facilitate KlCanvas.transformViaSelection and provide a preview (composite)
 */
export class SelectTransformTool {
    private selection: MultiPolygon = [];
    private selectionBounds: IBounds = {} as IBounds;
    private transform: Matrix = {} as Matrix;
    private doClone: boolean = false; // true -> draw selected area twice (original position, and transformed position)
    private selectionSample: TSelectionSample | undefined;
    private backgroundIsTransparent: boolean = false;

    // ----------------------------------- public -----------------------------------
    constructor() {}

    setBackgroundIsTransparent(isTransparent: boolean): void {
        this.backgroundIsTransparent = isTransparent;
    }

    setSelection(selection: MultiPolygon): void {
        this.selection = selection;
        this.selectionBounds = integerBounds(getMultiPolyBounds(this.selection)); // floor & ceil to prevent blurriness
        this.transform = identity();
    }

    isTransformationChanged(): boolean {
        const identityMatrix = identity();
        const keys = Object.keys(identityMatrix) as (keyof Matrix)[];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (identityMatrix[key] !== this.transform[key]) {
                return true;
            }
        }
        return false;
    }

    reset(): void {
        this.transform = identity();
        this.selection = [];
        this.selectionBounds = {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
        };
    }

    // ---- transform ----

    translate(d: IVector2D): void {
        this.transform = compose(translate(d.x, d.y), this.transform);
    }

    flip(axis: 'x' | 'y'): void {
        const center = {
            x: (this.selectionBounds.x1 + this.selectionBounds.x2) / 2,
            y: (this.selectionBounds.y1 + this.selectionBounds.y2) / 2,
        };
        const transformedCenter = applyToPoint(this.transform, center);
        this.transform = compose(
            translate(transformedCenter.x, transformedCenter.y),
            scale(axis === 'x' ? -1 : 1, axis === 'y' ? -1 : 1),
            translate(-transformedCenter.x, -transformedCenter.y),
            this.transform,
        );
    }

    rotateDeg(deg: number): void {
        const center = {
            x: (this.selectionBounds.x1 + this.selectionBounds.x2) / 2,
            y: (this.selectionBounds.y1 + this.selectionBounds.y2) / 2,
        };
        const transformedCenter = applyToPoint(this.transform, center);
        this.transform = compose(
            translate(transformedCenter.x, transformedCenter.y),
            rotate((deg / 180) * Math.PI),
            translate(-transformedCenter.x, -transformedCenter.y),
            this.transform,
        );
    }

    // --------

    setDoClone(b: boolean): void {
        this.doClone = b;
    }

    getDoClone(): boolean {
        return this.doClone;
    }

    getTransform(): Matrix {
        const freeTransform = matrixToFreeTransform(this.transform, this.selectionBounds);
        snapToPixel(freeTransform);
        return freeTransformToMatrix(freeTransform, this.selectionBounds);
    }

    setTransform(transform: Matrix): void {
        this.transform = transform;
    }

    getTransformedSelection(): MultiPolygon {
        return transformMultiPolygon(this.selection, this.getTransform());
    }

    setSelectionSample(selectionSample: TSelectionSample | undefined): void {
        this.selectionSample = selectionSample;
    }

    /**
     * creates composite for KlCanvas layer
     * if source === target
     */
    createComposite(originalSrcCanvas: HTMLCanvasElement): TLayerComposite {
        const selectionPath = getSelectionPath2d(this.selection);
        const transform = this.getTransform();

        return {
            draw: (ctx: CanvasRenderingContext2D) => {
                ctx.save();

                if (this.selectionSample && this.doClone) {
                    if (this.selectionSample.image) {
                        ctx.setTransform(...matrixToTuple(transform));
                        ctx.clip(selectionPath);
                        const canvasTransform = compose(
                            transform,
                            this.selectionSample.transformation,
                        );
                        ctx.setTransform(...matrixToTuple(canvasTransform));
                        ctx.drawImage(this.selectionSample.image, 0, 0);
                    }
                } else {
                    //draw original with inverted selection before transformation
                    if (!this.doClone) {
                        ctx.save();
                        ctx.clip(selectionPath);
                        if (this.backgroundIsTransparent) {
                            ctx.clearRect(0, 0, originalSrcCanvas.width, originalSrcCanvas.height);
                        } else {
                            ctx.globalCompositeOperation = 'source-in';
                            ctx.fillStyle = '#fff';
                            ctx.fillRect(0, 0, originalSrcCanvas.width, originalSrcCanvas.height);
                        }
                        ctx.restore();
                    }

                    ctx.setTransform(...matrixToTuple(transform));
                    ctx.clip(selectionPath);
                    ctx.drawImage(originalSrcCanvas, 0, 0);
                }

                ctx.restore();
            },
        } as any;
    }

    /**
     * creates composite for source KlCanvas layer
     * if source != target
     */
    createSourceComposite(originalSrcCanvas: HTMLCanvasElement): TLayerComposite | undefined {
        const selectionPath = getSelectionPath2d(this.selection);

        if (this.doClone) {
            return undefined;
        }

        return {
            draw: (ctx: CanvasRenderingContext2D) => {
                //draw original with inverted selection before transformation
                ctx.save();
                ctx.clip(selectionPath);
                if (this.backgroundIsTransparent) {
                    ctx.clearRect(0, 0, originalSrcCanvas.width, originalSrcCanvas.height);
                } else {
                    ctx.globalCompositeOperation = 'source-in';
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, originalSrcCanvas.width, originalSrcCanvas.height);
                }
                ctx.restore();
            },
        } as any;
    }

    /**
     * creates composite for target KlCanvas layer
     * if source != target
     */
    createTargetComposite(originalSrcCanvas: HTMLCanvasElement): TLayerComposite {
        const selectionPath = getSelectionPath2d(this.selection);
        const transform = this.getTransform();

        return {
            draw: (ctx: CanvasRenderingContext2D) => {
                ctx.save();

                if (this.selectionSample && this.doClone) {
                    if (this.selectionSample.image) {
                        ctx.setTransform(...matrixToTuple(transform));
                        ctx.clip(selectionPath);
                        const canvasTransform = compose(
                            transform,
                            this.selectionSample.transformation,
                        );
                        ctx.setTransform(...matrixToTuple(canvasTransform));
                        ctx.drawImage(this.selectionSample.image, 0, 0);
                    }
                } else {
                    ctx.setTransform(...matrixToTuple(transform));
                    ctx.clip(selectionPath);
                    ctx.drawImage(originalSrcCanvas, 0, 0);
                }

                ctx.restore();
            },
        } as any;
    }
}
