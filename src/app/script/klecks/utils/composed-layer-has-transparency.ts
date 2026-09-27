import { isLayerFill, TRgba } from '../kl-types';
import { THistoryEntryLayerComposed } from '../history/history.types';

function parseCssColor(colorString: string): TRgba | undefined {
    if (colorString === 'transparent') {
        return {
            r: 0,
            g: 0,
            b: 0,
            a: 0,
        };
    }
    if (colorString.startsWith('#')) {
        let hex = colorString.slice(1);
        if (hex.length === 3) {
            hex = hex
                .split('')
                .map((c) => c + c)
                .join('');
        }
        if (hex.length === 6) {
            // assume full alpha
            hex += 'ff';
        }
        const intVal = parseInt(hex, 16);
        return {
            r: (intVal >> 24) & 255,
            g: (intVal >> 16) & 255,
            b: (intVal >> 8) & 255,
            a: (intVal & 255) / 255,
        };
    }

    const rgbMatch = colorString.match(/rgba?\(([^)]+)\)/);
    if (rgbMatch) {
        const [r, g, b, a = 1] = rgbMatch[1].split(',').map((v) => parseFloat(v.trim()));
        return { r, g, b, a };
    }

    return undefined;
}

export function composedLayerHasTransparency(layer: THistoryEntryLayerComposed): boolean {
    for (const tile of layer.tiles) {
        if (isLayerFill(tile)) {
            const color = parseCssColor(tile.fill);
            if (color && color.a < 1) {
                return true;
            }
        } else {
            const data = tile.data.data;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] < 255) {
                    return true;
                }
            }
        }
    }
    return false;
}

