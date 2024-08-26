// based on js color conversion http://www.webtoolkit.info/

export class HSV {
    h: number;
    s: number;
    v: number;
    constructor(h: number, s: number, v: number) {
        this.h = Math.max(0, Math.min(360, h));
        this.s = Math.max(0.001, Math.min(100, s)); //bug when 0
        this.v = Math.max(0, Math.min(100, v));
    }
}

export class RGB {
    r: number;
    g: number;
    b: number;
    constructor(r: number, g: number, b: number) {
        this.r = Math.max(0, Math.min(255, r));
        this.g = Math.max(0, Math.min(255, g));
        this.b = Math.max(0, Math.min(255, b));
    }
}

export class CMYK {
    c: number;
    m: number;
    y: number;
    k: number;
    constructor(c: number, m: number, y: number, k: number) {
        this.c = Math.max(0, Math.min(100, c));
        this.m = Math.max(0, Math.min(100, m));
        this.y = Math.max(0, Math.min(100, y));
        this.k = Math.max(0, Math.min(100, k));
    }
}

export const ColorConverter = {
    _RGBtoHSV: function (RGB: RGB): HSV {
        const result = new HSV(0, 0, 0);

        const r = RGB.r / 255;
        const g = RGB.g / 255;
        const b = RGB.b / 255;

        const minVal = Math.min(r, g, b);
        const maxVal = Math.max(r, g, b);
        const delta = maxVal - minVal;

        result.v = maxVal;

        if (delta == 0) {
            result.h = 0;
            result.s = 0;
        } else {
            result.s = delta / maxVal;
            const del_R = ((maxVal - r) / 6 + delta / 2) / delta;
            const del_G = ((maxVal - g) / 6 + delta / 2) / delta;
            const del_B = ((maxVal - b) / 6 + delta / 2) / delta;

            if (r == maxVal) {
                result.h = del_B - del_G;
            } else if (g == maxVal) {
                result.h = 1 / 3 + del_R - del_B;
            } else if (b == maxVal) {
                result.h = 2 / 3 + del_G - del_R;
            }

            if (result.h < 0) {
                result.h += 1;
            }
            if (result.h > 1) {
                result.h -= 1;
            }
        }

        result.h = Math.round(result.h * 360);
        result.s = Math.round(result.s * 100);
        result.v = Math.round(result.v * 100);

        return result;
    },

    _HSVtoRGB: function (HSV: HSV): RGB {
        const result = new RGB(0, 0, 0);

        let var_h, var_i, var_1, var_2, var_3, var_r, var_g, var_b;

        const h = (HSV.h / 360) % 1;
        const s = HSV.s / 100;
        const v = HSV.v / 100;

        if (s == 0) {
            result.r = v * 255;
            result.g = v * 255;
            result.b = v * 255;
        } else {
            var_h = h * 6;
            var_i = Math.floor(var_h);
            var_1 = v * (1 - s);
            var_2 = v * (1 - s * (var_h - var_i));
            var_3 = v * (1 - s * (1 - (var_h - var_i)));

            if (var_i == 0) {
                var_r = v;
                var_g = var_3;
                var_b = var_1;
            } else if (var_i == 1) {
                var_r = var_2;
                var_g = v;
                var_b = var_1;
            } else if (var_i == 2) {
                var_r = var_1;
                var_g = v;
                var_b = var_3;
            } else if (var_i == 3) {
                var_r = var_1;
                var_g = var_2;
                var_b = v;
            } else if (var_i == 4) {
                var_r = var_3;
                var_g = var_1;
                var_b = v;
            } else {
                var_r = v;
                var_g = var_1;
                var_b = var_2;
            }

            result.r = var_r * 255;
            result.g = var_g * 255;
            result.b = var_b * 255;

            result.r = Math.round(result.r);
            result.g = Math.round(result.g);
            result.b = Math.round(result.b);
        }

        return result;
    },

    _CMYKtoRGB: function (CMYK: CMYK): RGB {
        const result = new RGB(0, 0, 0);

        const c = CMYK.c / 100;
        const m = CMYK.m / 100;
        const y = CMYK.y / 100;
        const k = CMYK.k / 100;

        result.r = 1 - Math.min(1, c * (1 - k) + k);
        result.g = 1 - Math.min(1, m * (1 - k) + k);
        result.b = 1 - Math.min(1, y * (1 - k) + k);

        result.r = Math.round(result.r * 255);
        result.g = Math.round(result.g * 255);
        result.b = Math.round(result.b * 255);

        return result;
    },

    _RGBtoCMYK: function (RGB: RGB): CMYK {
        const result = new CMYK(0, 0, 0, 0);

        const r = RGB.r / 255;
        const g = RGB.g / 255;
        const b = RGB.b / 255;

        result.k = Math.min(1 - r, 1 - g, 1 - b);
        result.c = (1 - r - result.k) / (1 - result.k);
        result.m = (1 - g - result.k) / (1 - result.k);
        result.y = (1 - b - result.k) / (1 - result.k);

        result.c = Math.round(result.c * 100);
        result.m = Math.round(result.m * 100);
        result.y = Math.round(result.y * 100);
        result.k = Math.round(result.k * 100);

        return result;
    },

    toRGB: function (o: RGB | HSV | CMYK): RGB {
        if (o instanceof RGB) {
            return o;
        }
        if (o instanceof HSV) {
            return this._HSVtoRGB(o);
        }
        if (o instanceof CMYK) {
            return this._CMYKtoRGB(o);
        }
        throw new Error('unknown type');
    },

    toHSV: function (o: RGB | HSV | CMYK): HSV {
        if (o instanceof HSV) {
            return o;
        }
        if (o instanceof RGB) {
            return this._RGBtoHSV(o);
        }
        if (o instanceof CMYK) {
            return this._RGBtoHSV(this._CMYKtoRGB(o));
        }
        throw new Error('unknown type');
    },

    toCMYK: function (o: RGB | HSV | CMYK): CMYK {
        if (o instanceof CMYK) {
            return o;
        }
        if (o instanceof RGB) {
            return this._RGBtoCMYK(o);
        }
        if (o instanceof HSV) {
            return this._RGBtoCMYK(this._HSVtoRGB(o));
        }
        throw new Error('unknown type');
    },
    toHexString: function (o: RGB): string {
        if (o instanceof RGB || ('r' in o && 'g' in o && 'b' in o)) {
            let ha = parseInt('' + o.r).toString(16);
            let hb = parseInt('' + o.g).toString(16);
            let hc = parseInt('' + o.b).toString(16);
            if (ha.length == 1) {
                ha = '0' + ha;
            }
            if (hb.length == 1) {
                hb = '0' + hb;
            }
            if (hc.length == 1) {
                hc = '0' + hc;
            }
            return ha + hb + hc;
        }
        return '#000';
    },
    toRgbStr: function (rgbObj: { r: number; g: number; b: number }): string {
        return (
            'rgb(' +
            Math.round(rgbObj.r) +
            ', ' +
            Math.round(rgbObj.g) +
            ', ' +
            Math.round(rgbObj.b) +
            ')'
        );
    },
    toRgbaStr: function (rgbaObj: { r: number; g: number; b: number; a: number }): string {
        return (
            'rgba(' +
            Math.round(rgbaObj.r) +
            ', ' +
            Math.round(rgbaObj.g) +
            ', ' +
            Math.round(rgbaObj.b) +
            ', ' +
            rgbaObj.a +
            ')'
        );
    },
    hexToRGB: function (hexStr: string): RGB | undefined {
        hexStr = hexStr.trim();
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hexStr = hexStr.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);
        return result
            ? new RGB(parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16))
            : undefined;
    },
};

export function testIsWhiteBestContrast(rgbObj: { r: number; g: number; b: number }): boolean {
    return rgbObj.r * 0.299 + rgbObj.g * 0.587 + rgbObj.b * 0.114 < 125;
}
