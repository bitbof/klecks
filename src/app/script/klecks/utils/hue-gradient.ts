import { BB } from '../../bb/bb';

export function addHueStops(grad: CanvasGradient): void {
    for (let i = 0; i <= 100; i++) {
        const frac = i / 100;
        const col = BB.ColorConverter.toRGB(new BB.HSV(frac * 360, 100, 100));
        grad.addColorStop(frac, '#' + BB.ColorConverter.toHexString(col));
    }
}
