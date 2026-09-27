import { applyToPoint, compose, Matrix, rotate, scale, translate } from 'transformation-matrix';
import { evalFFD, TFfdLattice } from './ffd';
import { TFreeTransform } from './transform-types';
import { TIndexBounds, TRect, TVector2D } from '../../bb/bb-types';
import { transformMultiPolygon } from '../../bb/multi-polygon/transform-multi-polygon';
import { MultiPolygon } from 'polygon-clipping';
import { boundsToRect, coordinateBoundsToIndexBounds, rectToBounds } from '../../bb/math/math';
import { getMultiPolyBounds } from '../../bb/multi-polygon/get-multi-polygon-bounds';
import { BB } from '../../bb/bb';
import { snapToPixel } from '../ui/components/free-transform-utils';
import { getFfdBounds } from './ffd-utils';

export const RENDERED_FFD_MESH_RESOLUTION = 64;

export type TComposedFree = {
    type: 'free';
    // in relation to selection bounds
    freeTransform: TFreeTransform;
};
export type TComposedFfd = {
    type: 'ffd';
    // in relation to selection bounds
    ffd: TFfdLattice;
};
export type TComposedFfdFree = {
    type: 'ffd+free';
    // in relation to selection bounds
    ffd: TFfdLattice;
    // bounds of ffd mesh created from `ffd`
    ffdBounds: TRect;
    // in relation to ffdBounds -> so first apply ffd, then freeTransform
    freeTransform: TFreeTransform;
};

export type TComposedTransformation = TComposedFree | TComposedFfd | TComposedFfdFree;

export function centerTransformation(
    transform: TComposedTransformation,
    center: TVector2D,
): TComposedTransformation {
    transform = BB.copyObj(transform);
    if (transform.type === 'free' || transform.type === 'ffd+free') {
        return {
            ...transform,
            freeTransform: snapToPixel({
                ...transform.freeTransform,
                x: center.x,
                y: center.y,
            }),
        };
    }
    // ffd
    const bounds = getFfdBounds(transform.ffd);
    // use freeTransform so we can use snapToPixel
    const freeTransform = rectToFreeTransform(boundsToRect(bounds));
    const snappedTransform = snapToPixel({
        ...freeTransform,
        x: center.x,
        y: center.y,
    });
    const matrix = freeTransformToMatrix(snappedTransform, coordinateBoundsToIndexBounds(bounds));
    return {
        type: 'ffd',
        ffd: transformFfd(transform.ffd, matrix),
    };
}

export function flipTransformation(
    transform: TComposedTransformation,
    axis: 'x' | 'y',
): TComposedTransformation {
    transform = BB.copyObj(transform);
    if (transform.type === 'free' || transform.type === 'ffd+free') {
        const ft = transform.freeTransform;
        return {
            ...transform,
            freeTransform: {
                ...ft,
                width: -ft.width,
                height: ft.height,
                angleDeg: axis === 'y' ? -ft.angleDeg + 180 : -ft.angleDeg,
            },
        };
    }
    // ffd
    const bounds = getFfdBounds(transform.ffd);
    const center = {
        x: (bounds.x1 + bounds.x2) / 2,
        y: (bounds.y1 + bounds.y2) / 2,
    };
    const matrix = compose(
        translate(center.x, center.y),
        scale(axis === 'x' ? -1 : 1, axis === 'y' ? -1 : 1),
        translate(-center.x, -center.y),
    );
    return {
        type: 'ffd',
        ffd: transformFfd(transform.ffd, matrix),
    };
}

export function scaleTransformation(
    transform: TComposedTransformation,
    factor: number,
): TComposedTransformation {
    transform = BB.copyObj(transform);
    if (transform.type === 'free' || transform.type === 'ffd+free') {
        const before = transform.freeTransform;
        // prevent edge cases (leading to NaN) where width and height are 0.
        if (factor > 1 && (factor * before.width === 0 || factor * before.height === 0)) {
            return transform;
        }
        if (factor < 1 && (factor * before.width < 1 || factor * before.height < 1)) {
            return transform;
        }
        return {
            ...transform,
            freeTransform: snapToPixel({
                ...transform.freeTransform,
                width: transform.freeTransform.width * factor,
                height: transform.freeTransform.height * factor,
            }),
        };
    }
    // ffd
    const bounds = getFfdBounds(transform.ffd);
    const center = {
        x: (bounds.x1 + bounds.x2) / 2,
        y: (bounds.y1 + bounds.y2) / 2,
    };
    const matrix = compose(
        translate(center.x, center.y),
        scale(factor),
        translate(-center.x, -center.y),
    );
    return {
        type: 'ffd',
        ffd: transformFfd(transform.ffd, matrix),
    };
}

export function rotateTransformation(
    transform: TComposedTransformation,
    deltaAngleDeg: number,
): TComposedTransformation {
    transform = BB.copyObj(transform);
    if (transform.type === 'free' || transform.type === 'ffd+free') {
        return {
            ...transform,
            freeTransform: snapToPixel({
                ...transform.freeTransform,
                angleDeg: (transform.freeTransform.angleDeg + deltaAngleDeg) % 360,
            }),
        };
    }
    // ffd
    const bounds = getFfdBounds(transform.ffd);
    // use freeTransform so we can use snapToPixel
    const freeTransform = rectToFreeTransform(boundsToRect(bounds));
    const snappedTransform = snapToPixel({
        ...freeTransform,
        angleDeg: deltaAngleDeg % 360,
    });
    const matrix = freeTransformToMatrix(snappedTransform, coordinateBoundsToIndexBounds(bounds));
    return {
        type: 'ffd',
        ffd: transformFfd(transform.ffd, matrix),
    };
}

export function freeTransformToMatrix(transform: TFreeTransform, bounds: TIndexBounds): Matrix {
    const rect = boundsToRect(bounds);
    const centerBefore = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
    };

    const scaleX = transform.width / rect.width;
    const scaleY = transform.height / rect.height;

    const angleRad = (transform.angleDeg / 180) * Math.PI;

    return compose(
        translate(transform.x, transform.y),
        rotate(angleRad),
        scale(scaleX, scaleY),
        translate(-centerBefore.x, -centerBefore.y),
    );
}

export function rectToFreeTransform(rect: TRect): TFreeTransform {
    return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        width: rect.width,
        height: rect.height,
        angleDeg: 0,
    };
}

// warps and automatically subdivides and optimizes the selection polygon
function warpSelection(
    ffd: TFfdLattice,
    selection: MultiPolygon,
    selectionBounds: TIndexBounds,
): MultiPolygon {
    const { width, height } = boundsToRect(selectionBounds);

    const result = selection.map((polygon) =>
        polygon.map((ring) => {
            // ring 1 - subdivide based on edge delta relative to selection bounds
            const ring1: [number, number][] = [];
            for (let i = 0; i < ring.length; i++) {
                const p1 = ring[i];
                const p2 = ring[(i + 1) % ring.length];

                // Add current point
                ring1.push(p1);

                // Subdivide based on whichever axis delta is proportionally larger
                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const ratioX = Math.abs(dx) / width;
                const ratioY = Math.abs(dy) / height;
                const dominantRatio = Math.max(ratioX, ratioY);
                const segments = Math.max(1, Math.round(dominantRatio * 4));

                for (let j = 1; j < segments; j++) {
                    const t = j / segments;
                    ring1.push([p1[0] + dx * t, p1[1] + dy * t]);
                }
            }

            // ring 2 - subdivide based on edge delta in warped space. but subdivide in the original space
            const ring2: [number, number][] = [];
            for (let i = 0; i < ring1.length; i++) {
                const p1 = ring1[i];
                const p2 = ring1[(i + 1) % ring1.length];

                ring2.push(p1);

                // Warp both endpoints to measure edge length in warped space
                const s1 = (p1[0] - selectionBounds.x1) / width;
                const t1 = (p1[1] - selectionBounds.y1) / height;
                const w1 = evalFFD(s1, t1, ffd);

                const s2 = (p2[0] - selectionBounds.x1) / width;
                const t2 = (p2[1] - selectionBounds.y1) / height;
                const w2 = evalFFD(s2, t2, ffd);

                const wdx = w2.x - w1.x;
                const wdy = w2.y - w1.y;
                const warpedLength = Math.sqrt(wdx * wdx + wdy * wdy);
                const segments = Math.max(1, Math.ceil(warpedLength / 4));

                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                for (let j = 1; j < segments; j++) {
                    const t = j / segments;
                    ring2.push([p1[0] + dx * t, p1[1] + dy * t]);
                }
            }

            const warpedRing = ring2.map<[number, number]>((point) => {
                // Convert point to normalized coordinates [0, 1]
                const s = (point[0] - selectionBounds.x1) / width;
                const t = (point[1] - selectionBounds.y1) / height;

                // Evaluate FFD at normalized coordinates
                const warped = evalFFD(s, t, ffd);
                return [warped.x, warped.y];
            });

            // optimized ring - remove collinear points
            const angleDegThreshold = 1;
            const cosThreshold = Math.cos((angleDegThreshold / 180) * Math.PI);
            const optimizedRing: [number, number][] = [];
            for (let i = 0; i < warpedRing.length - 1; i++) {
                const prev = optimizedRing.at(-1) ?? warpedRing.at(-1)!;
                const curr = warpedRing[i];
                const next = warpedRing[(i + 1) % warpedRing.length];
                const ax = curr[0] - prev[0];
                const ay = curr[1] - prev[1];
                const bx = next[0] - curr[0];
                const by = next[1] - curr[1];
                const lenA = Math.sqrt(ax * ax + ay * ay);
                const lenB = Math.sqrt(bx * bx + by * by);
                if (
                    lenA !== 0 &&
                    lenB !== 0 &&
                    (ax * bx + ay * by) / (lenA * lenB) <= cosThreshold
                ) {
                    optimizedRing.push(curr);
                }
            }
            optimizedRing.push(warpedRing.at(-1)!);

            return optimizedRing;
        }),
    );
    return result;
}

export function transformSelection(
    transform: TComposedTransformation,
    selection: MultiPolygon,
): MultiPolygon {
    const selectionBounds = getMultiPolyBounds(selection, 'index');
    if (transform.type === 'ffd') {
        return warpSelection(transform.ffd, selection, selectionBounds);
    }
    if (transform.type === 'ffd+free') {
        return warpSelection(
            transformFfd(
                transform.ffd,
                freeTransformToMatrix(
                    transform.freeTransform,
                    rectToBounds(transform.ffdBounds, 'index'),
                ),
            ),
            selection,
            selectionBounds,
        );
    }
    const transformationMatrix = freeTransformToMatrix(transform.freeTransform, selectionBounds);
    return transformMultiPolygon(selection, transformationMatrix);
}

export function transformFfd(ffd: TFfdLattice, matrix: Matrix): TFfdLattice {
    return {
        cols: ffd.cols,
        rows: ffd.rows,
        controlPoints: ffd.controlPoints.map((row) =>
            row.map((point) => applyToPoint(matrix, point)),
        ),
    };
}
