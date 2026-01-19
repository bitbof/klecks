import { TBounds, TVector2D } from '../../bb/bb-types';
import { MultiPolygon } from 'polygon-clipping';
import { getSelectionPath2d } from '../../bb/multi-polygon/get-selection-path-2d';
import {
    applyToPoint,
    compose,
    identity,
    Matrix,
    rotate,
    scale,
    translate,
} from 'transformation-matrix';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { TLayerComposite } from '../canvas/kl-canvas';
import { TFreeTransform } from '../ui/components/free-transform-utils';
import { integerBounds } from '../../bb/math/math';
import { matrixToTuple } from '../../bb/math/matrix-to-tuple';
import { TInterpolationAlgorithm } from '../kl-types';
import { setContextAlgorithm } from '../utils/set-context-algorithm';
import { TSelectionSample } from '../canvas/kl-canvas-transform';

export function freeTransformToMatrix(transform: TFreeTransform, bounds: TBounds): Matrix {
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
 * hold transformation state and provide a preview
 */
export class SelectTransformTool {
    private selection: MultiPolygon = [];
    private selectionBounds: TBounds = {} as TBounds;
    private transform: Matrix = {} as Matrix;
    private doClone: boolean = false; // true -> draw selected area twice (original position, and transformed position)
    private selectionSample: TSelectionSample | undefined;
    private backgroundIsTransparent: boolean = false;
    private algorithm: TInterpolationAlgorithm = 'smooth';

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

    translate(d: TVector2D): void {
        this.transform = compose(translate(d.x, d.y), this.transform);
    }

    center(centerX: number, centerY: number): void {
        const freeTransformCenter = {
            x: (this.selectionBounds.x1 + this.selectionBounds.x2) / 2,
            y: (this.selectionBounds.y1 + this.selectionBounds.y2) / 2,
        };
        const transformedCenter = applyToPoint(this.transform, freeTransformCenter);
        this.transform = compose(
            translate(centerX - transformedCenter.x, centerY - transformedCenter.y),
            this.transform,
        );
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

    scale(factor: number): void {
        const center = {
            x: (this.selectionBounds.x1 + this.selectionBounds.x2) / 2,
            y: (this.selectionBounds.y1 + this.selectionBounds.y2) / 2,
        };
        const transformedCenter = applyToPoint(this.transform, center);
        this.transform = compose(
            translate(transformedCenter.x, transformedCenter.y),
            scale(factor),
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
        return this.transform;
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

    setAlgorithm(algorithm: TInterpolationAlgorithm) {
        this.algorithm = algorithm;
    }

    getAlgorithm(): TInterpolationAlgorithm {
        return this.algorithm;
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
                setContextAlgorithm(ctx, this.algorithm);

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
                setContextAlgorithm(ctx, this.algorithm);

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
                setContextAlgorithm(ctx, this.algorithm);

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
