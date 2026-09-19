// Layers ordered bottom to top
export function getClippingGroups<GLayer extends { hasClipping: boolean }>(
    layers: readonly GLayer[],
): GLayer[][] {
    const groups: GLayer[][] = [];
    for (const layer of layers) {
        const lastGroup = groups.at(-1);
        if (layer.hasClipping && lastGroup && !lastGroup[0].hasClipping) {
            lastGroup.push(layer);
        } else {
            groups.push([layer]);
        }
    }
    return groups;
}
