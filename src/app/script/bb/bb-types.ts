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
    css?: Partial<CSSStyleDeclaration>;
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

// x1 <= x2, y1 <= y2
export type TBounds = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

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
