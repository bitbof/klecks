export const SMALL_PREVIEW = {
    width: 340,
    height: 220,
};

export const MEDIUM_PREVIEW = {
    width: 540,
    height: 300,
};

export function getPreviewWidth(isSmall: boolean): number {
    return isSmall ? SMALL_PREVIEW.width : MEDIUM_PREVIEW.width;
}

export function getPreviewHeight(isSmall: boolean): number {
    return isSmall ? SMALL_PREVIEW.height : MEDIUM_PREVIEW.height;
}
