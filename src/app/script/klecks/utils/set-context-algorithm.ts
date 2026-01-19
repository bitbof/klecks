import { TInterpolationAlgorithm } from '../kl-types';

export function setContextAlgorithm(
    ctx: CanvasRenderingContext2D,
    algorithm: TInterpolationAlgorithm,
): void {
    ctx.imageSmoothingEnabled = algorithm === 'smooth';
    if (algorithm === 'smooth') {
        ctx.imageSmoothingQuality = 'high';
    }
}
