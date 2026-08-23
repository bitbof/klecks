import { BB } from '../../../bb/bb';
import { Select } from '../components/select';
import { ColorOptions } from '../components/color-options';
import { showModal } from './base/show-modal';
import { LANG } from '../../../language/language';
import { TRgb, TRgba } from '../../kl-types';
import { TSize2D } from '../../../bb/bb-types';
import { table } from '../components/table';
import { css } from '../../../bb/base/base';
import { Input } from '../components/input';

export function newImageDialog(p: {
    currentColor: TRgb; // current color
    secondaryColor: TRgb;
    maxCanvasSize: number;
    canvasWidth: number; // current canvas size
    canvasHeight: number; // current canvas size
    workspaceWidth: number;
    workspaceHeight: number;
    onConfirm: (width: number, height: number, color: TRgba) => void;
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
    ): TSize2D {
        return BB.fitInto(
            ratioX,
            ratioY,
            Math.min(maxCanvasSize, width - padding),
            Math.min(maxCanvasSize, height - padding),
            1,
        );
    }

    const newImDiv = BB.el();
    const widthInput = new Input({
        type: 'number',
        init: canvasWidth,
        min: 1,
        max: maxCanvasSize,
        step: 1,
        name: 'image-width',
        isFocusIgnored: true,
        css: { width: 70 },
        onChange: () => updateRatio(),
    });
    const unitStyle = {
        color: '#888',
        fontSize: 12,
        marginLeft: 5,
    };
    const widthUnit = BB.el({
        textContent: LANG('new-px'),
        css: unitStyle,
    });
    const heightInput = new Input({
        type: 'number',
        init: canvasHeight,
        min: 1,
        max: maxCanvasSize,
        step: 1,
        name: 'image-height',
        isFocusIgnored: true,
        css: { width: 70 },
        onChange: () => updateRatio(),
    });
    const heightUnit = BB.el({
        textContent: LANG('new-px'),
        css: unitStyle,
    });

    const sizeTable = table([
        [LANG('width') + ':&nbsp;', widthInput.getElement(), widthUnit],
        [BB.el({ css: { height: 5 } }), '', ''],
        [LANG('height') + ':&nbsp;', heightInput.getElement(), heightUnit],
    ]);
    css(sizeTable, {
        marginBottom: 10,
    });

    const ratioWrapper = BB.el({
        css: {
            marginTop: 5,
            color: '#888',
        },
    });

    const templateWrapper = BB.el({
        css: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            marginBottom: 10,
        },
    });
    const presetBtnConfig = {
        tagName: 'button',
        className: 'kl-button',
        css: { flexGrow: '1' },
    } as const;
    const presetFitBtn = BB.el(presetBtnConfig);
    const presetCurrentBtn = BB.el(presetBtnConfig);
    const presetSquareBtn = BB.el(presetBtnConfig);
    const presetLandscapeBtn = BB.el(presetBtnConfig);
    const presetPortraitBtn = BB.el(presetBtnConfig);
    const presetOversizeBtn = BB.el(presetBtnConfig);

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
        widthInput.setValue(canvasWidth, true);
        heightInput.setValue(canvasHeight, true);
        updateRatio();
    };
    presetFitBtn.onclick = function (): void {
        widthInput.setValue(workspaceWidth, true);
        heightInput.setValue(workspaceHeight, true);
        updateRatio();
    };
    presetOversizeBtn.onclick = function (): void {
        widthInput.setValue(workspaceWidth + 500, true);
        heightInput.setValue(workspaceHeight + 500, true);
        updateRatio();
    };
    presetSquareBtn.onclick = function (): void {
        const { width, height } = createRatioSize(
            1,
            1,
            workspaceWidth,
            workspaceHeight,
            templatePadding,
        );
        widthInput.setValue(width, true);
        heightInput.setValue(height, true);
        updateRatio();
    };
    presetLandscapeBtn.onclick = function (): void {
        const { width, height } = createRatioSize(
            4,
            3,
            workspaceWidth,
            workspaceHeight,
            templatePadding,
        );
        widthInput.setValue(width, true);
        heightInput.setValue(height, true);
        updateRatio();
    };
    presetPortraitBtn.onclick = function (): void {
        const { width, height } = createRatioSize(
            3,
            4,
            workspaceWidth,
            workspaceHeight,
            templatePadding,
        );
        widthInput.setValue(width, true);
        heightInput.setValue(height, true);
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
                widthInput.setValue(window.screen.width, true);
                heightInput.setValue(window.screen.height, true);
            } else if (val === 'paper') {
                const { width, height } = createRatioSize(
                    Math.sqrt(2),
                    1,
                    workspaceWidth,
                    workspaceHeight,
                    templatePadding,
                );
                widthInput.setValue(width, true);
                heightInput.setValue(height, true);
            } else {
                const split = val.split(' ');
                const { width, height } = createRatioSize(
                    parseFloat(split[0]),
                    parseFloat(split[1]),
                    workspaceWidth,
                    workspaceHeight,
                    templatePadding,
                );
                widthInput.setValue(width, true);
                heightInput.setValue(height, true);
            }
            updateRatio();
            select.setValue(undefined);
        },
        name: 'image-format',
    });
    setTimeout(() => {
        // safari: not empty without also setting it to null via timeout
        select.setValue(undefined);
    }, 0);
    css(select.getElement(), {
        width: 80,
        flexGrow: 1,
    });
    templateWrapper.append(select.getElement());

    let backgroundRgba = { r: 255, g: 255, b: 255, a: 1 };

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

    const colorOptions = new ColorOptions({
        colorArr: colorOptionsArr,
        initialIndex: 0,
        onChange: function (rgbaObj): void {
            backgroundRgba = rgbaObj!;
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
            width: 340,
            height: 140,
            display: 'table',
            padding: 10,
            marginTop: 10,
            marginLeft: -20,
            background: 'var(--kl-checkerboard-background)',
        },
    });
    const preview = BB.el({
        className: 'kl-transparent-preview__canvas',
        css: {
            width: 200,
            height: 100,
            backgroundColor:
                'rgba(' +
                backgroundRgba.r +
                ',' +
                backgroundRgba.g +
                ',' +
                backgroundRgba.b +
                ', ' +
                backgroundRgba.a +
                ')',
            marginLeft: 'auto',
            marginRight: 'auto',
            color: '#aaa',
            fontSize: 16,
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
        function hcf(u: number, v: number): number {
            let U = u,
                V = v;

            while (true) {
                if (!(U %= V)) {
                    return V;
                }
                if (!(V %= U)) {
                    return U;
                }
            }
        }

        let w = widthInput.getValue();
        let h = heightInput.getValue();

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
        previewWrapper.style.backgroundSize = Math.round(Math.max(4, 60 * (w / realw))) + 'px';
    }

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
        message: `<b>${LANG('new-title')}</b>`,
        div: newImDiv,
        buttons: ['Ok', 'Cancel'],
        callback: function (result) {
            BB.unsetEventHandler(presetCurrentBtn, 'onclick');
            BB.unsetEventHandler(presetFitBtn, 'onclick');
            BB.unsetEventHandler(presetOversizeBtn, 'onclick');
            BB.unsetEventHandler(presetSquareBtn, 'onclick');
            BB.unsetEventHandler(presetLandscapeBtn, 'onclick');
            BB.unsetEventHandler(presetPortraitBtn, 'onclick');

            select.destroy();
            colorOptions.destroy();
            widthInput.destroy();
            heightInput.destroy();

            if (result === 'Cancel') {
                onCancel();
                return;
            }
            onConfirm(widthInput.getValue(), heightInput.getValue(), backgroundRgba);
        },
        clickOnEnter: 'Ok',
    });
}
