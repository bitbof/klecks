export const copyImageData = (imageData: ImageData): ImageData => {
    return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
};
