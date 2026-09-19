import { KlCanvas } from '../canvas/kl-canvas';
import { TExportType } from '../kl-types';
import { saveAs, TFileSaveResult } from '../../bb/base/save-as';
import { KL_CONFIG } from '../kl-config';
import { canvasToBlob } from '../../bb/base/canvas';
import { asyncThrow, attempt, AttemptError, getFilenameDate } from '../../bb/base/base';
import { showError } from '../ui/modals/base/show-modal';
import { klCanvasToPsdBlob } from './kl-canvas-to-psd-blob';

export class SaveToComputer {
    private showSaveDialog: boolean = true;

    private async saveImage(
        canvas: HTMLCanvasElement,
        filename: string,
        mimeType: string,
        showDialog: boolean = false,
    ): Promise<TFileSaveResult> {
        const blob = await canvasToBlob(canvas, mimeType);
        return await saveAs(blob, filename, showDialog);
    }

    // ----------------------------------- public -----------------------------------
    constructor(
        private getExportType: () => TExportType,
        private klCanvas: KlCanvas,
        private onSaved: () => void,
    ) {}

    async save(format?: 'psd' | 'layers' | 'png' | 'jpg'): Promise<TFileSaveResult> {
        if (!format) {
            format = this.getExportType();
        }

        if (format === 'png') {
            const extension = 'png';
            const mimeType = 'image/png';
            const filename = getFilenameDate() + KL_CONFIG.filenameBase + '.' + extension;
            const fullCanvas = this.klCanvas.getCanvas();
            const result = await this.saveImage(
                fullCanvas,
                filename,
                mimeType,
                this.showSaveDialog,
            );
            if (result === 'error') {
                // todo localise
                showError('failed PNG export');
            }
            result === 'saved' && this.onSaved();
            return result;
        } else if (format === 'jpg') {
            const extension = 'jpg';
            const mimeType = 'image/jpeg';
            const filename = getFilenameDate() + KL_CONFIG.filenameBase + '.' + extension;
            const fullCanvas = this.klCanvas.getCanvas();
            const result = await this.saveImage(
                fullCanvas,
                filename,
                mimeType,
                this.showSaveDialog,
            );
            if (result === 'error') {
                // todo localise
                showError('failed JPG export');
            }
            result === 'saved' && this.onSaved();
            return result;
        } else if (format === 'layers') {
            const extension = 'png';
            const mimeType = 'image/png';
            const fileBase = getFilenameDate() + KL_CONFIG.filenameBase;
            const layerArr = this.klCanvas.getLayers();
            for (let i = 0; i < layerArr.length; i++) {
                const item = layerArr[i];
                const fnameArr = [
                    fileBase,
                    '_',
                    (i + 1).toString().padStart(2, '0'),
                    '_',
                    item.name,
                    '.',
                    extension,
                ];
                await this.saveImage(item.canvas, fnameArr.join(''), mimeType);
            }
            this.onSaved();
            return 'saved';
        } else if (format === 'psd') {
            const blob = await attempt(() => klCanvasToPsdBlob(this.klCanvas, true));
            if (blob instanceof AttemptError) {
                showError('failed PSD export');
                asyncThrow(blob.error);
                return 'error';
            }
            const result = await saveAs(
                blob,
                getFilenameDate() + KL_CONFIG.filenameBase + '.psd',
                this.showSaveDialog,
            );
            if (result === 'error') {
                // todo localise
                showError('failed PSD export');
            }
            result === 'saved' && this.onSaved();
            return result;
        }
        return 'error';
    }

    setShowSaveDialog(b: boolean) {
        this.showSaveDialog = b;
    }
}
