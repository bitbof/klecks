import {BB} from '../../../bb/bb';
import {renderText} from '../../image-operations/render-text';
import {ColorOptions} from '../components/color-options';
import {Select} from '../components/select';
import {ImageRadioList} from '../components/image-radio-list';
import {ImageToggle} from '../components/image-toggle';
import {KlSlider} from '../components/kl-slider';
import {showModal} from './base/showModal';
import alignLeftImg from '/src/app/img/ui/align-left.svg';
import alignCenterImg from '/src/app/img/ui/align-center.svg';
import alignRightImg from '/src/app/img/ui/align-right.svg';
import typoItalicImg from '/src/app/img/ui/typo-italic.svg';
import typoBoldImg from '/src/app/img/ui/typo-bold.svg';
import toolZoomInImg from '/src/app/img/ui/tool-zoom-in.svg';
import toolZoomOutImg from '/src/app/img/ui/tool-zoom-out.svg';
import {IRGB} from '../../kl-types';
import {KlCanvas} from '../../canvas/kl-canvas';
import {LANG} from '../../../language/language';
import { throwIfNull} from '../../../bb/base/base';
import {theme} from '../../../theme/theme';


type TTextFormat = 'left' | 'center' | 'right';
type TTextFont = 'serif' | 'monospace' | 'sans-serif' | 'cursive' | 'fantasy';

export type TTextToolResult = {
    x: number;
    y: number;
    textStr: string;
    align: TTextFormat;
    isItalic: boolean;
    isBold: boolean;
    color: IRGB;
    size: number; // px
    font: TTextFont;
    opacity: number;
};

/**
 * Text Tool dialog
 */
export function textToolDialog (
    p: {
        klCanvas: KlCanvas;
        layerIndex: number;
        x: number;
        y: number;
        angleRad: number;
        color: IRGB;
        secondaryColor: IRGB;
        size: number; // px
        align: TTextFormat; // default 'left'
        isBold: boolean; // default false
        isItalic: boolean; // default false
        font: TTextFont; // default sans-serif
        opacity: number; // [0, 1] default 1
        onConfirm: (confirmP: TTextToolResult) => void;
    }
): void {

    const div = BB.el();

    const isSmallWidth = window.innerWidth < 550;
    const isSmallHeight = window.innerHeight < 630;

    // --- preview ---
    // Text drawn on klCanvas-sized canvas: textCanvas
    // LayerArr[target].canvas & textCanvas then drawn on targetCanvas
    //      they are transformed. canvas size of final preview
    // All layers and targetCanvas drawn on layersCanvas. transformed and size of final preview
    // Checkerboard, layersCanvas, and outline then drawn on previewCanvas

    const width = isSmallWidth ? 340 : 540;
    const height = isSmallWidth ? (isSmallHeight ? 210 : 260) : (isSmallHeight ? 230 : 350);
    let scale = 1;

    const layerArr = p.klCanvas.getLayersFast();
    const textCanvas = BB.canvas(p.klCanvas.getWidth(), p.klCanvas.getHeight());
    const textCtx = BB.ctx(textCanvas);
    const targetCanvas = BB.canvas(width, height);
    const targetCtx = BB.ctx(targetCanvas);
    const layersCanvas = BB.canvas(width, height);
    const layersCtx = BB.ctx(layersCanvas);
    const previewCanvas = BB.canvas(width, height); // the one that is visible
    const previewCtx = BB.ctx(previewCanvas);
    BB.css(previewCanvas, {
        display: 'block',
    });
    const previewWrapper = BB.el({
        parent: div,
        css: {
            position: 'relative',
            width: width + 'px',
            marginLeft: '-20px',
            cursor: 'move',
            touchAction: 'none',
        },
        onClick: () => textInput.focus(),
    });
    BB.el({ // inset shadow on preview
        parent: previewWrapper,
        className: 'kl-text-preview-wrapper',
    });
    previewWrapper.append(previewCanvas);
    let checkerPattern = throwIfNull(previewCtx.createPattern(BB.createCheckerCanvas(8, theme.isDark()), 'repeat'));
    const emptyCanvas = BB.canvas(1, 1);
    const emptyCanvasLight = BB.canvas(1, 1);
    {
        let ctx = BB.ctx(emptyCanvas);
        ctx.fillRect(0, 0, 1, 1);

        ctx = BB.ctx(emptyCanvasLight);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1, 1);
    }

    function updateCheckerboard (): void {
        checkerPattern = throwIfNull(previewCtx.createPattern(BB.createCheckerCanvas(8, theme.isDark()), 'repeat'));
        updatePreview();
    }
    theme.addIsDarkListener(updateCheckerboard);

    function updatePreview (): void {

        // try to draw very much like klCanvasWorkspace

        // --- draw text ---
        textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
        const colorRGBA = {
            ...p.color,
            a: opacitySlider.getValue(),
        };
        const bounds = renderText(textCanvas, {
            x: p.x,
            y: p.y,
            textStr: textInput.value,
            align: alignRadioList.getValue(),
            isItalic: italicToggle.getValue(),
            isBold: boldToggle.getValue(),
            size: parseFloat(sizeInput.value),
            font: fontSelect.getValue(),
            color: BB.ColorConverter.toRgbaStr(colorRGBA),
            angleRad: p.angleRad,
        });


        // --- determine transformation of viewport ---
        // text should always be visible
        bounds.width = Math.max(bounds.width, 1);
        bounds.height = Math.max(bounds.height, 1);
        const rotatedXY = BB.rotate(bounds.x, bounds.y, -p.angleRad / Math.PI * 180);
        const rotatedWH = BB.rotate(bounds.width, bounds.height, -p.angleRad / Math.PI * 180);
        const centerX = p.x + rotatedXY.x + rotatedWH.x / 2;
        const centerY = p.y + rotatedXY.y + rotatedWH.y / 2;

        const padding = 100;
        const fitBounds = BB.fitInto(bounds.width, bounds.height, width - padding, height - padding);
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

        const isDark = theme.isDark();

        // --- layers ---
        layersCtx.save();

        layersCtx.fillStyle = isDark ? 'rgb(33,33,33)' : 'rgb(158,158,158)';
        layersCtx.fillRect(0, 0, width, height);

        { // bg
            layersCtx.save();

            layersCtx.translate(width / 2, height / 2);
            layersCtx.scale(scale, scale);
            layersCtx.rotate(p.angleRad);

            layersCtx.imageSmoothingEnabled = false;

            //outline
            const borderSize = 1 / scale;
            layersCtx.globalAlpha = isDark ? 0.25 : 0.2;
            layersCtx.drawImage(isDark ? emptyCanvasLight : emptyCanvas, -centerX - borderSize, -centerY - borderSize, textCanvas.width + borderSize * 2, textCanvas.height + borderSize * 2);
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
            for (let i = 0; i < p.layerIndex; i++) {
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

    theme.addIsDarkListener(updatePreview);

    /**
     * Move text by x y
     */
    function move (x: number, y: number): void {
        const rotated = BB.rotate(x, y, -p.angleRad / Math.PI * 180);
        p.x += rotated.x / scale;
        p.y += rotated.y / scale;
        updatePreview();
    }

    const previewPointerListener = new BB.PointerListener({
        target: previewCanvas,
        onPointer: (e) => {
            if (e.type === 'pointermove' && e.button) {
                e.eventPreventDefault();
                move(-e.dX, -e.dY);
            }
        },
        onWheel: (e) => {
            changeZoomFac(-e.deltaY);
        },
    });

    const wheelPrevent = (event: WheelEvent): void => event.preventDefault();
    previewCanvas.addEventListener('wheel', wheelPrevent);



    const row1 = BB.el({
        parent: div,
        css: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '10px',
        },
    });
    const row2n3Wrapper = BB.el({
        parent: div,
        css: isSmallWidth ? {} : {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
    });
    const row2 = BB.el({
        parent: row2n3Wrapper,
        css: {
            display: 'flex',
            alignItems: 'center',
            marginTop: '5px',
        },
    });
    const row3 = BB.el({
        parent: row2n3Wrapper,
        css: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '5px',
            width: isSmallWidth ? '' : '300px',
        },
    });

    // --- row 1 ---

    // color
    const colorOptionsArr = [
        {r: 0, g: 0, b: 0, a: 1},
        {r: 255, g: 255, b: 255, a: 1},
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

    const colorOptions = new ColorOptions({
        colorArr: colorOptionsArr,
        initialIndex: 0,
        onChange: (rgbaObj) => {
            p.color = rgbaObj!;
            updatePreview();
        },
    });
    colorOptions.getElement().title = LANG('text-color');
    colorOptions.getElement().style.marginLeft = '-5px';
    row1.append(colorOptions.getElement());


    let zoomFac = 0;

    function changeZoomFac (d: number): void {
        zoomFac = Math.min(2, Math.max(-2, zoomFac + d));
        updatePreview();
        zoomInBtn.disabled = !canZoom(1);
        zoomOutBtn.disabled = !canZoom(-1);
    }

    function canZoom (d: number): boolean {
        return zoomFac !== Math.min(2, Math.max(-2, zoomFac + d));
    }

    const zoomWrapper = BB.el({
        parent: row1,
    });

    const zoomInBtn = BB.el({
        parent: zoomWrapper,
        content: `<img height="20" src="${toolZoomInImg}">`,
        title: LANG('zoom-in'),
        tagName: 'button',
        onClick: () => changeZoomFac(1),
        css: {
            fontWeight: 'bold',
        },
    }) as HTMLButtonElement;
    const zoomOutBtn = BB.el({
        parent: zoomWrapper,
        content: `<img height="20" src="${toolZoomOutImg}">`,
        title: LANG('zoom-out'),
        tagName: 'button',
        onClick: () => changeZoomFac(-1),
        css: {
            fontWeight: 'bold',
            marginLeft: '5px',
        },
    }) as HTMLButtonElement;



    // --- row 2 ---
    const sizeInput = BB.el({
        parent: row2,
        tagName: 'input',
        title: LANG('text-size'),
        custom: {
            type: 'number',
            min: '1',
            max: '10000',
            value: '' + p.size,
        },
        css: {
            width: '60px',
        },
        onChange: () => {
            sizeInput.value = '' + Math.max(1, Math.min(10000, parseInt(sizeInput.value)));
            updatePreview();
        },
    }) as HTMLInputElement;
    const sizePointerListener = new BB.PointerListener({
        target: sizeInput,
        onWheel: (e) => {
            sizeInput.value = '' + Math.max(1, Math.min(1000, parseInt(sizeInput.value) - e.deltaY));
            updatePreview();
        },
    });


    const modeWrapper = BB.el({
        css: {
            fontSize: '15px',
            marginLeft: '10px',
        },
    });

    const fontSelect = new Select<TTextFont>({
        isFocusable: true,
        optionArr: [
            ['sans-serif', 'Sans-serif'],
            ['serif', 'Serif'],
            ['monospace', 'Monospace'],
            ['cursive', 'Cursive'],
            ['fantasy', 'Fantasy'],
        ],
        initValue: p.font,
        onChange: () => updatePreview(),
    });

    modeWrapper.append(fontSelect.getElement());
    row2.append(modeWrapper);

    const fontPointerListener = new BB.PointerListener({
        target: fontSelect.getElement(),
        onWheel: (e) => fontSelect.setDeltaValue(e.deltaY),
    });


    // --- row 3 ---

    const alignRadioList = new ImageRadioList<TTextFormat>({
        optionArr: [
            {
                id: 'left',
                title: LANG('text-left'),
                image: alignLeftImg,
                darkInvert: true,
            },
            {
                id: 'center',
                title: LANG('text-center'),
                image: alignCenterImg,
                darkInvert: true,
            },
            {
                id: 'right',
                title: LANG('text-right'),
                image: alignRightImg,
                darkInvert: true,
            },
        ],
        initId: p.align,
        onChange: () => updatePreview(),
    });
    row3.append(alignRadioList.getElement());

    const italicToggle = new ImageToggle({
        image: typoItalicImg,
        title: LANG('text-italic'),
        initValue: p.isItalic,
        onChange: () => updatePreview(),
        darkInvert: true,
    });
    row3.append(italicToggle.getElement());

    const boldToggle = new ImageToggle({
        image: typoBoldImg,
        title: LANG('text-bold'),
        initValue: p.isBold,
        onChange: () => updatePreview(),
        darkInvert: true,
    });
    row3.append(boldToggle.getElement());



    const opacitySlider = new KlSlider({
        label: LANG('opacity'),
        width: 150,
        height: 30,
        min: 1 / 100,
        max: 1,
        value: p.opacity,
        resolution: 225,
        eventResMs: 1000 / 30,
        toValue: (displayValue) => displayValue / 100,
        toDisplayValue: (value) => value * 100,
        onChange: () => updatePreview(),
    });
    row3.append(opacitySlider.getElement());



    const textInput = BB.el({
        parent: div,
        tagName: 'textarea',
        custom: {
            placeholder: LANG('text-placeholder'),
            'data-ignore-focus': 'true',
        },
        css: {
            whiteSpace: 'pre',
            overflow: 'auto',
            width: '100%',
            height: '70px',
            resize: 'vertical',
            marginTop: '10px',
        },
        onChange: () => updatePreview(),
    }) as HTMLTextAreaElement;
    textInput.addEventListener('input', updatePreview);
    setTimeout(() => {
        textInput.focus();
        textInput.select();
    });
    const keyListener = new BB.KeyListener({
        onDown: (keyStr) => {
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
        },
    });

    // prevent mobile keyboards scrolling page
    function onScroll (): void {
        window.scrollTo(0, 0);
    }
    window.addEventListener('scroll', onScroll);


    showModal({
        target: document.body,
        message: `<b>${LANG('text-title')}</b>`,
        div: div,
        buttons: ['Ok', 'Cancel'],
        style: isSmallWidth ? {} : {
            width: '500px',
        },
        callback: (val) => {
            const result: TTextToolResult = {
                x: p.x,
                y: p.y,
                textStr: textInput.value,
                align: alignRadioList.getValue(),
                isItalic: italicToggle.getValue(),
                isBold: boldToggle.getValue(),
                color: p.color,
                size: Number(sizeInput.value),
                font: fontSelect.getValue(),
                opacity: opacitySlider.getValue(),
            };

            theme.removeIsDarkListener(updatePreview);
            window.removeEventListener('scroll', onScroll);
            textInput.removeEventListener('input', updatePreview);
            BB.destroyEl(textInput);
            previewPointerListener.destroy();
            sizePointerListener.destroy();
            fontPointerListener.destroy();
            previewCanvas.removeEventListener('wheel', wheelPrevent);
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
            theme.removeIsDarkListener(updateCheckerboard);
            if (val === 'Ok') {
                p.onConfirm(result);
            }
        },
        autoFocus: false,
        clickOnEnter: 'Ok',
        ignoreBackground: true,
    });

    updatePreview();

}