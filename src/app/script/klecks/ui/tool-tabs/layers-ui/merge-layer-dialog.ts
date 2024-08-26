import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { Options } from '../../components/options';
import { translateBlending } from '../../../canvas/translate-blending';
import { showModal } from '../../modals/base/showModal';
import { TMixMode } from '../../../kl-types';
import { theme } from '../../../../theme/theme';

export function mergeLayerDialog(
    parentEl: HTMLElement,
    p: {
        topCanvas: HTMLCanvasElement;
        bottomCanvas: HTMLCanvasElement;
        topOpacity: number;
        mixModeStr: TMixMode;
        callback: (mode: string) => void;
    },
): void {
    const div = BB.el();
    div.innerHTML = LANG('layers-merge-description');

    const options = new Options({
        optionArr: [
            { id: p.mixModeStr, label: translateBlending(p.mixModeStr) },
            { id: 'source-in', label: 'source-in' },
            { id: 'source-out', label: 'source-out' },
            { id: 'source-atop', label: 'source-atop' },
            { id: 'destination-in', label: 'destination-in' },
            { id: 'destination-out', label: 'destination-out' },
            { id: 'destination-atop', label: 'destination-atop' },
            { id: 'xor', label: 'xor' },
        ],
        initId: p.mixModeStr,
        onChange: () => {
            update();
        },
        isSmall: true,
    });
    options.getElement().style.marginTop = '5px';
    div.append(options.getElement());

    const thumbDimensions = BB.fitInto(p.topCanvas.width, p.topCanvas.height, 200, 200, 1);
    const preview = BB.canvas(thumbDimensions.width, thumbDimensions.height);
    preview.title = LANG('preview');
    preview.className = 'kl-merge-preview';
    const spacer = BB.el({
        content: '<br/>',
        css: {
            clear: 'both',
        },
    });
    div.append(spacer, preview);

    function updateCheckerboard(): void {
        BB.createCheckerDataUrl(
            4,
            (url) => {
                preview.style.backgroundImage = 'url(' + url + ')';
            },
            theme.isDark(),
        );
    }
    updateCheckerboard();
    theme.addIsDarkListener(updateCheckerboard);

    const alphaCanvas = BB.copyCanvas(preview);
    BB.ctx(alphaCanvas).drawImage(p.topCanvas, 0, 0, alphaCanvas.width, alphaCanvas.height);
    BB.convertToAlphaChannelCanvas(alphaCanvas);

    const update = () => {
        const ctx = BB.ctx(preview);
        ctx.save();
        ctx.clearRect(0, 0, preview.width, preview.height);
        if (preview.width > p.topCanvas.width) {
            ctx.imageSmoothingEnabled = false;
        }
        ctx.drawImage(p.bottomCanvas, 0, 0, preview.width, preview.height);

        if (options.getValue() === 'as-alpha') {
            ctx.globalCompositeOperation = 'destination-in';
            ctx.globalAlpha = p.topOpacity;
            ctx.drawImage(alphaCanvas, 0, 0, preview.width, preview.height);
        } else {
            ctx.globalCompositeOperation = options.getValue() as GlobalCompositeOperation;
            ctx.globalAlpha = p.topOpacity;
            ctx.drawImage(p.topCanvas, 0, 0, preview.width, preview.height);
        }
        ctx.restore();
    };

    update();

    const keyListener = new BB.KeyListener({
        onDown: (keyStr: string) => {
            if (keyStr === 'right') {
                options.next();
            }
            if (keyStr === 'left') {
                options.previous();
            }
        },
    });

    showModal({
        target: parentEl,
        message: `<b>${LANG('layers-merge-modal-title')}</b>`,
        div: div,
        buttons: ['Ok', 'Cancel'],
        clickOnEnter: 'Ok',
        callback: (val) => {
            keyListener.destroy();
            options.destroy();
            theme.removeIsDarkListener(updateCheckerboard);
            if (val === 'Ok') {
                p.callback(options.getValue());
            }
        },
    });
}
