import {BB} from '../../../bb/bb';

/**
 * element that lets you crop an image and copy it via right click
 *
 * param = {
 *     width: number,
 *     height: number,
 *     canvas: image | canvas,
 *     isNotCopy: boolean,
 *     onChange: function(width, height)
 * }
 *
 * @param param object
 * @constructor
 */
export function CropCopy(param) {
    let div = document.createElement('div');
    BB.css(div, {
        position: 'relative',
        height: param.height + 'px',
        width: param.width + 'px',
        overflow: 'hidden'
    });
    div.style.position = 'relative';

    let crop;
    function resetCrop() {
        crop = {
            x: 0,
            y: 0,
            width: param.canvas.width,
            height: param.canvas.height
        };
    }
    resetCrop();


    function updateCroppedCanvas() {
        croppedCanvas.width = Math.round(crop.width);
        croppedCanvas.height = Math.round(crop.height);
        let ctx = croppedCanvas.getContext('2d');
        ctx.drawImage(param.canvas, Math.round(-crop.x), Math.round(-crop.y));
        if(croppedImage) {
            croppedImage.src = croppedCanvas.toDataURL('image/png');
        }

        if (param.onChange) {
            param.onChange(croppedCanvas.width, croppedCanvas.height);
        }
    }
    function updateSelectionRect() {
        BB.css(selectionRect, {
            left: Math.round(thumbX + crop.x * scaleW) + 'px',
            top: Math.round(thumbY + crop.y * scaleH) + 'px',
            width: Math.round(crop.width * scaleW) + 'px',
            height: Math.round(crop.height * scaleH) + 'px'
        });
        if (param.onChange) {
            param.onChange(parseInt(crop.width), parseInt(crop.height));
        }
    }
    function isInsideSelectionRect(p) {
        let rect = {
            x: Math.round(thumbX + crop.x * scaleW),
            y: Math.round(thumbY + crop.y * scaleH),
            width: Math.round(crop.width * scaleW),
            height: Math.round(crop.height * scaleH)
        };
        return rect.x <= p.x && p.x <= rect.x + rect.width &&
            rect.y <= p.y && p.y <= rect.y + rect.height;
    }

    let croppedCanvas = BB.canvas();
    let eventTarget = croppedCanvas;
    let croppedImage = null;
    if(!param.isNotCopy) { //navigator.appName === 'Microsoft Internet Explorer') { //i would prefer not using an image
        croppedImage = new Image();
        eventTarget = croppedImage;
    }
    BB.css(eventTarget, {
        height: param.height + 'px',
        width: param.width + 'px'
    });
    div.appendChild(eventTarget);
    updateCroppedCanvas();

    let padding = 20;
    let previewWrapper = BB.el({
        css: {
            width: param.width + 'px',
            height: param.height + 'px',
            position: 'absolute',
            left: '0',
            top: '0',
            pointerEvents: 'none'
        }
    });
    div.appendChild(previewWrapper);
    BB.createCheckerDataUrl(4, function(v) {
        previewWrapper.style.backgroundImage = 'url('+v+')';
    });

    let thumbCanvas = BB.canvas();
    let thumbSize = BB.fitInto(param.width - padding * 2, param.height - padding * 2, param.canvas.width, param.canvas.height, 1);
    thumbCanvas.width = parseInt('' + thumbSize.width);
    thumbCanvas.height = parseInt('' + thumbSize.height);
    thumbCanvas.style.imageRendering = 'pixelated';
    let scaleW = thumbCanvas.width / param.canvas.width;
    let scaleH = thumbCanvas.height / param.canvas.height;
    let thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.imageSmoothingEnabled = false;
    thumbCtx.drawImage(param.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    previewWrapper.appendChild(thumbCanvas);
    let thumbX = parseInt('' + ((param.width - thumbCanvas.width) / 2));
    let thumbY = parseInt('' + ((param.height - thumbCanvas.height) / 2));
    BB.css(thumbCanvas, {
        position: 'absolute',
        left: thumbX + "px",
        top: thumbY + "px"
    });

    let selectionRect = BB.el({
        css: {
            position: 'absolute',
            boxShadow: '0 0 0 1px #fff, 0 0 0 2px #000, 0 0 40px 1px #000'
        }
    });
    previewWrapper.appendChild(selectionRect);
    updateSelectionRect();


    function toFullSpace(p) {
        return {
            x: BB.clamp(parseInt('' + ((p.x - thumbX) / scaleW)), 0, param.canvas.width),
            y: BB.clamp(parseInt('' + ((p.y - thumbY) / scaleH)), 0, param.canvas.height)
        };
    }
    //gen crop from thumb-space points
    function genCrop(p1, p2) {
        let topLeftP = {
            x: Math.min(p1.x, p2.x),
            y: Math.min(p1.y, p2.y)
        };
        let bottomRightP = {
            x: Math.max(p1.x, p2.x),
            y: Math.max(p1.y, p2.y)
        };
        let FullTopLeftP = toFullSpace(topLeftP);
        let FullBottomRightP = toFullSpace(bottomRightP);
        return {
            x: FullTopLeftP.x,
            y: FullTopLeftP.y,
            width: FullBottomRightP.x - FullTopLeftP.x,
            height: FullBottomRightP.y - FullTopLeftP.y
        }
    }

    function isReset() {
        return crop.x === 0 && crop.y === 0 && crop.width === param.canvas.width && crop.height === param.canvas.height;
    }

    let startP;
    let startCrop = null;
    let isDragging = false;
    let didMove = false;
    let updateCropTimeout;
    let pointerListener = new BB.PointerListener({
        target: eventTarget,
        fixScribble: true,
        onPointer: function(event) {
            let fullPos;
            if (event.type === 'pointerdown' && event.button === 'left') {
                event.eventPreventDefault();
                isDragging = true;
                startP = {
                    x: event.relX,
                    y: event.relY
                };
                if(!isReset() && isInsideSelectionRect(startP)) {
                    startCrop = {
                        x: crop.x,
                        y: crop.y,
                        width: crop.width,
                        height: crop.height
                    };
                } else {
                    crop = genCrop(startP, startP);
                }
            } else if (event.type === 'pointermove' && event.button === 'left') {
                event.eventPreventDefault();
                didMove = true;
                if(startCrop) {
                    crop.x = startCrop.x + (event.relX - startP.x) / scaleW;
                    crop.y = startCrop.y + (event.relY - startP.y) / scaleH;
                    crop.x = BB.clamp(crop.x, 0, param.canvas.width - crop.width);
                    crop.y = BB.clamp(crop.y, 0, param.canvas.height - crop.height);
                } else {
                    crop = genCrop(startP, {x: event.relX, y: event.relY});
                }
                updateSelectionRect();
            } else if (event.type === 'pointerup' && startP) {
                event.eventPreventDefault();
                isDragging = false;
                startCrop = null;
                startP = null;
                if(crop.width === 0 || crop.height === 0 || !didMove) {
                    resetCrop();
                    updateSelectionRect();
                }
                didMove = false;
                updateCropTimeout = setTimeout(updateCroppedCanvas, 1);
            }
        }
    });

    let keyListener = new BB.KeyListener({
        onDown: function(keyStr, e, comboStr) {
            if(isDragging) {
                return;
            }
            let doUpdate = false;

            let stepSize = Math.max(1, 1 / scaleW);
            let shiftIsPressed = keyListener.isPressed('shift');

            if(keyStr === 'left') {
                if(shiftIsPressed) {
                    crop.width = BB.clamp(crop.width - stepSize, 1, param.canvas.width - crop.x);
                } else {
                    crop.x = BB.clamp(crop.x - stepSize, 0, param.canvas.width - crop.width);
                }
                doUpdate = true;
            }
            if(keyStr === 'right') {
                if(shiftIsPressed) {
                    crop.width = BB.clamp(crop.width + stepSize, 1, param.canvas.width - crop.x);
                } else {
                    crop.x = BB.clamp(crop.x + stepSize, 0, param.canvas.width - crop.width);
                }
                doUpdate = true;
            }
            if(keyStr === 'up') {
                if(shiftIsPressed) {
                    crop.height = BB.clamp(crop.height - stepSize, 1, param.canvas.height - crop.y);
                } else {
                    crop.y = BB.clamp(crop.y - stepSize, 0, param.canvas.height - crop.height);
                }
                doUpdate = true;
            }
            if(keyStr === 'down') {
                if(shiftIsPressed) {
                    crop.height = BB.clamp(crop.height + stepSize, 1, param.canvas.height - crop.y);
                } else {
                    crop.y = BB.clamp(crop.y + stepSize, 0, param.canvas.height - crop.height);
                }
                doUpdate = true;
            }

            if(doUpdate) {
                e.preventDefault();
                updateSelectionRect();
                clearTimeout(updateCropTimeout);
                updateCropTimeout = setTimeout(updateCroppedCanvas, 100);
            }
        }
    });

    this.getEl = function() {
        return div;
    };
    this.reset = function() {
        resetCrop();
        updateCroppedCanvas();
        updateSelectionRect();
    };
    this.destroy = function() {
        eventTarget.style.removeProperty('width');
        eventTarget.style.removeProperty('height');
        keyListener.destroy();
        pointerListener.destroy();
    };
    this.isReset = function() {
        return isReset();
    };
    this.getRect = function() {
        return JSON.parse(JSON.stringify(crop));
    };
    this.getCroppedImage = function() {
        return croppedCanvas;
    };
}
