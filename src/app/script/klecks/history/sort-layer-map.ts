export function sortLayerMap(a: { index: number }, b: { index: number }): 1 | -1 | 0 {
    if (a.index > b.index) {
        return 1;
    }
    if (a.index < b.index) {
        return -1;
    }
    return 0;
}
