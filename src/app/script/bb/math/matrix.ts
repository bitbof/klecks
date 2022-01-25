export const Matrix = (function () {

    // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Matrix_math_for_the_web
    // yes not optimized - but it's not used for physics simulations.

    // const perfTotal = 0;

    // point • matrix
    function multiplyMatrixAndPoint(matrix, point) {
        const result = [
            (point[0] * matrix[0]) + (point[1] * matrix[4]) + (point[2] * matrix[8]) + (point[3] * matrix[12]), // x
            (point[0] * matrix[1]) + (point[1] * matrix[5]) + (point[2] * matrix[9]) + (point[3] * matrix[13]), // y
            (point[0] * matrix[2]) + (point[1] * matrix[6]) + (point[2] * matrix[10]) + (point[3] * matrix[14]), // z
            (point[0] * matrix[3]) + (point[1] * matrix[7]) + (point[2] * matrix[11]) + (point[3] * matrix[15]) // w
        ];
        return result;
    }

    //matrixB • matrixA
    function multiplyMatrices(matrixA, matrixB) {

        // Slice the second matrix up into rows
        const row0 = [matrixB[0], matrixB[1], matrixB[2], matrixB[3]];
        const row1 = [matrixB[4], matrixB[5], matrixB[6], matrixB[7]];
        const row2 = [matrixB[8], matrixB[9], matrixB[10], matrixB[11]];
        const row3 = [matrixB[12], matrixB[13], matrixB[14], matrixB[15]];

        // Multiply each row by matrixA
        const result0 = multiplyMatrixAndPoint(matrixA, row0);
        const result1 = multiplyMatrixAndPoint(matrixA, row1);
        const result2 = multiplyMatrixAndPoint(matrixA, row2);
        const result3 = multiplyMatrixAndPoint(matrixA, row3);

        // Turn the result rows back into a single matrix
        return [
            result0[0], result0[1], result0[2], result0[3],
            result1[0], result1[1], result1[2], result1[3],
            result2[0], result2[1], result2[2], result2[3],
            result3[0], result3[1], result3[2], result3[3]
        ];
    }

    function createTranslationMatrix(x, y) {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, 0, 1
        ];
    }

    function createRotationMatrix(angleRad) {
        //let angleRad = angleDeg / 360 * 2 * Math.PI;
        return [
            Math.cos(-angleRad), -Math.sin(-angleRad), 0, 0,
            Math.sin(-angleRad), Math.cos(-angleRad), 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }

    function createScaleMatrix(f) {
        return [
            f, 0, 0, 0,
            0, f, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }

    return {
        getIdentity: function () {
            return [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ];
        },
        multiplyMatrixAndPoint: multiplyMatrixAndPoint,
        multiplyMatrices: multiplyMatrices,
        createTranslationMatrix: createTranslationMatrix,
        createRotationMatrix: createRotationMatrix,
        createScaleMatrix: createScaleMatrix
    };
})();