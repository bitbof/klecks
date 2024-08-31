export const smallPreview = {
    width: 340,
    height: 220,
};

export const mediumPreview = {
    width: 540,
    height: 300,
};

export function getPreviewWidth(isSmall: boolean): number {
    return isSmall ? smallPreview.width : mediumPreview.width;
}

export function getPreviewHeight(isSmall: boolean): number {
    return isSmall ? smallPreview.height : mediumPreview.height;
}
