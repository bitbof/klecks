export function zoomByStep(oldScale: number, stepNum: number): number {
    const step = Math.log2(oldScale);

    let newStep = step / Math.abs(stepNum);
    newStep += stepNum > 0 ? 1 : -1;
    newStep = Math.round(newStep);
    newStep *= Math.abs(stepNum);

    return Math.pow(2, newStep);
}
