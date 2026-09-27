import { LocalStorage } from '../../bb/base/local-storage';

// A tile that repeats across the canvas. data is row-major, 1 -> pixel is drawn.
export type TPixelPattern = {
    width: number;
    height: number;
    data: number[];
};

// order in which pixels of a 4x4 cell get filled (ordered dithering)
const DITHER_ORDER: readonly [number, number][] = [
    [3, 2],
    [1, 0],
    [3, 0],
    [1, 2],
    [2, 1],
    [0, 3],
    [0, 1],
    [2, 3],

    [2, 0],
    [0, 2],
    [0, 0],
    [2, 2],
    [1, 1],
    [3, 3],
    [3, 1],
    [1, 3],
];
// number of filled pixels per 4x4 cell. 16 -> solid
const DITHER_LEVELS = [16, 15, 14, 13, 12, 10, 8, 6, 4, 3, 2, 1] as const;

function createDitherPattern(filledCount: number): TPixelPattern {
    const data = new Array<number>(16).fill(0);
    DITHER_ORDER.slice(0, filledCount).forEach(([x, y]) => (data[y * 4 + x] = 1));
    return { width: 4, height: 4, data };
}

// rows of '0' and '1'
function patternFromRows(rows: string[]): TPixelPattern {
    return {
        width: rows[0].length,
        height: rows.length,
        data: rows.join('').split('').map(Number),
    };
}

// Built-in patterns. The first one is solid. Patterns are identified by their index:
// built-in first, then the custom ones.
export const DEFAULT_PIXEL_PATTERNS: readonly TPixelPattern[] = [
    ...DITHER_LEVELS.map(createDitherPattern),
    patternFromRows(['11', '00']), // horizontal lines
    patternFromRows(['10', '10']), // vertical lines
    patternFromRows(['0001', '0010', '0100', '1000']), // rising diagonals
    patternFromRows(['1000', '0100', '0010', '0001']), // falling diagonals
    patternFromRows(['1111', '1000', '1000', '1000']), // grid
    patternFromRows(['1100', '1100', '0011', '0011']), // big checker
    patternFromRows(['10000001', '01000010', '00100100', '00011000']), // zigzag
];

// Sizes the pattern editor works with.
export const EDITABLE_PIXEL_PATTERN_SIZES = [4, 8] as const;

/**
 * Returns the pattern as a 4x4 or 8x8 tile, which the pattern editor works with.
 * Smaller tiles (e.g. 2x2, 8x4) are repeated to fit, so they look the same.
 */
export function toEditablePixelPattern(pattern: TPixelPattern): TPixelPattern {
    const size = pattern.width <= 4 && pattern.height <= 4 ? 4 : 8;
    const data = Array.from({ length: size * size }, (_, i) => {
        const x = (i % size) % pattern.width;
        const y = Math.floor(i / size) % pattern.height;
        return pattern.data[y * pattern.width + x];
    });
    return { width: size, height: size, data };
}

function getIsValidPixelPattern(value: unknown): value is TPixelPattern {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const { width, height, data } = value as Partial<TPixelPattern>;
    return (
        typeof width === 'number' &&
        typeof height === 'number' &&
        EDITABLE_PIXEL_PATTERN_SIZES.includes(width as 4 | 8) &&
        width === height &&
        Array.isArray(data) &&
        data.length === width * height &&
        data.every((item) => item === 0 || item === 1)
    );
}

// ----------------------------------- custom patterns -----------------------------------

const LS_CUSTOM_PATTERNS_KEY = 'kl-pixel-brush-patterns';

/**
 * Custom patterns created by the user, persisted in local storage.
 * Invalid entries are skipped.
 */
export function loadCustomPixelPatterns(): TPixelPattern[] {
    const str = LocalStorage.getItem(LS_CUSTOM_PATTERNS_KEY);
    if (!str) {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(str);
    } catch (e) {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    return parsed.filter(getIsValidPixelPattern).map(({ width, height, data }) => ({
        width,
        height,
        data,
    }));
}

export function saveCustomPixelPatterns(patterns: TPixelPattern[]): void {
    LocalStorage.setItem(
        LS_CUSTOM_PATTERNS_KEY,
        JSON.stringify(patterns.map(({ width, height, data }) => ({ width, height, data }))),
    );
}
