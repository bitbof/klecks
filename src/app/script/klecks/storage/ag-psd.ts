import { initializeCanvas } from 'ag-psd';
import { createCanvas } from '../../bb/base/create-canvas';

// so we can debug memory usage
// (Since ag-psd 34, the second argument creates ImageData. ag-psd decodes JPEG thumbnails itself.)
initializeCanvas(createCanvas);

// for an identifiable bundle
export * from 'ag-psd';
