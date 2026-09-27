import type * as CSS from 'csstype';

export type TCss = CSS.Properties<number>;

export type TVector2D = {
    x: number;
    y: number;
};

export type TPressureInput = {
    x: number;
    y: number;
    pressure: number; // 0-1
};

export type TSize2D = {
    width: number;
    height: number;
};

export type TKeyString = {
    [key: string]: string;
};

export type TSvg = {
    elementType: string;
    childrenArr?: TSvg[];
    viewBox?: string;
    preserveAspectRatio?: string;
    id?: string;
    class?: string;
    width?: string;
    height?: string;
    fill?: string;
    stroke?: string;
    css?: TCss;
    d?: string;
    x?: string;
    y?: string;
    cx?: string;
    cy?: string;
    r?: string;
    rx?: string;
    x0?: string;
    y0?: string;
    x1?: string;
    y1?: string;
    x2?: string;
    y2?: string;
    offset?: string;
    'stop-color'?: string;
    'stroke-width'?: string;
    transform?: string;
    in?: string;
    in2?: string;
    operator?: string;
    stdDeviation?: string;
    result?: string;
    dx?: string;
    dy?: string;
    k2?: string;
    k3?: string;
    'flood-color'?: string;
    'flood-opacity'?: string;
    'vector-effect'?: string;
    points?: string;
    'transform-origin'?: string;
    opacity?: string;
    // add more when needed
};

/**
 * Describes the outer bounds of a rectangle in coordinate space (think vector graphics)
 * x1 <= x2, y1 <= y2
 */
export type TCoordinateBounds = {
    type: 'coordinate';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

/**
 * Describes a rectangle for pixel arrays - from which index (1), until including which pixel (2).
 * x1 <= x2, y1 <= y2
 *
 * example - these are equivalent:
 * - { type: 'index', x1: 0, y1: 0, x2: 4, y2: 10 }
 * - { type: 'coordinate', x: 0, y: 0, width: 5, height: 11 }
 * - { x1: 0, y1: 0, x2: 5, y2: 11 }
 */
export type TIndexBounds = {
    type: 'index';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

export type TBoundsType = 'coordinate' | 'index';

export type TRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type TCropRect = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
