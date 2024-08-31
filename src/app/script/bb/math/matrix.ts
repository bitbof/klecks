// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Matrix_math_for_the_web
// not optimized

type TMatrix4x4 = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
];

export type TVec4 = [number, number, number, number];

function getIdentity(): TMatrix4x4 {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// point • matrix
function multiplyMatrixAndPoint(matrix: TMatrix4x4, point: TVec4): TVec4 {
    return [
        point[0] * matrix[0] + point[1] * matrix[4] + point[2] * matrix[8] + point[3] * matrix[12], // x
        point[0] * matrix[1] + point[1] * matrix[5] + point[2] * matrix[9] + point[3] * matrix[13], // y
        point[0] * matrix[2] + point[1] * matrix[6] + point[2] * matrix[10] + point[3] * matrix[14], // z
        point[0] * matrix[3] + point[1] * matrix[7] + point[2] * matrix[11] + point[3] * matrix[15], // w
    ];
}

//matrixB • matrixA
function multiplyMatrices(matrixA: TMatrix4x4, matrixB: TMatrix4x4): TMatrix4x4 {
    // Slice the second matrix up into rows
    const row0: TVec4 = [matrixB[0], matrixB[1], matrixB[2], matrixB[3]];
    const row1: TVec4 = [matrixB[4], matrixB[5], matrixB[6], matrixB[7]];
    const row2: TVec4 = [matrixB[8], matrixB[9], matrixB[10], matrixB[11]];
    const row3: TVec4 = [matrixB[12], matrixB[13], matrixB[14], matrixB[15]];

    // Multiply each row by matrixA
    const result0 = multiplyMatrixAndPoint(matrixA, row0);
    const result1 = multiplyMatrixAndPoint(matrixA, row1);
    const result2 = multiplyMatrixAndPoint(matrixA, row2);
    const result3 = multiplyMatrixAndPoint(matrixA, row3);

    // Turn the result rows back into a single matrix
    return [
        result0[0],
        result0[1],
        result0[2],
        result0[3],
        result1[0],
        result1[1],
        result1[2],
        result1[3],
        result2[0],
        result2[1],
        result2[2],
        result2[3],
        result3[0],
        result3[1],
        result3[2],
        result3[3],
    ];
}

function createTranslationMatrix(x: number, y: number): TMatrix4x4 {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
}

function createRotationMatrix(angleRad: number): TMatrix4x4 {
    //let angleRad = angleDeg / 360 * 2 * Math.PI;
    return [
        Math.cos(-angleRad),
        -Math.sin(-angleRad),
        0,
        0,
        Math.sin(-angleRad),
        Math.cos(-angleRad),
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
    ];
}

function createScaleMatrix(f: number): TMatrix4x4 {
    return [f, 0, 0, 0, 0, f, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export const Matrix = Object.freeze({
    getIdentity,
    multiplyMatrixAndPoint,
    multiplyMatrices,
    createTranslationMatrix,
    createRotationMatrix,
    createScaleMatrix,
});
