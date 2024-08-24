import { BB } from '../../bb/bb';
import { KlCanvas } from '../canvas/kl-canvas';
import { klConfig } from '../kl-config';

export class UploadImage {
    private timeout: number | any
    private latestGeneration: Blob;
    private getImage(canvas: HTMLCanvasElement, filename: string, mimeType: string): Blob {
        const parts = canvas.toDataURL(mimeType).match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/);

        if (!parts) {
            throw new Error('saveImage: empty parts');
        }

        //assume base64 encoding
        const binStr = atob(parts[3]);
        //convert to binary in ArrayBuffer
        const buf = new ArrayBuffer(binStr.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < view.length; i++) {
            view[i] = binStr.charCodeAt(i);
        }
        return new Blob([view], { 'type': parts[1] });
    }

    constructor(
        private getKlCanvas: () => KlCanvas
    ) {
        this.latestGeneration = new Blob();
     }

    Send(): void {
        if(this.timeout){
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(this.sendImpl, 100, this);
        
    }

    private async sendImpl(sender : UploadImage){
        const extension = 'png';
        const mimeType = 'image/png';
        const filename = BB.getDate() + klConfig.filenameBase + '.' + extension;
        const fullCanvas = sender.getKlCanvas().getCompleteCanvas(1);
        try {

            const image = sender.getImage(fullCanvas, filename, mimeType);
            await sender.sendData(image);
        } catch (error) { //fallback for old browsers
            alert('could not save');
            throw new Error('failed png export');
        }
    }

    async sendData(data: Blob) {

        const formData = new FormData();
        formData.append('file', data);
        formData.append('negativePrompt', 'ugly');
        formData.append('positivePrompt', 'picasso style, painting, vibrant strokes');

        var response = await fetch('https://localhost:7243/api', {
            method: 'POST',
            body: formData,
        });

        this.latestGeneration = await response.blob()
    }

    public getLatestGeneration(){
        return this.latestGeneration;
    }

}