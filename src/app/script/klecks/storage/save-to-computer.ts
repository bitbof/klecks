import { BB } from '../../bb/bb';
import { KL } from '../kl';
import { KlCanvas } from '../canvas/kl-canvas';
import { TExportType } from '../kl-types';
import { saveAs } from '../../bb/base/save-as';
import { Psd } from 'ag-psd/dist/psd';
import { KL_CONFIG } from '../kl-config';
import { canvasToBlob } from '../../bb/base/canvas';

export class SaveToComputer {
    private showSaveDialog: boolean = true;

    private async saveImage(
        canvas: HTMLCanvasElement,
        filename: string,
        mimeType: string,
        showDialog: boolean = false,
    ): Promise<void> {
        const blob = await canvasToBlob(canvas, mimeType);
        await saveAs(blob, filename, showDialog);
    }

    // ----------------------------------- public -----------------------------------
    constructor(
        private getExportType: () => TExportType,
        private klCanvas: KlCanvas,
        private onSaved: () => void,
    ) {}

    async save(format?: 'psd' | 'layers' | 'png'): Promise<void> {
        if (!format) {
            format = this.getExportType();
        }

        if (format === 'png') {
            const extension = 'png';
            const mimeType = 'image/png';
            const filename = BB.getDate() + KL_CONFIG.filenameBase + '.' + extension;
            const fullCanvas = this.klCanvas.getCompleteCanvas(1);
            try {
                await this.saveImage(fullCanvas, filename, mimeType, this.showSaveDialog);
            } catch (error) {
                //fallback for old browsers
                alert('could not save');
                throw new Error('failed png export');
            }
        } else if (format === 'layers') {
            const extension = 'png';
            const mimeType = 'image/png';
            const fileBase = BB.getDate() + KL_CONFIG.filenameBase;
            const layerArr = this.klCanvas.getLayersFast();
            for (let i = 0; i < layerArr.length; i++) {
                const item = layerArr[i];
                const fnameArr = [
                    fileBase,
                    '_',
                    ('' + (i + 1)).padStart(2, '0'),
                    '_',
                    item.name,
                    '.',
                    extension,
                ];
                await this.saveImage(item.canvas, fnameArr.join(''), mimeType);
            }
        } else if (format === 'psd') {
            const layerArr = this.klCanvas.getLayersFast();

            const psdConfig: Psd = {
                width: this.klCanvas.getWidth(),
                height: this.klCanvas.getHeight(),
                children: [],
                canvas: this.klCanvas.getCompleteCanvas(1),
            };
            for (let i = 0; i < layerArr.length; i++) {
                const item = layerArr[i];
                psdConfig.children!.push({
                    name: item.name,
                    hidden: !item.isVisible,
                    opacity: item.opacity,
                    canvas: item.canvas,
                    blendMode: KL.PSD.blendKlToPsd(item.mixModeStr),
                    left: 0,
                    top: 0,
                });
            }

            KL.loadAgPsd()
                .then((agPsdLazy) => {
                    const buffer = agPsdLazy.writePsdBuffer(psdConfig);
                    const blob = new Blob([buffer], {
                        type: 'image/vnd.adobe.photoshop',
                    });
                    saveAs(
                        blob,
                        BB.getDate() + KL_CONFIG.filenameBase + '.psd',
                        this.showSaveDialog,
                    );
                })
                .catch(() => {
                    alert('Error: failed to load PSD library');
                });
        }
        this.onSaved();
    }

    setShowSaveDialog(b: boolean) {
        this.showSaveDialog = b;
    }
}
