import { byteArrayToBase64, initializeCanvas } from 'ag-psd';
import { createCanvas } from '../../bb/base/create-canvas';

// so we can debug memory usage
initializeCanvas(createCanvas, (data): HTMLCanvasElement => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${byteArrayToBase64(data)}`;
    const canvas = createCanvas(image.width, image.height);
    canvas.getContext('2d')!.drawImage(image, 0, 0);
    return canvas;
});

// for an identifiable bundle
export * from 'ag-psd';
