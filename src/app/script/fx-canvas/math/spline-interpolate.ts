import { BB } from '../../bb/bb';

export function splineInterpolate(points: [number, number][]): number[] {
    const interpolator = new BB.SplineInterpolator(points);
    const array = [];
    for (let i = 0; i < 256; i++) {
        array.push(BB.clamp(Math.floor(interpolator.interpolate(i / 255) * 256), 0, 255));
    }
    return array;
}
