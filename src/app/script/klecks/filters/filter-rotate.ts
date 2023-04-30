import {BB} from '../../bb/bb';
import {IFilterApply, IFilterGetDialogParam, IFilterGetDialogResult} from '../kl-types';
import {LANG} from '../../language/language';
import {TFilterHistoryEntry} from './filters';
import {theme} from '../../theme/theme';

export type TFilterRotateInput = {
    deg: number;
}

export type TFilterRotateHistoryEntry = TFilterHistoryEntry<
    'rotate',
    TFilterRotateInput>;

export const filterRotate = {

    getDialog (params: IFilterGetDialogParam) {
        const klCanvas = params.klCanvas;
        if (!klCanvas) {
            return false;
        }

        const fit = BB.fitInto(klCanvas.getWidth(), klCanvas.getHeight(), 280, 200, 1);
        const w = parseInt('' + fit.width), h = parseInt('' + fit.height);

        const previewFactor = w / klCanvas.getWidth();
        const tempCanvas = BB.canvas(w, h);
        tempCanvas.style.display = 'block';
        BB.ctx(tempCanvas).drawImage(klCanvas.getCompleteCanvas(previewFactor), 0, 0, w, h);


        const div = document.createElement('div');
        const result: IFilterGetDialogResult<TFilterRotateInput> = {
            element: div,
        };
        let deg = 0;
        div.innerHTML = LANG('filter-rotate-description') + '<br/><br/>';

        function update (): void {
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

        div.append(btnMinus, btnPlus);

        const previewWrapper = BB.el({
            className: 'kl-preview-wrapper',
            css: {
                width: '340px',
                height: '220px',
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
            },
        });


        function updateCheckerboard (): void {
            BB.createCheckerDataUrl(8, function (url) {
                canvasWrapper.style.background = 'url(' + url + ')';
            }, theme.isDark());
        }
        theme.addIsDarkListener(updateCheckerboard);
        updateCheckerboard();

        canvasWrapper.style.transition = 'all 0.2s ease-out';

        div.append(previewWrapper);
        update();

        result.destroy = (): void => {
            theme.removeIsDarkListener(updateCheckerboard);
        };
        result.getInput = function (): TFilterRotateInput {
            result.destroy();
            return {
                deg: deg,
            };
        };
        return result;
    },

    apply (params: IFilterApply<TFilterRotateInput>): boolean {
        const klCanvas = params.klCanvas;
        const history = params.history;
        if (!klCanvas || !history) {
            return false;
        }
        history.pause(true);
        klCanvas.rotate(params.input.deg);
        history.pause(false);
        history.push({
            tool: ['filter', 'rotate'],
            action: 'apply',
            params: [{
                input: params.input,
            }],
        } as TFilterRotateHistoryEntry);
        return true;
    },

};