import { initializeCanvas } from 'ag-psd';
import { createCanvas } from '../../bb/base/create-canvas';

// so we can debug memory usage
initializeCanvas(createCanvas);

// for an identifiable bundle
export * from 'ag-psd';
