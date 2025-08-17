import { BB } from '../../bb/bb';
import { TFilterApply, TFilterGetDialogParam, TFilterGetDialogResult } from '../kl-types';
import { SMALL_PREVIEW } from '../ui/utils/preview-size';

export type TFilterRotateInput = {
    deg: number;
};

export const filterRotate = {
    getDialog(params: TFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        if (!klCanvas) {
            return false;
        }

        const fit = BB.fitInto(klCanvas.getWidth(), klCanvas.getHeight(), 280, 200, 1);
        const w = parseInt('' + fit.width),
            h = parseInt('' + fit.height);

        const previewFactor = w / klCanvas.getWidth();
        const tempCanvas = BB.canvas(w, h);
        tempCanvas.style.display = 'block';
        BB.ctx(tempCanvas).drawImage(klCanvas.getCompleteCanvas(previewFactor), 0, 0, w, h);

        const rootEl = BB.el();
        const result: TFilterGetDialogResult<TFilterRotateInput> = {
            element: rootEl,
        };
        let deg = 0;

        function update(): void {
            canvasWrapper.style.transform = 'rotate(' + deg + 'deg)';
            if (Math.abs(deg % 180) === 90) {
                //height has to fit width because of rotation
                const fit = BB.fitInto(h, w, 280, 200, 1);
                const scale = parseInt('' + fit.height) / w;
                canvasWrapper.style.transform = 'rotate(' + deg + 'deg) scale(' + scale + ')';
            }
        }

        const btnPlus = document.createElement('button');
        btnPlus.innerHTML = "<span style='font-size: 1.3em'>⟳</span> 90°";
        const btnMinus = document.createElement('button');
        btnMinus.innerHTML = "<span style='font-size: 1.3em'>⟲</span> 90°";
        btnMinus.style.marginRight = '5px';

        btnPlus.onclick = function () {
            deg += 90;
            update();
        };
        btnMinus.onclick = function () {
            deg -= 90;
            update();
        };

        rootEl.append(btnMinus, btnPlus);

        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: SMALL_PREVIEW.width + 'px',
                height: SMALL_PREVIEW.height + 'px',
                display: 'table',
            },
        });

        const previewcell = BB.el({
            parent: previewWrapper,
            css: {
                display: 'table-cell',
                verticalAlign: 'middle',
            },
        });
        const canvasWrapper = BB.el({
            parent: previewcell,
            content: tempCanvas,
            className: 'kl-preview-wrapper__canvas',
            css: {
                width: w + 'px',
                height: h + 'px',
                marginLeft: 'auto',
                marginRight: 'auto',
                overflow: 'hidden',
                background: 'var(--kl-checkerboard-background)',
                backgroundSize: '16px',
            },
        });

        canvasWrapper.style.transition = 'transform 0.2s ease-out';

        rootEl.append(previewWrapper);
        update();

        result.destroy = (): void => {};
        result.getInput = function (): TFilterRotateInput {
            result.destroy!();
            return {
                deg: deg,
            };
        };
        return result;
    },

    apply(params: TFilterApply<TFilterRotateInput>): boolean {
        const klCanvas = params.klCanvas;
        if (!klCanvas) {
            return false;
        }
        klCanvas.rotate(params.input.deg);
        return true;
    },
};
