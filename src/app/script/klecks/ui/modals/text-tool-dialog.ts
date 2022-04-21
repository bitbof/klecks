import {BB} from '../../../bb/bb';
import {renderText} from '../../image-operations/render-text';
import {ColorOptions} from '../base-components/color-options';
import {Select} from '../base-components/select';
import {ImageRadioList} from '../base-components/image-radio-list';
import {ImageToggle} from '../base-components/image-toggle';
import {KlSlider} from '../base-components/kl-slider';
import {popup} from './popup';
// @ts-ignore
import alignLeftImg from 'url:~/src/app/img/ui/align-left.svg';
// @ts-ignore
import alignCenterImg from 'url:~/src/app/img/ui/align-center.svg';
// @ts-ignore
import alignRightImg from 'url:~/src/app/img/ui/align-right.svg';
// @ts-ignore
import typoItalicImg from 'url:~/src/app/img/ui/typo-italic.svg';
// @ts-ignore
import typoBoldImg from 'url:~/src/app/img/ui/typo-bold.svg';
// @ts-ignore
import toolZoomInImg from 'url:~/src/app/img/ui/tool-zoom-in.svg';
// @ts-ignore
import toolZoomOutImg from 'url:~/src/app/img/ui/tool-zoom-out.svg';
import {IRGB} from '../../kl.types';
import {KlCanvas} from '../../canvas/kl-canvas';
import {LANG} from '../../../language/language';

/**
 * Text Tool dialog
 *
 * confirmP = {
 *     x: number,
 *     y: number,
 *     textStr: string,
 *     align: 'left' | 'center' | 'right',
 *     isItalic: boolean,
 *     isBold: boolean,
 *     color: rgb,
 *     size: number, // px
 *     font: 'serif' | 'monospace' | 'sans-serif' | 'cursive' | 'fantasy',
 *     opacity: number, // 0 - 1
 * }
 *
 * @param p
 */
export function textToolDialog(
    p: {
        klCanvas: KlCanvas;
        layerIndex: number;
        x: number;
        y: number;
        angleRad: number;
        color: IRGB;
        secondaryColor: IRGB;
        size: number; // px
        align: 'left' | 'center' | 'right'; // default 'left'
        isBold: boolean; // default false
        isItalic: boolean; // default false
        font: 'serif' | 'monospace' | 'sans-serif' | 'cursive' | 'fantasy'; // default sans-serif
        opacity: number; // 0 - 1; default 1
        onConfirm: (confirmP) => void;
    }
) {

    let div = BB.el({});

    let isSmallWidth = window.innerWidth < 550;
    let isSmallHeight = window.innerHeight < 630;

    // --- preview ---
    // Text drawn on klCanvas-sized canvas: textCanvas
    // LayerArr[target].canvas & textCanvas then drawn on targetCanvas
    //      they are transformed. canvas size of final preview
    // All layers and targetCanvas drawn on layersCanvas. transformed and size of final preview
    // Checkerboard, layersCanvas, and outline then drawn on previewCanvas

    let width = isSmallWidth ? 340 : 540;
    let height = isSmallWidth ? (isSmallHeight ? 210 : 260) : (isSmallHeight ? 230 : 350);
    let scale = 1;

    let layerArr = p.klCanvas.getLayersFast();
    let textCanvas = BB.canvas(p.klCanvas.getWidth(), p.klCanvas.getHeight());
    let textCtx = textCanvas.getContext('2d');
    let targetCanvas = BB.canvas(width, height);
    let targetCtx = targetCanvas.getContext('2d');
    let layersCanvas = BB.canvas(width, height);
    let layersCtx = layersCanvas.getContext('2d');
    let previewCanvas = BB.canvas(width, height); // the one that is visible
    let previewCtx = previewCanvas.getContext('2d');
    BB.css(previewCanvas, {
        display: 'block'
    });
    let previewWrapper = BB.el({
        parent: div,
        css: {
            position: 'relative',
            width: width + 'px',
            marginLeft: '-20px',
            cursor: 'move',
            colorScheme: 'only light',
            touchAction: 'none',
        },
        onClick: function() {
            textInput.focus();
        }
    });
    BB.el({ // inset shadow on preview
        parent: previewWrapper,
        css: {
            position: 'absolute',
            left: '0',
            top: '0',
            right: '0',
            bottom: '0',
            boxShadow: 'rgba(0, 0, 0, 0.2) 0px 1px inset, rgba(0, 0, 0, 0.2) 0px -1px inset',
            pointerEvents: 'none',
        }
    });
    previewWrapper.appendChild(previewCanvas);
    let checkerPattern = previewCtx.createPattern(BB.createCheckerCanvas(8), 'repeat');
    let emptyCanvas = BB.canvas(1, 1);
    {
        let ctx = emptyCanvas.getContext('2d');
        ctx.fillRect(0, 0, 1, 1);
    }

    function updatePreview() {

        // try to draw very much like klCanvasWorkspace

        // --- draw text ---
        textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
        let colorRGBA = {
            ...p.color,
            a: opacitySlider.getValue(),
        };
        let bounds = renderText(textCanvas, {
            x: p.x,
            y: p.y,
            textStr: textInput.value,
            align: alignRadioList.getValue(),
            isItalic: italicToggle.getValue(),
            isBold: boldToggle.getValue(),
            size: parseFloat(sizeInput.value),
            font: fontSelect.getValue(),
            color: BB.ColorConverter.toRgbaStr(colorRGBA),
            angleRad: p.angleRad
        });


        // --- determine transformation of viewport ---
        // text should always be visible
        bounds.width = Math.max(bounds.width, 1);
        bounds.height = Math.max(bounds.height, 1);
        let rotatedXY = BB.rotate(bounds.x, bounds.y, -p.angleRad / Math.PI * 180);
        let rotatedWH = BB.rotate(bounds.width, bounds.height, -p.angleRad / Math.PI * 180);
        let centerX = p.x + rotatedXY.x + rotatedWH.x / 2;
        let centerY = p.y + rotatedXY.y + rotatedWH.y / 2;

        let padding = 100;
        let fitBounds = BB.fitInto(bounds.width, bounds.height, width - padding, height - padding);
        scale = Math.min(1, fitBounds.width / bounds.width);
        scale = Math.min(4, scale * Math.pow(2, zoomFac));


        // --- compose text and target layer ---
        targetCtx.save();

        if (scale >= 4) {
            targetCtx.imageSmoothingEnabled = false;
        } else {
            targetCtx.imageSmoothingEnabled = true;
            targetCtx.imageSmoothingQuality  = scale >= 1 ? 'low' : 'medium';
        }

        targetCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        targetCtx.translate(width / 2, height / 2);
        targetCtx.scale(scale, scale);
        targetCtx.rotate(p.angleRad);
        targetCtx.drawImage(layerArr[p.layerIndex].canvas, -centerX, -centerY);
        targetCtx.drawImage(textCanvas, -centerX, -centerY);
        targetCtx.restore();


        // --- layers ---
        layersCtx.save();

        layersCtx.fillStyle = 'rgb(158,158,158)';
        layersCtx.fillRect(0, 0, width, height);

        { // bg
            layersCtx.save();

            layersCtx.translate(width / 2, height / 2);
            layersCtx.scale(scale, scale);
            layersCtx.rotate(p.angleRad);

            layersCtx.imageSmoothingEnabled = false;

            //outline
            let borderSize = 1 / scale;
            layersCtx.globalAlpha = 0.2;
            layersCtx.drawImage(emptyCanvas, -centerX - borderSize, -centerY - borderSize, textCanvas.width + borderSize * 2, textCanvas.height + borderSize * 2);
            layersCtx.globalAlpha = 1;

            //erase
            layersCtx.globalCompositeOperation = 'destination-out';
            layersCtx.drawImage(emptyCanvas, -centerX, -centerY, textCanvas.width, textCanvas.height);

            layersCtx.restore();
        }

        { // individual layers

            if (scale >= 4) {
                layersCtx.imageSmoothingEnabled = false;
            } else {
                layersCtx.imageSmoothingEnabled = true;
                layersCtx.imageSmoothingQuality  = scale >= 1 ? 'low' : 'medium';
            }

            // layers below
            layersCtx.save();
            layersCtx.translate(width / 2, height / 2);
            layersCtx.scale(scale, scale);
            layersCtx.rotate(p.angleRad);
            for (var i = 0; i < p.layerIndex; i++) {
                if (layerArr[i].opacity > 0) {
                    layersCtx.globalAlpha = layerArr[i].opacity;
                    layersCtx.globalCompositeOperation = layerArr[i].mixModeStr;
                    layersCtx.drawImage(layerArr[i].canvas, -centerX, -centerY);
                }
            }
            layersCtx.restore();

            // target layer
            layersCtx.globalAlpha = layerArr[p.layerIndex].opacity;
            layersCtx.globalCompositeOperation = layerArr[p.layerIndex].mixModeStr;
            layersCtx.drawImage(targetCanvas, 0, 0);

            // layers above
            layersCtx.save();
            layersCtx.translate(width / 2, height / 2);
            layersCtx.scale(scale, scale);
            layersCtx.rotate(p.angleRad);
            for (let i = p.layerIndex + 1; i < layerArr.length; i++) {
                if (layerArr[i].opacity > 0) {
                    layersCtx.globalAlpha = layerArr[i].opacity;
                    layersCtx.globalCompositeOperation = layerArr[i].mixModeStr;
                    layersCtx.drawImage(layerArr[i].canvas, -centerX, -centerY);
                }
            }
            layersCtx.restore();

        }

        layersCtx.restore();



        // --- final composite ---
        previewCtx.save();
        previewCtx.fillStyle = checkerPattern;
        previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.drawImage(layersCanvas, 0, 0);
        previewCtx.restore();

        // bounds
        previewCtx.save();
        previewCtx.globalCompositeOperation = 'difference';
        previewCtx.strokeStyle = '#fff';
        previewCtx.lineWidth = 1;
        // centerX = p.x + bounds.x + bounds.width / 2;
        // centerY = p.y + bounds.y + bounds.height / 2;
        previewCtx.strokeRect(
            Math.round(width / 2 - (bounds.width / 2) * scale),
            Math.round(height / 2 - (bounds.height / 2) * scale),
            Math.round(bounds.width * scale),
            Math.round(bounds.height * scale)
        );
        previewCtx.restore();

    }

    function move(x, y) {
        let rotated = BB.rotate(x, y, -p.angleRad / Math.PI * 180);
        p.x += rotated.x / scale;
        p.y += rotated.y / scale;
        updatePreview();
    }

    let previewPointerListener = new BB.PointerListener({
        target: previewCanvas,
        pointers: 1,
        onPointer: function(e) {
            if (e.type === 'pointermove' && e.button) {
                e.eventPreventDefault();
                move(-e.dX, -e.dY);
            }
        },
        onWheel: function(e) {
            changeZoomFac(-e.deltaY);
        }
    });

    const wheelPrevent = (event) => {
        event.preventDefault();
    }
    BB.addEventListener(previewCanvas, 'wheel', wheelPrevent);



    let row1 = BB.el({
        parent: div,
        css: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '10px'
        }
    });
    let row2n3Wrapper = BB.el({
        parent: div,
        css: isSmallWidth ? {} : {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }
    });
    let row2 = BB.el({
        parent: row2n3Wrapper,
        css: {
            display: 'flex',
            alignItems: 'center',
            marginTop: '5px'
        }
    });
    let row3 = BB.el({
        parent: row2n3Wrapper,
        css: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '5px',
            width: isSmallWidth ? '' : '300px'
        }
    });

    // --- row 1 ---

    // color
    let selectedRgbaObj = {r: 0, g: 0, b: 0, a: 1};
    let colorOptionsArr = [
        {r: 0, g: 0, b: 0, a: 1},
        {r: 255, g: 255, b: 255, a: 1}
    ];
    colorOptionsArr.unshift({
        r: p.secondaryColor.r,
        g: p.secondaryColor.g,
        b: p.secondaryColor.b,
        a: 1,
    });
    colorOptionsArr.unshift({
        r: p.color.r,
        g: p.color.g,
        b: p.color.b,
        a: 1,
    });

    let colorOptions = new ColorOptions({
        colorArr: colorOptionsArr,
        initialIndex: 0,
        onChange: function(rgbaObj) {
            p.color = rgbaObj;
            updatePreview();
        }
    });
    colorOptions.getElement().title = LANG('text-color');
    colorOptions.getElement().style.marginLeft = '-5px';
    row1.appendChild(colorOptions.getElement());


    let zoomFac = 0;
    function changeZoomFac(d) {
        zoomFac = Math.min(2, Math.max(-2, zoomFac + d));
        updatePreview();
        zoomInBtn.disabled = !canZoom(1);
        zoomOutBtn.disabled = !canZoom(-1);
    }
    function canZoom(d) {
        return zoomFac !== Math.min(2, Math.max(-2, zoomFac + d));
    }

    let zoomWrapper = BB.el({
        parent: row1,
        css: {

        }
    })

    let zoomInBtn = BB.el({
        parent: zoomWrapper,
        content: `<img height="20" src="${toolZoomInImg}">`,
        title: LANG('zoom-in'),
        tagName: 'button',
        onClick: function() {
            changeZoomFac(1);
        },
        css: {
            fontWeight: 'bold'
        }
    }) as HTMLButtonElement;
    let zoomOutBtn = BB.el({
        parent: zoomWrapper,
        content: `<img height="20" src="${toolZoomOutImg}">`,
        title: LANG('zoom-out'),
        tagName: 'button',
        onClick: function() {
            changeZoomFac(-1);
        },
        css: {
            fontWeight: 'bold',
            marginLeft: '5px'
        }
    }) as HTMLButtonElement;



    // --- row 2 ---
    let sizeInput = BB.el({
        parent: row2,
        tagName: 'input',
        title: LANG('text-size'),
        custom: {
            type: 'number',
            min: 1,
            max: 10000,
            value: p.size
        },
        css: {
            width: '60px'
        },
        onChange: function() {
            sizeInput.value = '' + Math.max(1, Math.min(10000, parseInt(sizeInput.value)));
            updatePreview();
        }
    }) as HTMLInputElement;
    let sizePointerListener = new BB.PointerListener({
        target: sizeInput,
        onWheel: function(e) {
            sizeInput.value = '' + Math.max(1, Math.min(1000, parseInt(sizeInput.value) - e.deltaY));
            updatePreview();
        }
    });

    let modeWrapper;
    let fontSelect;
    let fontPointerListener;
    {
        modeWrapper = BB.el({
            css: {
                fontSize: '15px',
                marginLeft: '10px'
            }
        });
        fontSelect = new Select({
            isFocusable: true,
            optionArr: [
                ['sans-serif', 'Sans-serif'],
                ['serif', 'Serif'],
                ['monospace', 'Monospace'],
                ['cursive', 'Cursive'],
                ['fantasy', 'Fantasy'],
            ],
            initValue: p.font,
            onChange: function(val) {
                updatePreview();
            },
        });

        modeWrapper.appendChild(fontSelect.getElement());
        row2.appendChild(modeWrapper);

        fontPointerListener = new BB.PointerListener({
            target: fontSelect.getElement(),
            onWheel: function(e) {
                fontSelect.setDeltaValue(e.deltaY);
            }
        });

    }


    // --- row 3 ---

    let alignRadioList = new ImageRadioList({
        optionArr: [
            {
                id: 'left',
                title: LANG('text-left'),
                image: alignLeftImg,
            },
            {
                id: 'center',
                title: LANG('text-center'),
                image: alignCenterImg,
            },
            {
                id: 'right',
                title: LANG('text-right'),
                image: alignRightImg,
            }
        ],
        initId: p.align,
        onChange: function(id) {
            updatePreview();
        }
    });
    row3.appendChild(alignRadioList.getElement());

    let italicToggle = new ImageToggle({
        image: typoItalicImg,
        title: LANG('text-italic'),
        initValue: p.isItalic,
        onChange: function(b) {
            updatePreview();
        }
    });
    row3.appendChild(italicToggle.getElement());

    let boldToggle = new ImageToggle({
        image: typoBoldImg,
        title: LANG('text-bold'),
        initValue: p.isBold,
        onChange: function(b) {
            updatePreview();
        }
    });
    row3.appendChild(boldToggle.getElement());



    let opacitySlider = new KlSlider({
        label: LANG('opacity'),
        width: 150,
        height: 30,
        min: 0,
        max: 1,
        initValue: p.opacity,
        resolution: 225,
        eventResMs: 1000 / 30,
        onChange: function(v) {
            updatePreview();
        },
        formatFunc: function(v) {
            return Math.round(v * 100);
        }
    });
    row3.appendChild(opacitySlider.getElement());



    let textInput = BB.el({
        parent: div,
        tagName: 'textarea',
        custom: {
            placeholder: LANG('text-placeholder'),
            'data-ignore-focus': 'true',
        },
        css: {
            whiteSpace: 'nowrap',
            overflow: 'auto',
            width: '100%',
            height: '70px',
            resize: 'vertical',
            marginTop: '10px'
        },
        onChange: function() {
            updatePreview();
        }
    }) as HTMLTextAreaElement;
    textInput.addEventListener('input', updatePreview);
    setTimeout(function() {
        textInput.focus();
        textInput.select();
    });
    let closefunc;
    let keyListener = new BB.KeyListener({
        onDown: function(keyStr, e, comboStr) {
            if (BB.isInputFocused(true)) {
                return;
            }
            if (keyStr === 'left') {
                move(-1, 0);
            }
            if (keyStr === 'right') {
                move(1, 0);
            }
            if (keyStr === 'up') {
                move(0, -1);
            }
            if (keyStr === 'down') {
                move(0, 1);
            }
        }
    });

    // prevent mobile keyboards scrolling page
    function onScroll() {
        window.scrollTo(0, 0);
    }
    window.addEventListener('scroll', onScroll);


    popup({
        target: document.body,
        message: `<b>${LANG('text-title')}</b>`,
        div: div,
        buttons: ["Ok", "Cancel"],
        style: isSmallWidth ? {} : {
            width: '500px'
        },
        callback: function(val) {
            let result = {
                x: p.x,
                y: p.y,
                textStr: textInput.value,
                align: alignRadioList.getValue(),
                isItalic: italicToggle.getValue(),
                isBold: boldToggle.getValue(),
                color: p.color,
                size: sizeInput.value,
                font: fontSelect.getValue(),
                opacity: opacitySlider.getValue()
            };

            window.removeEventListener('scroll', onScroll);
            textInput.removeEventListener('input', updatePreview);
            BB.destroyEl(textInput);
            previewPointerListener.destroy();
            sizePointerListener.destroy();
            fontPointerListener.destroy();
            BB.removeEventListener(previewCanvas, 'wheel', wheelPrevent);
            BB.destroyEl(previewWrapper);
            BB.destroyEl(zoomInBtn);
            BB.destroyEl(zoomOutBtn);
            BB.destroyEl(sizeInput);
            colorOptions.destroy();
            fontSelect.destroy();
            keyListener.destroy();
            alignRadioList.destroy();
            italicToggle.destroy();
            boldToggle.destroy();
            opacitySlider.destroy();
            if (val === 'Ok') {
                p.onConfirm(result);
            }
        },
        autoFocus: false,
        clickOnEnter: 'Ok',
        ignoreBackground: true,
        closefunc: function (func) {
            closefunc = func;
        },
    });

    updatePreview();

}