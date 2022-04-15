import {BB} from '../../bb/bb';
import {KL} from '../kl';
import {saveAs} from 'file-saver';
import {KlCanvas} from '../canvas/kl-canvas';

export class SaveToComputer {

    constructor(
        private saveReminder,
        private klRootEl,
        private getExportType,
        private getKlCanvas: () => KlCanvas,
        private filenameBase: string,
    ) {}

    save(format?: 'psd' | 'layers' | 'png') {
        const _this = this;

        _this.saveReminder.reset();


        function saveImage(canvas, filename, mimeType) {
            let parts = canvas.toDataURL(mimeType).match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/);
            //assume base64 encoding
            let binStr = atob(parts[3]);
            //convert to binary in ArrayBuffer
            let buf = new ArrayBuffer(binStr.length);
            let view = new Uint8Array(buf);
            for (let i = 0; i < view.length; i++) {
                view[i] = binStr.charCodeAt(i);
            }
            let blob = new Blob([view], {'type': parts[1]});
            saveAs(blob, filename);
        }

        if (!format) {
            format = _this.getExportType();
        }

        if (format === 'png') {
            let extension = 'png';
            let mimeType = 'image/png';
            let filename = BB.getDate() + this.filenameBase + "." + extension;
            let fullCanvas = _this.getKlCanvas().getCompleteCanvas(1);

            /*fullCanvas.toBlob(function(blob) {
                if (blob === null) {
                    throw 'save image error, blob is null';
                }
                saveAs(blob, filename);
            }, mimetype);*/

            //using old code, because saving somehow doesn't work for ipad before ios 13
            //and it doesn't even throw an exception
            try {
                saveImage(fullCanvas, filename, mimeType);
            } catch (error) { //fallback for old browsers
                let im = new Image();
                im.width = _this.getKlCanvas().getWidth();
                im.height = _this.getKlCanvas().getHeight();
                im.src = fullCanvas.toDataURL(mimeType);
                KL.exportDialog(_this.klRootEl, im);
            }
        } else if (format === 'layers') {
            let extension = 'png';
            let mimeType = 'image/png';
            let fileBase = BB.getDate() + this.filenameBase;
            let layerArr = _this.getKlCanvas().getLayersFast();
            for (let i = 0; i < layerArr.length; i++) {
                let item = layerArr[i];
                let fnameArr = [
                    fileBase,
                    '_',
                    ('' + (i + 1)).padStart(2, '0'),
                    '_',
                    item.name,
                    '.',
                    extension
                ];
                saveImage(item.canvas, fnameArr.join(''), mimeType);
            }
        } else if (format === 'psd') {

            let layerArr = _this.getKlCanvas().getLayersFast();

            let psdConfig = {
                width: _this.getKlCanvas().getWidth(),
                height: _this.getKlCanvas().getHeight(),
                children: [],
                canvas: _this.getKlCanvas().getCompleteCanvas(1)
            };
            for (let i = 0; i < layerArr.length; i++) {
                let item = layerArr[i];
                psdConfig.children.push({
                    name: item.name,
                    opacity: item.opacity,
                    canvas: item.canvas,
                    blendMode: KL.PSD.blendKlToPsd(item.mixModeStr),
                    left: 0,
                    top: 0
                });
            }

            KL.loadAgPsd().then((agPsdLazy) => {
                let buffer = agPsdLazy.writePsdBuffer(psdConfig);
                let blob = new Blob([buffer], { type: 'application/octet-stream' });
                saveAs(blob, BB.getDate() + this.filenameBase + '.psd');
            }).catch(() => {
                alert('Error: failed to load PSD library');
            });

        }

    }

}