import { KlCanvas } from '../canvas/kl-canvas';
import { TExportType } from '../kl-types';
import { saveAs, TFileSaveResult } from '../../bb/base/save-as';
import { KL_CONFIG } from '../kl-config';
import { canvasToBlob } from '../../bb/base/canvas';
import { getFilenameDate } from '../../bb/base/base';
import { showError } from '../ui/modals/base/show-modal';
import { klCanvasToPsdBlob } from './kl-canvas-to-psd-blob';

export class SaveToComputer {
    private showsSaveDialog: boolean = true;

    // ----------------------------------- public -----------------------------------
    constructor(
        private getExportType: () => TExportType,
        private klCanvas: KlCanvas,
        private onSaved: () => void,
    ) {}

    async save(format: TExportType = this.getExportType()): Promise<TFileSaveResult> {
        const fileBase = getFilenameDate() + KL_CONFIG.filenameBase;

        if (format === 'layers') {
            const layers = this.klCanvas.getLayers();
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const result = await saveAs(
                    `${fileBase}_${(i + 1).toString().padStart(2, '0')}_${layer.name}.png`,
                    'image/png',
                    () => canvasToBlob(layer.canvas, 'image/png'),
                );
                if (result !== 'saved') {
                    if (result === 'error') {
                        // todo localise
                        showError('failed PNG export');
                    }
                    return result;
                }
            }
            this.onSaved();
            return 'saved';
        }

        let result: TFileSaveResult;
        if (format === 'psd') {
            result = await saveAs(
                `${fileBase}.psd`,
                'image/vnd.adobe.photoshop',
                () => klCanvasToPsdBlob(this.klCanvas),
                this.showsSaveDialog,
            );
        } else {
            const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
            result = await saveAs(
                `${fileBase}.${format}`,
                mimeType,
                () => canvasToBlob(this.klCanvas.getCanvas(), mimeType),
                this.showsSaveDialog,
            );
        }

        if (result === 'error') {
            // todo localise
            showError(`failed ${format.toUpperCase()} export`);
        }
        if (result === 'saved') {
            this.onSaved();
        }
        return result;
    }

    setShowsSaveDialog(b: boolean): void {
        this.showsSaveDialog = b;
    }
}
