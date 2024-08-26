export interface IVector2D {
    x: number;
    y: number;
}

export interface IPressureInput {
    x: number;
    y: number;
    pressure: number; // 0-1
}

export interface ISize2D {
    width: number;
    height: number;
}

export type TCSS = Partial<CSSStyleDeclaration>;

export interface IKeyString {
    [key: string]: string;
}

export interface IKeyStringOptional {
    [key: string]: string | undefined;
}

export interface ISVG {
    elementType: string;
    childrenArr?: ISVG[];
    viewBox?: string;
    preserveAspectRatio?: string;
    id?: string;
    class?: string;
    width?: string;
    height?: string;
    fill?: string;
    stroke?: string;
    style?: string;
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
}

export interface IBounds {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface IRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ICropRect {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export type TNullable<T> = { [K in keyof T]: T[K] | null };
