import {BB} from '../../../bb/bb';
import {Select} from '../base-components/select';
import {ColorOptions} from '../base-components/color-options';
import {popup} from './popup';
import {LANG} from '../../../language/language';

/**
 * P = {
 *     currentColor: RGB, // current color
 *     secondaryColor: RGB,
 *     maxCanvasSize: number,
 *     canvasWidth: number, // current canvas size
 *     canvasHeight: number, // current canvas size
 *     workspaceWidth: number,
 *     workspaceHeight: number,
 *     onConfirm: function(width number, height number, color RGBA),
 *     onCancel: function()
 * }
 *
 * @param p
 */
export function newImageDialog(p) {

    let currentColor = p.currentColor;
    let secondaryColor = p.secondaryColor;
    let maxCanvasSize = p.maxCanvasSize;
    let canvasWidth = p.canvasWidth;
    let canvasHeight = p.canvasHeight;
    let workspaceWidth = p.workspaceWidth;
    let workspaceHeight = p.workspaceHeight;
    let onConfirm = p.onConfirm;
    let onCancel = p.onCancel;


    function createRatioSize(ratioX, ratioY, width, height, padding) {
        return BB.fitInto(ratioX, ratioY, Math.min(maxCanvasSize, width - padding), Math.min(maxCanvasSize, height - padding), 1);
    }

    let newImDiv = document.createElement("div");
    let widthWrapper = document.createElement("div");
    let heightWrapper = document.createElement("div");
    let widthInput = document.createElement("input");
    let widthUnit = document.createElement("div");
    let heightInput = document.createElement("input");
    let heightUnit = document.createElement("div");
    widthWrapper.style.position = "relative";
    widthWrapper.style.width = "145px";
    widthWrapper.style.height = "35px";
    widthWrapper.style.lineHeight = "30px";
    heightWrapper.style.width = "145px";
    heightWrapper.style.height = "35px";
    heightWrapper.style.lineHeight = "30px";

    widthUnit.innerText = LANG('new-px');
    widthUnit.style.color = '#888';
    widthUnit.style.fontSize = "12px";
    widthUnit.style.marginLeft = "5px";
    widthUnit.style.cssFloat = "right";

    heightUnit.innerText = LANG('new-px');
    heightUnit.style.color = '#888';
    heightUnit.style.fontSize = "12px";
    heightUnit.style.marginLeft = "5px";
    heightUnit.style.cssFloat = "right";

    widthInput.setAttribute('data-ignore-focus', 'true');
    heightInput.setAttribute('data-ignore-focus', 'true');

    widthInput.type = 'number';
    widthInput.min = '1';
    widthInput.max = maxCanvasSize;
    widthInput.style.cssFloat = "right";
    widthInput.style.width = "70px";

    heightInput.type = 'number';
    heightInput.min = '1';
    heightInput.max = maxCanvasSize;
    heightInput.style.cssFloat = "right";
    heightInput.style.width = "70px";
    widthInput.value = canvasWidth;
    heightInput.value = canvasHeight;
    widthInput.onclick = function () {
        (this as any).focus();
        updateRatio();
    };
    heightInput.onclick = function () {
        (this as any).focus();
        updateRatio();
    };
    widthWrapper.appendChild(widthUnit);
    widthWrapper.appendChild(widthInput);
    BB.appendTextDiv(widthWrapper, LANG('width') + ": ");
    heightWrapper.appendChild(heightUnit);
    heightWrapper.appendChild(heightInput);
    BB.appendTextDiv(heightWrapper, LANG('height') + ": ");
    let ratioWrapper = document.createElement("div");
    ratioWrapper.style.marginTop = '5px';
    ratioWrapper.style.color = '#888';

    let templateWrapper = document.createElement("div");
    //BB.appendTextDiv(templateWrapper, "Preset Resolutions: <br />");
    let presetFitBtn = document.createElement("button");
    templateWrapper.style.marginBottom = "10px";
    let presetCurrentBtn = document.createElement("button");
    let presetSquareBtn = document.createElement("button");
    let presetLandscapeBtn = document.createElement("button");
    let presetPortraitBtn = document.createElement("button");
    let presetOversizeBtn = document.createElement("button");

    presetCurrentBtn.textContent = LANG('new-current');
    presetFitBtn.textContent = LANG('new-fit');
    presetOversizeBtn.textContent = LANG('new-oversize');
    presetLandscapeBtn.textContent = LANG('new-landscape');
    presetPortraitBtn.textContent = LANG('new-portrait');
    presetSquareBtn.textContent = LANG('new-square');

    presetCurrentBtn.style.marginRight = "5px";
    presetFitBtn.style.marginRight = "5px";
    presetOversizeBtn.style.marginRight = "5px";
    presetLandscapeBtn.style.marginTop = "5px";
    presetLandscapeBtn.style.marginRight = "5px";
    presetPortraitBtn.style.marginTop = "5px";
    presetPortraitBtn.style.marginRight = "5px";

    templateWrapper.appendChild(presetCurrentBtn);
    templateWrapper.appendChild(presetFitBtn);
    templateWrapper.appendChild(presetOversizeBtn);
    templateWrapper.appendChild(presetSquareBtn);
    templateWrapper.appendChild(presetLandscapeBtn);
    templateWrapper.appendChild(presetPortraitBtn);

    let templatePadding = 50;

    presetCurrentBtn.onclick = function () {
        widthInput.value = canvasWidth;
        heightInput.value = canvasHeight;
        updateRatio();
    };
    presetFitBtn.onclick = function () {
        widthInput.value = workspaceWidth;
        heightInput.value = workspaceHeight;
        updateRatio();
    };
    presetOversizeBtn.onclick = function () {
        widthInput.value = workspaceWidth + 500;
        heightInput.value = workspaceHeight + 500;
        updateRatio();
    };
    presetSquareBtn.onclick = function () {
        let sizeObj = createRatioSize(1, 1, workspaceWidth, workspaceHeight, templatePadding);
        widthInput.value = '' + Math.round(sizeObj.width);
        heightInput.value = '' + Math.round(sizeObj.height);
        updateRatio();
    };
    presetLandscapeBtn.onclick = function () {
        let sizeObj = createRatioSize(4, 3, workspaceWidth, workspaceHeight, templatePadding);
        widthInput.value = '' + Math.round(sizeObj.width);
        heightInput.value = '' + Math.round(sizeObj.height);
        updateRatio();
    };
    presetPortraitBtn.onclick = function () {
        let sizeObj = createRatioSize(3, 4, workspaceWidth, workspaceHeight, templatePadding);
        widthInput.value = '' + Math.round(sizeObj.width);
        heightInput.value = '' + Math.round(sizeObj.height);
        updateRatio();
    };

    let select = new Select({
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
            ['1 1.4142135623730951', '1:√2']
        ],
        onChange: function(val) {
            if (val === 'screen') {
                widthInput.value = '' + window.screen.width;
                heightInput.value = '' + window.screen.height;
            } else if (val === 'paper') {
                let sizeObj = createRatioSize(Math.sqrt(2), 1, workspaceWidth, workspaceHeight, templatePadding);
                widthInput.value = '' + Math.round(sizeObj.width);
                heightInput.value = '' + Math.round(sizeObj.height);
            } else {
                let split = val.split(' ');
                let sizeObj = createRatioSize(parseFloat(split[0]), parseFloat(split[1]), workspaceWidth, workspaceHeight, templatePadding);
                widthInput.value = '' + Math.round(sizeObj.width);
                heightInput.value = '' + Math.round(sizeObj.height);
            }
            updateRatio();
            select.setValue(null);
        }
    });
    setTimeout(() => {
        // safari: not empty without also setting it to null via timeout
        select.setValue(null);
    }, 0);
    BB.css(select.getElement(), {
        width: '80px',
    });
    templateWrapper.appendChild(select.getElement());



    let backgroundRGBA = {r: 255, g: 255, b: 255, a: 1};

    let colorOptionsArr = [
        {r: 255, g: 255, b: 255, a: 1},
        {r: 0, g: 0, b: 0, a: 1},
        {r: 0, g: 0, b: 0, a: 0}
    ];
    colorOptionsArr.push({
        r: currentColor.r,
        g: currentColor.g,
        b: currentColor.b,
        a: 1
    });
    colorOptionsArr.push({
        r: secondaryColor.r,
        g: secondaryColor.g,
        b: secondaryColor.b,
        a: 1
    });

    let colorOptions = new ColorOptions({
        colorArr: colorOptionsArr,
        onChange: function(rgbaObj) {
            backgroundRGBA = rgbaObj;
            preview.style.backgroundColor = "rgba(" + rgbaObj.r + "," + rgbaObj.g + "," + rgbaObj.b + ", " + rgbaObj.a + ")";
        }
    });

    let previewWrapper = document.createElement("div");
    BB.css(previewWrapper, {
        boxSizing: 'border-box',
        width: '340px',
        height: '140px',
        display: 'table',
        backgroundColor: '#9e9e9e',
        padding: '10px',
        marginTop: '10px',
        boxShadow: 'rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset',
        marginLeft: '-20px',
        colorScheme: 'only light',
    });
    let preview = document.createElement("div");
    BB.css(preview, {
        width: 200 + "px",
        height: 100 + "px",
        backgroundColor: "#fff",
        marginLeft: "auto",
        marginRight: "auto",
        color: "#aaa",
        fontSize: "16px",
        fontWeight: "bold",
        textAlign: "center",
        verticalAlign: "center",
        display: "table",
        overflow: "hidden",
        boxShadow: "0px 0px 3px rgba(0,0,0,0.5)"
    });
    let previewcell = document.createElement("div");
    previewcell.style.display = "table-cell";
    previewcell.style.verticalAlign = "middle";
    previewcell.appendChild(preview);
    previewWrapper.appendChild(previewcell);
    let cell = BB.appendTextDiv(preview, "");
    //let ratio = BB.appendTextDiv(cell, "1:2");
    cell.style.display = "table-cell";
    cell.style.verticalAlign = "middle";
    let prevW = parseInt(widthInput.value);
    let prevH = parseInt(heightInput.value);

    function updateRatio() {
        widthInput.value = '' + Math.min(maxCanvasSize, parseInt(widthInput.value));
        heightInput.value = '' + Math.min(maxCanvasSize, parseInt(heightInput.value));

        function HCF(u, v) {
            let U = u, V = v;
            while (true) {
                if (!(U %= V))
                    return V;
                if (!(V %= U))
                    return U;
            }
        }

        let w = parseInt(widthInput.value);
        let h = parseInt(heightInput.value);
        if (w < 1 || w > maxCanvasSize || h < 1 || h > maxCanvasSize) {
            if (w > maxCanvasSize)
                w = maxCanvasSize;
            else if (h > maxCanvasSize)
                h = maxCanvasSize;

            widthInput.value = '' + w;
            heightInput.value = '' + h;
        }

        //generated canvas size doesn't always match ratio. so check if a common ratio is very close
        let commonRatios = [
            [1, 2], [2, 1],
            [2, 3], [3, 2],
            [3, 4], [4, 3],
            [4, 5], [5, 4],
            [16, 9], [9, 16],
            [3, 2], [2, 3],
            [5, 3], [3, 5],
            [2, 1], [1, 2],
            [1.414, 1], [1, 1.414],
        ];
        let reducedArr = BB.reduce(w, h);
        let closestRatio = null;
        let closestDistance = null;
        for (let i = 0; i < commonRatios.length; i++) {
            if (i === 0 || Math.abs(commonRatios[i][0] / commonRatios[i][1] - reducedArr[0] / reducedArr[1]) < closestDistance) {
                closestRatio = commonRatios[i];
                closestDistance = Math.abs(commonRatios[i][0] / commonRatios[i][1] - reducedArr[0] / reducedArr[1]);
            }
        }
        //display ratio
        if (closestDistance > 0 && closestDistance < 0.005) {
            ratioWrapper.innerText = LANG('new-ratio') + ': ~' + closestRatio[0] + ':' + closestRatio[1];
        } else {
            ratioWrapper.innerText = LANG('new-ratio') + ': ' + reducedArr[0] + ':' + reducedArr[1];
        }

        prevW = w;
        prevH = h;
        let realw = w;
        let T = HCF(w, h);
        w /= T;
        h /= T;
        w *= 260;
        h *= 260;
        if (w > 260) {
            h = 260 / w * h;
            w = 260;
        }
        if (h > 100) {
            w = 100 / h * w;
            h = 100;

        }

        preview.style.width = w + "px";
        preview.style.height = h + "px";
        BB.createCheckerDataUrl(parseInt('' + (30 * (w / realw))), function (url) {
            previewWrapper.style.background = "url(" + url + ")";
        });
    }

    widthInput.onchange = function () {
        if (widthInput.value === '' || parseInt(widthInput.value) < 0) {
            widthInput.value = '1';
        }
        updateRatio();
    };
    widthInput.onkeyup = function () {
        updateRatio();
    };
    heightInput.onchange = function () {
        if (heightInput.value === '' || parseFloat(heightInput.value) < 0) {
            heightInput.value = '1';
        }
        updateRatio();
    };
    heightInput.onkeyup = function () {
        updateRatio();
    };
    updateRatio();

    newImDiv.appendChild(templateWrapper);
    let secondRow = BB.el({
        parent: newImDiv,
        css: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end'
        }
    });
    let secondRowLeft = BB.el({
        parent: secondRow
    });
    secondRowLeft.appendChild(widthWrapper);
    secondRowLeft.appendChild(heightWrapper);
    secondRowLeft.appendChild(ratioWrapper);
    secondRow.appendChild(colorOptions.getElement());

    newImDiv.appendChild(previewWrapper);

    popup({
        target: document.body,
        message: `<b>${LANG('new-title')}</b>`,
        div: newImDiv,
        buttons: ['Ok', 'Cancel'],
        callback: function (result) {
            widthInput.onclick = null;
            heightInput.onclick = null;
            presetCurrentBtn.onclick = null;
            presetFitBtn.onclick = null;
            presetOversizeBtn.onclick = null;
            presetSquareBtn.onclick = null;
            presetLandscapeBtn.onclick = null;
            presetPortraitBtn.onclick = null;
            widthInput.onchange = null;
            widthInput.onkeyup = null;
            heightInput.onchange = null;
            heightInput.onkeyup = null;
            select.destroy();
            colorOptions.destroy();

            if (result === "Cancel" || parseInt(widthInput.value) <= 0 || parseInt(heightInput.value) <= 0 || isNaN(parseInt(widthInput.value)) || isNaN(parseInt(heightInput.value))) {
                onCancel();
                return;
            }
            onConfirm(parseInt(widthInput.value), parseInt(heightInput.value), backgroundRGBA);
        },
        clickOnEnter: 'Ok'
    });

}