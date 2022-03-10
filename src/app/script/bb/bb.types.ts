
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

export interface IKeyString {
    [key: string]: string;
}

export interface ISVG {
    elementType: string;
    childrenArr?: ISVG[];
    [key: string]: string | ISVG[]; // only string really
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