export function clamp(lo: number, value: number, hi: number): number {
    return Math.max(lo, Math.min(value, hi));
}
