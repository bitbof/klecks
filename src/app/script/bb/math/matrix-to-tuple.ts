import { Matrix } from 'transformation-matrix';

export type TMatrixTuple = [number, number, number, number, number, number];

export function matrixToTuple(m: Matrix): TMatrixTuple {
    return [m.a, m.b, m.c, m.d, m.e, m.f];
}
