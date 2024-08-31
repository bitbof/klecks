import { BB } from '../../../bb/bb';
import { Select } from '../components/select';
import { ColorOptions } from '../components/color-options';
import { showModal } from './base/showModal';
import { LANG } from '../../../language/language';
import { IRGB, IRGBA } from '../../kl-types';
import { ISize2D } from '../../../bb/bb-types';
import { table } from '../components/table';
import { ERASE_COLOR } from '../../brushes/erase-color';
import { theme } from '../../../theme/theme';

export function newImageDialog(p: {
    currentColor: IRGB; // current color
    secondaryColor: IRGB;
    maxCanvasSize: number;
    canvasWidth: number; // current canvas size
    canvasHeight: number; // current canvas size
    workspaceWidth: number;
    workspaceHeight: number;
    onConfirm: (width: number, height: number, color: IRGBA) => void;
    onCancel: () => void;
}): void {
    const currentColor = p.currentColor;
    const secondaryColor = p.secondaryColor;
    const maxCanvasSize = p.maxCanvasSize;
    const canvasWidth = p.canvasWidth;
    const canvasHeight = p.canvasHeight;
    const workspaceWidth = p.workspaceWidth;
    const workspaceHeight = p.workspaceHeight;
    const onConfirm = p.onConfirm;
    const onCancel = p.onCancel;

    function createRatioSize(
        ratioX: number,
        ratioY: number,
        width: number,
        height: number,
        padding: number,
    ): ISize2D {
        return BB.fitInto(
            ratioX,
            ratioY,
            Math.min(maxCanvasSize, width - padding),
            Math.min(maxCanvasSize, height - padding),
            1,
        );
    }

    const newImDiv = BB.el();
    const widthInput = BB.el({ tagName: 'input' });
    const unitStyle = {
        color: '#888',
        fontSize: '12px',
        marginLeft: '5px',
    };
    const widthUnit = BB.el({
        textContent: LANG('new-px'),
        css: unitStyle,
    });
    const heightInput = BB.el({ tagName: 'input' });
    const heightUnit = BB.el({
        textContent: LANG('new-px'),
        css: unitStyle,
    });

    widthInput.setAttribute('data-ignore-focus', 'true');
    heightInput.setAttribute('data-ignore-focus', 'true');

    widthInput.type = 'number';
    widthInput.min = '1';
    widthInput.max = '' + maxCanvasSize;
    BB.css(widthInput, {
        width: '70px',
    });

    heightInput.type = 'number';
    heightInput.min = '1';
    heightInput.max = '' + maxCanvasSize;
    heightInput.style.width = '70px';
    widthInput.value = '' + canvasWidth;
    heightInput.value = '' + canvasHeight;
    widthInput.onclick = (): void => {
        widthInput.focus();
        updateRatio();
    };
    heightInput.onclick = (): void => {
        heightInput.focus();
        updateRatio();
    };

    const sizeTable = table([
        [LANG('width') + ':&nbsp;', widthInput, widthUnit],
        [BB.el({ css: { height: '5px' } }), '', ''],
        [LANG('height') + ':&nbsp;', heightInput, heightUnit],
    ]);
    BB.css(sizeTable, {
        marginBottom: '10px',
    });

    const ratioWrapper = BB.el({
        css: {
            marginTop: '5px',
            color: '#888',
        },
    });

    const templateWrapper = BB.el({
        css: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
        },
    });
    const presetFitBtn = BB.el({ tagName: 'button' });
    templateWrapper.style.marginBottom = '10px';
    const presetCurrentBtn = BB.el({ tagName: 'button' });
    const presetSquareBtn = BB.el({ tagName: 'button' });
    const presetLandscapeBtn = BB.el({ tagName: 'button' });
    const presetPortraitBtn = BB.el({ tagName: 'button' });
    const presetOversizeBtn = BB.el({ tagName: 'button' });

    presetCurrentBtn.textContent = LANG('new-current');
    presetFitBtn.textContent = LANG('new-fit');
    presetOversizeBtn.textContent = LANG('new-oversize');
    presetLandscapeBtn.textContent = LANG('new-landscape');
    presetPortraitBtn.textContent = LANG('new-portrait');
    presetSquareBtn.textContent = LANG('new-square');

    templateWrapper.append(
        presetCurrentBtn,
        presetFitBtn,
        presetOversizeBtn,
        presetSquareBtn,
        presetLandscapeBtn,
        presetPortraitBtn,
    );

    const templatePadding = 0;

    presetCurrentBtn.onclick = function (): void {
        widthInput.value = '' + canvasWidth;
        heightInput.value = '' + canvasHeight;
        updateRatio();
    };
    presetFitBtn.onclick = function (): void {
        widthInput.value = '' + workspaceWidth;
        heightInput.value = '' + workspaceHeight;
        updateRatio();
    };
    presetOversizeBtn.onclick = function (): void {
        widthInput.value = '' + (workspaceWidth + 500);
        heightInput.value = '' + (workspaceHeight + 500);
        updateRatio();
    };
    presetSquareBtn.onclick = function (): void {
        const sizeObj = createRatioSize(1, 1, workspaceWidth, workspaceHeight, templatePadding);
        widthInput.value = '' + Math.round(sizeObj.width);
        heightInput.value = '' + Math.round(sizeObj.height);
        updateRatio();
    };
    presetLandscapeBtn.onclick = function (): void {
        const sizeObj = createRatioSize(4, 3, workspaceWidth, workspaceHeight, templatePadding);
        widthInput.value = '' + Math.round(sizeObj.width);
        heightInput.value = '' + Math.round(sizeObj.height);
        updateRatio();
    };
    presetPortraitBtn.onclick = function (): void {
        const sizeObj = createRatioSize(3, 4, workspaceWidth, workspaceHeight, templatePadding);
        widthInput.value = '' + Math.round(sizeObj.width);
        heightInput.value = '' + Math.round(sizeObj.height);
        updateRatio();
    };

    const select = new Select({
        isFocusable: true,
        optionArr: [
            ['screen', LANG('new-screen')],
            ['16 9', LANG('new-video') + ' 16:9'],
            ['3 2', '3:2'],
            ['5 3', '5:3'],
            ['2 1', '2:1'],
            ['paper', LANG('new-din-paper') + ' √2:1'],
            ['9 16', '9:16'],
            ['2 3', '2:3'],
            ['3 5', '3:5'],
            ['1 2', '1:2'],
            ['1 1.4142135623730951', '1:√2'],
        ],
        onChange: function (val): void {
            if (val === 'screen') {
                widthInput.value = '' + window.screen.width;
                heightInput.value = '' + window.screen.height;
            } else if (val === 'paper') {
                const sizeObj = createRatioSize(
                    Math.sqrt(2),
                    1,
                    workspaceWidth,
                    workspaceHeight,
                    templatePadding,
                );
                widthInput.value = '' + Math.round(sizeObj.width);
                heightInput.value = '' + Math.round(sizeObj.height);
            } else {
                const split = val.split(' ');
                const sizeObj = createRatioSize(
                    parseFloat(split[0]),
                    parseFloat(split[1]),
                    workspaceWidth,
                    workspaceHeight,
                    templatePadding,
                );
                widthInput.value = '' + Math.round(sizeObj.width);
                heightInput.value = '' + Math.round(sizeObj.height);
            }
            updateRatio();
            select.setValue(undefined);
        },
    });
    setTimeout(() => {
        // safari: not empty without also setting it to null via timeout
        select.setValue(undefined);
    }, 0);
    BB.css(select.getElement(), {
        width: '80px',
    });
    templateWrapper.append(select.getElement());

    let backgroundRGBA = { r: 255, g: 255, b: 255, a: 1 };

    const colorOptionsArr = [
        { r: 255, g: 255, b: 255, a: 1 },
        { r: 0, g: 0, b: 0, a: 1 },
        { r: 0, g: 0, b: 0, a: 0 },
        {
            r: currentColor.r,
            g: currentColor.g,
            b: currentColor.b,
            a: 1,
        },
        {
            r: secondaryColor.r,
            g: secondaryColor.g,
            b: secondaryColor.b,
            a: 1,
        },
    ];
    let initColorIndex = 0;
    if (theme.isDark()) {
        colorOptionsArr.forEach((item, index) => {
            if (item.r === ERASE_COLOR && item.g === ERASE_COLOR && item.b === ERASE_COLOR) {
                initColorIndex = index;
                backgroundRGBA = item;
            }
        });
    }

    const colorOptions = new ColorOptions({
        colorArr: colorOptionsArr,
        initialIndex: initColorIndex,
        onChange: function (rgbaObj): void {
            backgroundRGBA = rgbaObj!;
            preview.style.backgroundColor =
                'rgba(' +
                rgbaObj!.r +
                ',' +
                rgbaObj!.g +
                ',' +
                rgbaObj!.b +
                ', ' +
                rgbaObj!.a +
                ')';
        },
    });

    const previewWrapper = BB.el({
        className: 'kl-transparent-preview',
        css: {
            boxSizing: 'border-box',
            width: '340px',
            height: '140px',
            display: 'table',
            padding: '10px',
            marginTop: '10px',
            marginLeft: '-20px',
        },
    });
    const preview = BB.el({
        className: 'kl-transparent-preview__canvas',
        css: {
            width: 200 + 'px',
            height: 100 + 'px',
            backgroundColor:
                'rgba(' +
                backgroundRGBA.r +
                ',' +
                backgroundRGBA.g +
                ',' +
                backgroundRGBA.b +
                ', ' +
                backgroundRGBA.a +
                ')',
            marginLeft: 'auto',
            marginRight: 'auto',
            color: '#aaa',
            fontSize: '16px',
            fontWeight: 'bold',
            textAlign: 'center',
            verticalAlign: 'center',
            display: 'table',
            overflow: 'hidden',
        },
    });
    BB.el({
        parent: previewWrapper,
        content: preview,
        css: {
            display: 'table-cell',
            verticalAlign: 'middle',
        },
    });
    BB.el({
        parent: preview,
        css: {
            display: 'table-cell',
            verticalAlign: 'middle',
        },
    });

    function updateRatio(): void {
        widthInput.value = '' + Math.min(maxCanvasSize, parseInt(widthInput.value));
        heightInput.value = '' + Math.min(maxCanvasSize, parseInt(heightInput.value));

        function hcf(u: number, v: number): number {
            let U = u,
                V = v;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (!(U %= V)) {
                    return V;
                }
                if (!(V %= U)) {
                    return U;
                }
            }
        }

        let w = parseInt(widthInput.value);
        let h = parseInt(heightInput.value);
        if (w < 1 || w > maxCanvasSize || h < 1 || h > maxCanvasSize) {
            if (w > maxCanvasSize) {
                w = maxCanvasSize;
            } else if (h > maxCanvasSize) {
                h = maxCanvasSize;
            }

            widthInput.value = '' + w;
            heightInput.value = '' + h;
        }

        //generated canvas size doesn't always match ratio. so check if a common ratio is very close
        const commonRatios = [
            [1, 2],
            [2, 1],
            [2, 3],
            [3, 2],
            [3, 4],
            [4, 3],
            [4, 5],
            [5, 4],
            [16, 9],
            [9, 16],
            [3, 2],
            [2, 3],
            [5, 3],
            [3, 5],
            [2, 1],
            [1, 2],
            [1.414, 1],
            [1, 1.414],
        ];
        const reducedArr = BB.reduce(w, h);
        let closestRatio = commonRatios[0];
        let closestDistance = Math.abs(
            commonRatios[0][0] / commonRatios[0][1] - reducedArr[0] / reducedArr[1],
        );
        for (let i = 0; i < commonRatios.length; i++) {
            if (
                Math.abs(commonRatios[i][0] / commonRatios[i][1] - reducedArr[0] / reducedArr[1]) <
                closestDistance
            ) {
                closestRatio = commonRatios[i];
                closestDistance = Math.abs(
                    commonRatios[i][0] / commonRatios[i][1] - reducedArr[0] / reducedArr[1],
                );
            }
        }
        //display ratio
        if (closestDistance > 0 && closestDistance < 0.005) {
            ratioWrapper.innerText =
                LANG('new-ratio') + ': ~' + closestRatio[0] + ':' + closestRatio[1];
        } else {
            ratioWrapper.innerText = LANG('new-ratio') + ': ' + reducedArr[0] + ':' + reducedArr[1];
        }

        const realw = w;
        const T = hcf(w, h);
        w /= T;
        h /= T;
        w *= 260;
        h *= 260;
        if (w > 260) {
            h = (260 / w) * h;
            w = 260;
        }
        if (h > 100) {
            w = (100 / h) * w;
            h = 100;
        }

        preview.style.width = w + 'px';
        preview.style.height = h + 'px';
        BB.createCheckerDataUrl(
            parseInt('' + 30 * (w / realw)),
            function (url) {
                previewWrapper.style.background = 'url(' + url + ')';
            },
            theme.isDark(),
        );
    }
    theme.addIsDarkListener(updateRatio);

    widthInput.onchange = (): void => {
        if (widthInput.value === '' || parseInt(widthInput.value) < 0) {
            widthInput.value = '1';
        }
        updateRatio();
    };
    widthInput.onkeyup = (): void => {
        updateRatio();
    };
    heightInput.onchange = (): void => {
        if (heightInput.value === '' || parseFloat(heightInput.value) < 0) {
            heightInput.value = '1';
        }
        updateRatio();
    };
    heightInput.onkeyup = (): void => {
        updateRatio();
    };
    updateRatio();

    newImDiv.append(templateWrapper);
    const secondRow = BB.el({
        parent: newImDiv,
        css: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
        },
    });
    const secondRowLeft = BB.el({
        parent: secondRow,
    });
    secondRowLeft.append(sizeTable, ratioWrapper);
    secondRow.append(colorOptions.getElement());

    newImDiv.append(previewWrapper);

    showModal({
        target: document.body,
        message: `<b>${LANG('new-title')}</b>`,
        div: newImDiv,
        buttons: ['Ok', 'Cancel'],
        callback: function (result) {
            BB.unsetEventHandler(widthInput, 'onclick', 'onchange', 'onkeyup');
            BB.unsetEventHandler(widthInput, 'onclick', 'onchange', 'onkeyup');

            BB.unsetEventHandler(presetCurrentBtn, 'onclick');
            BB.unsetEventHandler(presetFitBtn, 'onclick');
            BB.unsetEventHandler(presetOversizeBtn, 'onclick');
            BB.unsetEventHandler(presetSquareBtn, 'onclick');
            BB.unsetEventHandler(presetLandscapeBtn, 'onclick');
            BB.unsetEventHandler(presetPortraitBtn, 'onclick');

            select.destroy();
            colorOptions.destroy();
            theme.removeIsDarkListener(updateRatio);

            if (
                result === 'Cancel' ||
                parseInt(widthInput.value) <= 0 ||
                parseInt(heightInput.value) <= 0 ||
                isNaN(parseInt(widthInput.value)) ||
                isNaN(parseInt(heightInput.value))
            ) {
                onCancel();
                return;
            }
            onConfirm(parseInt(widthInput.value), parseInt(heightInput.value), backgroundRGBA);
        },
        clickOnEnter: 'Ok',
    });
}
