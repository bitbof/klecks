import { TVector2D } from '../../bb/bb-types';
import { TSelectionSample } from './selection-sample';
import { BB } from '../../bb/bb';

/*
Canvas space (pixel space):
- origin: top-left
- range: [0, width] × [0, height]

Vertex space (NDC - Normalized Device Coordinates):
- origin: center
- range: [-1, 1] × [1, -1]
- (-1, 1) equals top-left in canvas space
- (1, -1) equals bottom-right in canvas space

UV space (texture coordinates):
- origin: top-left
- range: [0, 1] × [0, 1]

FFD parametric space:
- origin: top-left
- range: [0, 1] × [0, 1]
- Coordinates within the warped image rect. Similar to texture.
*/

export type TParametric2D = {
    s: number;
    t: number;
};

export type TFfdLattice = {
    cols: number;
    rows: number;
    // [row - top-to-bottom][column - left-to-right]
    // in canvas space
    controlPoints: TVector2D[][];
};

export type TFfdMesh = {
    resolutionX: number;
    resolutionY: number;

    // [x, y, x, y, ...]
    // in vertex space or canvas space
    vertices: number[];
    // [u, v, u, v, ...]
    texCoords: number[];

    // vertex indices describing triangle faces
    // 0 -> first vertex
    // n -> (n + 1)th vertex
    frontIndices: number[];
    backIndices: number[];
};

// ---- Helper Functions ----

// Precomputed factorials for n = 0..8 (sufficient for lattice degrees up to 8×8).
// Gave slight performance improvement.
const factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

export function bernstein(n: number, k: number, t: number): number {
    const coeff = factorials[n] / (factorials[k] * factorials[n - k]);
    return coeff * (1 - t) ** (n - k) * t ** k;
}

// initial ffd lattice spanning area of rect
export function createFfdLattice(
    cols: number,
    rows: number,
    rect: { x: number; y: number; width: number; height: number },
): TFfdLattice {
    const controlPoints: TVector2D[][] = [];

    for (let i = 0; i < rows; i++) {
        controlPoints[i] = [];
        for (let j = 0; j < cols; j++) {
            controlPoints[i][j] = {
                x: rect.x + (j / (cols - 1)) * rect.width,
                y: rect.y + (i / (rows - 1)) * rect.height,
            };
        }
    }

    return {
        cols,
        rows,
        controlPoints,
    };
}

/**
 * Evaluate FFD at parametric coordinate (s, t)
 * Returns position in canvas space
 *
 * Not great for larger lattices (more cols and rows), but it's fine for 5x5
 */
export function evalFFD(s: number, t: number, lattice: TFfdLattice): TVector2D {
    const n = lattice.cols - 1;
    const m = lattice.rows - 1;
    let x = 0;
    let y = 0;

    for (let i = 0; i <= m; i++) {
        for (let j = 0; j <= n; j++) {
            const weight = bernstein(n, j, s) * bernstein(m, i, t);
            x += lattice.controlPoints[i][j].x * weight;
            y += lattice.controlPoints[i][j].y * weight;
        }
    }

    return { x, y };
}

export function createFfdMeshForSelectionSample(
    resolutionX: number,
    resolutionY: number,
    ffd: TFfdLattice,
    selectionSample: TSelectionSample,
    outputWidth: number,
    outputHeight: number,
    useCanvasSpace?: boolean,
): TFfdMesh {
    /**
     * Compute the parametric s/t ranges so that mesh only covers the texture's
     * portion of the lattice — UVs stay in [0, 1] and nothing outside the texture is drawn.
     */
    const textureWidth = selectionSample.image.width;
    const textureHeight = selectionSample.image.height;
    const offset = selectionSample.imageOffset;
    const selWidth = selectionSample.selectionSize.width;
    const selHeight = selectionSample.selectionSize.height;
    const sRange = [offset.x / selWidth, (offset.x + textureWidth) / selWidth] as [number, number];
    const tRange = [offset.y / selHeight, (offset.y + textureHeight) / selHeight] as [
        number,
        number,
    ];

    return createFfdMesh(
        resolutionX,
        resolutionY,
        ffd,
        outputWidth,
        outputHeight,
        useCanvasSpace,
        sRange,
        tRange,
    );
}

export function createFfdMesh(
    resolutionX: number,
    resolutionY: number,
    lattice: TFfdLattice,
    // ignored if useCanvasSpace true
    canvasWidth: number,
    canvasHeight: number,
    // if false will use vertex space
    useCanvasSpace?: boolean,

    /**
     * Parametric horizontal range to generate mesh for. Default: [0, 1].
     * Clips the mesh to the portion of the lattice covered by the texture,
     * so UVs stay in [0, 1] and we avoid texture wrapping issues.
     */
    sRange?: [number, number],
    /**
     * Parametric vertical range to generate mesh for. Default: [0, 1].
     * Clips the mesh to the portion of the lattice covered by the texture,
     * so UVs stay in [0, 1] and we avoid texture wrapping issues.
     */
    tRange?: [number, number],
): TFfdMesh {
    const vertices: number[] = [];
    const texCoords: number[] = [];
    const frontIndices: number[] = [];
    const backIndices: number[] = [];

    const sMin = sRange ? sRange[0] : 0;
    const sMax = sRange ? sRange[1] : 1;
    const tMin = tRange ? tRange[0] : 0;
    const tMax = tRange ? tRange[1] : 1;

    // Generate mesh vertices
    for (let i = 0; i <= resolutionY; i++) {
        for (let j = 0; j <= resolutionX; j++) {
            // Parametric coords within the texture's sub-range of the lattice
            const s = sMin + (j / resolutionX) * (sMax - sMin);
            const t = tMin + (i / resolutionY) * (tMax - tMin);

            // Evaluate FFD to get canvas space position
            const canvasPos = evalFFD(s, t, lattice);

            let x: number, y: number;
            if (useCanvasSpace) {
                // Keep in canvas space for hit testing
                x = canvasPos.x;
                y = canvasPos.y;
            } else {
                // Convert to normalized vertex space [-1, 1]
                // Top-left is (-1, 1), bottom-right is (1, -1)
                x = (canvasPos.x / canvasWidth) * 2.0 - 1.0;
                y = 1.0 - (canvasPos.y / canvasHeight) * 2.0;
            }
            vertices.push(x, y);

            // UV maps linearly from the sub-range to [0, 1]
            const u = (s - sMin) / (sMax - sMin);
            const v = (t - tMin) / (tMax - tMin);
            texCoords.push(u, v);
        }
    }

    // Generate indices, classifying each triangle as front- or back-facing inline
    for (let i = 0; i < resolutionY; i++) {
        for (let j = 0; j < resolutionX; j++) {
            const topLeft = i * (resolutionX + 1) + j;
            const topRight = topLeft + 1;
            const bottomLeft = topLeft + (resolutionX + 1);
            const bottomRight = bottomLeft + 1;

            const x0 = vertices[topLeft * 2],
                y0 = vertices[topLeft * 2 + 1];
            const x1 = vertices[bottomLeft * 2],
                y1 = vertices[bottomLeft * 2 + 1];
            const x2 = vertices[topRight * 2],
                y2 = vertices[topRight * 2 + 1];
            const x3 = vertices[bottomRight * 2],
                y3 = vertices[bottomRight * 2 + 1];

            const cross0 = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
            (cross0 > 0 ? frontIndices : backIndices).push(topLeft, bottomLeft, topRight);

            const cross1 = (x1 - x2) * (y3 - y2) - (y1 - y2) * (x3 - x2);
            (cross1 > 0 ? frontIndices : backIndices).push(topRight, bottomLeft, bottomRight);
        }
    }

    return {
        resolutionX,
        resolutionY,
        vertices,
        texCoords,
        frontIndices,
        backIndices,
    };
}

export function findParametricCoordinate(
    // same space as mesh vertices
    x: number,
    y: number,
    mesh: TFfdMesh,
): TParametric2D | undefined {
    const { vertices, texCoords, frontIndices, backIndices } = mesh;
    let frontHit: TParametric2D | undefined = undefined;
    let backHit: TParametric2D | undefined = undefined;

    function checkTriangles(indices: number[]): void {
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i];
            const i1 = indices[i + 1];
            const i2 = indices[i + 2];

            const x0 = vertices[i0 * 2];
            const y0 = vertices[i0 * 2 + 1];
            const x1 = vertices[i1 * 2];
            const y1 = vertices[i1 * 2 + 1];
            const x2 = vertices[i2 * 2];
            const y2 = vertices[i2 * 2 + 1];

            // Barycentric coordinates
            const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
            if (Math.abs(denom) < 0.00001) {
                // skip degenerate triangles (nearly collinear)
                continue;
            }
            const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denom;
            const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denom;
            const c = 1 - a - b;

            // Inside triangle?
            if (a >= 0 && b >= 0 && c >= 0) {
                // Get texture coordinates (which are the same as parametric coords)
                const s0 = texCoords[i0 * 2];
                const t0 = texCoords[i0 * 2 + 1];
                const s1 = texCoords[i1 * 2];
                const t1 = texCoords[i1 * 2 + 1];
                const s2 = texCoords[i2 * 2];
                const t2 = texCoords[i2 * 2 + 1];
                // Check winding order
                const cross = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
                const isBackFacing = cross > 0;

                const hit = { s: a * s0 + b * s1 + c * s2, t: a * t0 + b * t1 + c * t2 };
                if (isBackFacing) {
                    backHit = hit;
                } else {
                    frontHit = hit;
                }
            }
        }
    }

    checkTriangles(frontIndices);
    checkTriangles(backIndices);

    // Prioritize back, because back faces are also rendered in front.
    return backHit || frontHit;
}

/**
 * Warps the lattice, by dragging paramCoordinate exactly to the `target` coordinate,
 * and has a fairly nice falloff. Downside: the lattice mesh folds over perhaps too easily
 * if paramCoordinate is near an edge or corner.
 */
export function warpLatticeViaPoint(
    paramCoordinate: TParametric2D,
    target: TVector2D,
    lattice: TFfdLattice,
): TFfdLattice {
    lattice = BB.copyObj(lattice);
    // via trial and error these felt good
    // so the entire mesh doesn't move when warping. Somewhat localized.
    const influenceRadius = 1 / 3;
    // smaller -> edge folds less easily over
    const edgeFalloff = 0.5;

    const n = lattice.cols - 1;
    const m = lattice.rows - 1;

    const controlPoints: TVector2D[][] = lattice.controlPoints;

    // Calculate basis function values at the drag point
    const basisWeights: Array<{
        i: number;
        j: number;
        w: number;
        strength: number;
    }> = [];

    for (let i = 0; i <= m; i++) {
        for (let j = 0; j <= n; j++) {
            const w = bernstein(n, j, paramCoordinate.s) * bernstein(m, i, paramCoordinate.t);

            // Calculate distance for influence radius
            const si = j / n;
            const ti = i / m;
            const paramDist = Math.sqrt(
                (si - paramCoordinate.s) ** 2 + (ti - paramCoordinate.t) ** 2,
            );

            // Calculate a ramp from 1 to 0
            let strength = Math.max(0, 1 - paramDist / influenceRadius);

            const dragDistFromCenterX = Math.abs(paramCoordinate.s - 0.5);
            const cpDistFromCenterX = Math.abs(si - 0.5);
            const dragDistFromCenterY = Math.abs(paramCoordinate.t - 0.5);
            const cpDistFromCenterY = Math.abs(ti - 0.5);
            // weirdly feels right when warping
            if (
                cpDistFromCenterX > dragDistFromCenterX ||
                cpDistFromCenterY > dragDistFromCenterY
            ) {
                strength *= edgeFalloff;
            }

            basisWeights.push({ i, j, w, strength });
        }
    }

    const start = evalFFD(paramCoordinate.s, paramCoordinate.t, lattice);
    const dx = target.x - start.x;
    const dy = target.y - start.y;

    // Direct manipulation: solve for control point displacements.
    // Invariant: evalFFD(paramCoordinate, updatedLattice) === target exactly.
    let sumWeightsSq = 0;
    for (const { w, strength } of basisWeights) {
        sumWeightsSq += w * w * strength;
    }

    for (const { i, j, w, strength } of basisWeights) {
        const scale = (w / sumWeightsSq) * strength;
        controlPoints[i][j].x += dx * scale;
        controlPoints[i][j].y += dy * scale;
    }

    return {
        cols: lattice.cols,
        rows: lattice.rows,
        controlPoints: controlPoints,
    };
}
