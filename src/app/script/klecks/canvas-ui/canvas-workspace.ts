import {BB} from '../../bb/bb';
import {ITransform} from '../kl.types';
import {WorkspaceSvgOverlay} from './workspace-svg-overlay';
import {klHistory} from '../history/kl-history';
// @ts-ignore
import pickerImg from 'url:~/src/app/img/ui/cursor-picker.png';
// @ts-ignore
import zoomEwImg from 'url:~/src/app/img/ui/cursor-zoom-ew.png';
// @ts-ignore
import fillImg from 'url:~/src/app/img/ui/cursor-fill.png';
// @ts-ignore
import textImg from 'url:~/src/app/img/ui/cursor-text.png';

export interface IViewChangeEvent {
    changed: ('scale' | 'angle')[];
    angle: number;
    scale: number;
}

/**
 * Work area that displays the KlCanvas.
 * - pan, zoom, rotate (also via multi-touch)
 * - input modes: drawing, hand, pick, fill, text // transform, select
 * - drawing input events
 * - view change events
 * - eyedropper input events (pick)
 * - draws cursor, eyedropper overlay
 *
 * subscribes to klCanvas changes
 * listens to kl history for changes
 * and you can manually trigger redraw
 *
 * p: {
 *      klCanvas: klCanvas,
 *      width: number,
 *      height: number,
 *      onDraw: func(val),
 *      onPick: func(rgb, isPointerup),
 *      onFill: func(canvasX, canvasY),
 *      onText: func(canvasX, canvasY, angleRad),
 *      onShape: func('down'|'up', canvasX, canvasY, angleRad),
 *      onViewChange: func(IViewChangeEvent),
 *      onUndo: func(),
 *      onRedo: func(),
 *      mode: 'draw' | 'pick' | 'hand' | 'fill' | 'text' // | 'transform' | 'select'
 * }
 *
 * @param p
 * @constructor
 */
export function KlCanvasWorkspace(p: {
    klCanvas: any; // todo
    width: number;
    height: number;
    onDraw: (val) => any; // todo
    onPick: (rgb, isPointerup) => any; // todo
    onFill: (canvasX, canvasY) => any; // todo
    onText: (canvasX, canvasY, angleRad) => any; // todo
    onShape: (type: 'down' | 'up' | 'move', canvasX, canvasY, angleRad) => any; // todo
    onViewChange: (e:  IViewChangeEvent) => void;
    onUndo: () => void;
    onRedo: () => void;
}) {

    let _this = this;
    let div = document.createElement('div');
    let klCanvas = p.klCanvas;
    let renderTargetCanvas = BB.canvas(p.width, p.height);
    let renderTargetCtx = renderTargetCanvas.getContext('2d');
    let renderWidth = p.width;
    let renderHeight = p.height;
    let compositeCanvas = BB.canvas(1, 1); // for drawing klcanvas layer composite
    let compositeCtx = compositeCanvas.getContext('2d');
    let doResizeCanvas = false;
    let oldTransformObj = null;
    let targetTransformObj: ITransform = { // animation target
        x: 0,
        y: 0,
        scale: 1,
        angle: 0 // rad
    };
    let highResTransformObj: ITransform = { // animated, internal high res
        x: 0,
        y: 0,
        scale: 1,
        angle: 0 // rad
    };
    let renderedTransformObj: ITransform = {
        x: null,
        y: null,
        scale: null,
        angle: null
    }; // same as animated, but rounded - what's actually displayed
    let cursorPos = {
        x: 0,
        y: 0
    };
    let usesCssCursor = false;
    let bgVisible = true;
    let transformIsDirty = true;
    let doAnimateTranslate = true;

    //rounded x & y so canvas is less blurry.
    function getRenderedTransform() {
        let result = renderedTransformObj;
        result.x = highResTransformObj.x;
        result.y = highResTransformObj.y;
        result.scale = highResTransformObj.scale;
        result.angle = highResTransformObj.angle;

        if(result.angle % (Math.PI / 2) === 0 && result.scale % 1 === 0) {
            result.x = Math.round(result.x);
            result.y = Math.round(result.y);
        }

        return result;
    }

    let svgOverlay = new WorkspaceSvgOverlay({
        width: p.width,
        height: p.height
    });

    BB.css(renderTargetCanvas, {
        userSelect: 'none',
        pointerEvents: 'none' //,
        //imageRendering: 'pixelated'
    });
    BB.createCheckerDataUrl(8, function(url) {
        renderTargetCanvas.style.background = "url(" + url + ")";
    });
    div.appendChild(renderTargetCanvas);
    div.appendChild(svgOverlay.getElement());
    BB.css(div, {
        position: 'absolute',
        left: '0',
        right: '0',
        top: '0',
        bottom: '0',
        cursor: 'crosshair',
        userSelect: 'none'
    });
    BB.addEventListener(div, 'touchend', function(e) {
        e.preventDefault();
        return false;
    });
    BB.addEventListener(div, 'contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    BB.addEventListener(div, 'dragstart', function(e) {
        e.preventDefault();
        return false;
    });

    let emptyCanvas = BB.canvas(1, 1);
    {
        let ctx = emptyCanvas.getContext('2d');
        ctx.fillRect(0, 0, 1, 1);
    }
    let MIN_SCALE = 1 / 16, MAX_SCALE = 64;

    let keyListener = new BB.KeyListener({
        onDown: function(keyStr, event, comboStr, isRepeat) {

            if(keyStr === 'alt') {
                event.preventDefault();
            }
            if(isRepeat) {
                return;
            }

            if(currentInputProcessor) {
                currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);

            } else {

                if ([MODE_DRAW, MODE_PICK, MODE_FILL, MODE_TEXT, MODE_SHAPE].includes(globalMode) && comboStr === 'space') {
                    currentInputProcessor = inputProcessorObj.spaceHand;
                    currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                    return;
                }

                if ([MODE_DRAW, MODE_HAND, MODE_FILL, MODE_TEXT, MODE_SHAPE].includes(globalMode) && comboStr === 'alt') {
                    currentInputProcessor = inputProcessorObj.altPicker;
                    currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                    return;
                }

                if (['r', 'shift+r'].includes(comboStr)) {
                    currentInputProcessor = inputProcessorObj.rotate;
                    currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                    return;
                }

                if ('z' === comboStr) {
                    currentInputProcessor = inputProcessorObj.zoom;
                    currentInputProcessor.onKeyDown(keyStr, event, comboStr, isRepeat);
                    return;
                }

            }

        },
        onUp: function(keyStr, event, oldComboStr) {

            if(currentInputProcessor) {
                currentInputProcessor.onKeyUp(keyStr, event, oldComboStr);
            } else {
            }

        }
    });

    function updateChangeListener() {
        klCanvas.addChangeListener(function() {
            lastRenderedState = -1;
            requestFrame();
        });
    }
    updateChangeListener();


    let MODE_DRAW = 0, MODE_HAND = 1, MODE_HAND_GRABBING = 2,
        MODE_PICK = 3, MODE_ZOOM = 4, MODE_ROTATE = 5,
        MODE_ROTATING = 6, MODE_FILL = 7, MODE_TEXT = 8, MODE_SHAPE = 9;
    let currentMode = MODE_DRAW;
    let globalMode = MODE_DRAW;

    /**
     *
     * @param modeStr 'draw' | 'hand' | 'pick' | 'fill'
     */
    function updateCursor(modeInt, doForce?) {
        if(modeInt === currentMode && !doForce) {
            return;
        }
        let oldMode = currentMode;
        currentMode = modeInt;
        lastRenderedState = -1;
        if(currentMode === MODE_DRAW) {
            div.style.cursor = 'crosshair';
        } else if (currentMode === MODE_HAND) {
            div.style.cursor = 'grab';
        } else if (currentMode === MODE_HAND_GRABBING) {
            div.style.cursor = 'grabbing';
        } else if (currentMode === MODE_PICK) {
            div.style.cursor = "url('" + pickerImg + "') 0 15, crosshair";
        } else if (currentMode === MODE_ZOOM) {
            div.style.cursor = "url('" + zoomEwImg + "') 7 7, zoom-in";
        } else if (currentMode === MODE_ROTATE) {
            div.style.cursor = "grab";
        } else if (currentMode === MODE_ROTATING) {
            div.style.cursor = "grabbing";
        } else if (currentMode === MODE_FILL) {
            div.style.cursor = "url('" + fillImg + "') 1 12, crosshair";
        } else if (currentMode === MODE_TEXT) {
            div.style.cursor = "url('" + textImg + "') 1 12, crosshair";
        } else if (currentMode === MODE_SHAPE) {
            div.style.cursor = 'crosshair';
        }

        if([MODE_DRAW, MODE_PICK, MODE_FILL, MODE_TEXT, MODE_SHAPE].includes(globalMode)) {
            let oldIsHand = [MODE_HAND, MODE_HAND_GRABBING].includes(oldMode);
            let currentIsHand = [MODE_HAND, MODE_HAND_GRABBING].includes(currentMode);
            if (!oldIsHand && currentIsHand) {
                mainDoubleTapper.setAllowedPointerTypeArr(['mouse', 'pen', 'touch']);
            }
            if (oldIsHand && !currentIsHand) {
                mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
            }
        }

        if(currentMode !== MODE_PICK) {
            svgOverlay.updateColorPreview({isVisible: false});
        }
    }

    function internalZoomByStep(stepNum, centerX, centerY) {

        let step = Math.log2(targetTransformObj.scale);

        let newStep = step / Math.abs(stepNum);
        newStep += stepNum > 0 ? 1 : -1;
        newStep = Math.round(newStep);
        newStep *= Math.abs(stepNum);
        let newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.pow(2, newStep)));

        //has zoomed?
        if (newScale === targetTransformObj.scale) {
            return false;
        }


        let effectiveFactor = newScale / targetTransformObj.scale;
        targetTransformObj.scale = newScale;

        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(centerX, centerY));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(effectiveFactor));
        //matrix = multiplyMatrices(matrix, createRotationMatrix(val.angle));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-centerX, -centerY));
        //matrix = multiplyMatrices(matrix, createTranslationMatrix(val.x - val.startX, val.y - val.startY));

        let origin = [targetTransformObj.x, targetTransformObj.y, 0, 1];
        origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);
        targetTransformObj.x = origin[0];
        targetTransformObj.y = origin[1];

        /*if(transform.scale === 1) {
            transform.x = Math.round(transform.x);
            transform.y = Math.round(transform.y);
        }*/

        transformIsDirty = true;

        return true;
    }

    /**
     * mixes two transform objects. modifies A
     * @param transformA
     * @param transformB
     * @param blendFactor 0 -> A, 1 -> B
     */
    function mixTransformObj(transformA, transformB, blendFactor) {

        if (transformA.angle === transformB.angle) {
            transformA.scale = BB.mix(transformA.scale, transformB.scale, blendFactor);
            transformA.x = BB.mix(transformA.x, transformB.x, blendFactor);
            transformA.y = BB.mix(transformA.y, transformB.y, blendFactor);
            transformA.angle = BB.mix(transformA.angle, transformB.angle, blendFactor);
            return;
        }

        let w = klCanvas.getWidth();
        let h = klCanvas.getHeight();

        // --- determine centerPosA, centerPosB ---
        let centerPosA = canvasToWorkspaceCoord({
            x: w / 2,
            y: h / 2
        }, transformA);
        let centerPosB = canvasToWorkspaceCoord({
            x: w / 2,
            y: h / 2
        }, transformB);

        // --- centerPosMixed ---
        transformA.x = BB.mix(centerPosA.x , centerPosB.x, blendFactor);
        transformA.y = BB.mix(centerPosA.y , centerPosB.y, blendFactor);

        // --- scale and angle ---
        transformA.scale = BB.mix(transformA.scale, transformB.scale, blendFactor);
        transformA.angle = BB.mix(transformA.angle, transformB.angle, blendFactor);

        // --- x and y ---
        let mixedPos = canvasToWorkspaceCoord({
            x: -w / 2,
            y: -h / 2
        }, transformA);
        transformA.x = mixedPos.x;
        transformA.y = mixedPos.y;

    }

    let renderTime = 0;
    function render() {

        if(doResizeCanvas) {
            doResizeCanvas = false;
            renderTargetCanvas.width = renderWidth;
            renderTargetCanvas.height = renderHeight;
        }

        renderContext(renderTargetCtx);
    }

    //is the gray background that surrounds canvas visible?
    function testBgVisible() {
        //bring workspace points (corners of workspace) into canvas coordinate system
        //then check if any corner point is outside of the canvas -> that means the bg is visible

        let workspacePointArr = [
            [0, 0], // top left
            [renderWidth, 0], // top right
            [renderWidth, renderHeight], // bottom right
            [0, renderHeight], // bottom left
        ];

        let art = getRenderedTransform();

        //setup transformation matrix
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(1/art.scale));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(-art.angle));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-art.x, -art.y));

        //transform points, then test if outside of canvas
        for(let i = 0; i < workspacePointArr.length; i++) {
            let coords = [workspacePointArr[i][0], workspacePointArr[i][1], 0, 1];
            coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);

            if ( !(0 <= coords[0] && coords[0] <= klCanvas.getWidth() && 0 <= coords[1] && coords[1] <= klCanvas.getHeight()) ){
                //if not inside -> bg visible
                return true;
            }
        }
        return false;
    }

    function renderContext(ctx) {

        let w = klCanvas.getWidth();
        let h = klCanvas.getHeight();

        let art = getRenderedTransform();

        if(art.scale >= 4 || (art.scale === 1 && art.angle === 0)) {
            ctx.imageSmoothingEnabled = false;
        } else {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality  = 'low'; // art.scale >= 1 ? 'low' : 'medium';
        }
        //ctx.imageSmoothingEnabled = false;
        //renderTargetCtx.globalCompositeOperation  = 'multiply';



        ctx.save();
        {
            if(bgVisible) {
                ctx.fillStyle = 'rgb(158,158,158)'; // 'rgb(185,185,185)';
                ctx.fillRect(0, 0, renderWidth, renderHeight);
            } else {
                ctx.clearRect(0, 0, renderWidth, renderHeight);
            }



            if(bgVisible) {
                ctx.save();

                ctx.translate(art.x, art.y);
                ctx.scale(art.scale, art.scale);
                ctx.rotate(art.angle);

                ctx.imageSmoothingEnabled = 'false';

                //outline
                let borderSize = 1;
                ctx.globalAlpha = 0.2;
                ctx.drawImage(emptyCanvas, -borderSize / art.scale, -borderSize / art.scale, w + borderSize * 2 / art.scale, h + borderSize * 2 / art.scale);
                ctx.globalAlpha = 1;

                //erase
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(emptyCanvas, 0, 0, w, h);

                ctx.restore();
            }

            /*let region = new Path2D();
            region.rect(80, 10, 20, 130);
            ctx.clip(region);*/

            ctx.translate(art.x, art.y);
            ctx.scale(art.scale, art.scale);
            ctx.rotate(art.angle);

            let layerArr = klCanvas.getLayersFast();
            for (let i = 0; i < layerArr.length; i++) {
                if(layerArr[i].opacity > 0) {
                    ctx.globalAlpha = layerArr[i].opacity;
                    ctx.globalCompositeOperation = layerArr[i].mixModeStr;

                    if (layerArr[i].canvas.compositeObj) {
                        if (compositeCanvas.width !== layerArr[i].canvas.width || compositeCanvas.height !== layerArr[i].canvas.height) {
                            compositeCanvas.width = layerArr[i].canvas.width;
                            compositeCanvas.height = layerArr[i].canvas.height;
                        } else {
                            compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
                        }
                        compositeCtx.drawImage(layerArr[i].canvas, 0, 0);
                        layerArr[i].canvas.compositeObj.draw(compositeCtx);
                        ctx.drawImage(compositeCanvas, 0, 0, w, h);
                    } else {
                        ctx.drawImage(layerArr[i].canvas, 0, 0, w, h);
                    }
                }
            }
            ctx.globalAlpha = 1;



        }
        ctx.restore();

        // rotation hud
        if(MODE_ROTATE === currentMode || MODE_ROTATING === currentMode) {
            svgOverlay.updateCompass({
                isVisible: true,
                angleDeg: art.angle / Math.PI * 180
            });
        } else {
            svgOverlay.updateCompass({
                isVisible: false
            });
        }

    }

    function workspaceToCanvasCoord(p) {
        let art = getRenderedTransform();
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(1/art.scale));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(-art.angle));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-art.x, -art.y));

        let coords = [p.x, p.y, 0, 1];
        coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);

        return {
            x: coords[0],
            y: coords[1],
        }
    }

    function canvasToWorkspaceCoord(p, transformObj) {
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(transformObj.x, transformObj.y));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(transformObj.angle));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(transformObj.scale));

        let coords = [p.x, p.y, 0, 1];
        coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);

        return {
            x: coords[0],
            y: coords[1],
        }
    }

    function snapAngleRad(angleRad, snapDegIncrement, maxDistDeg) {

        let angleDeg = angleRad * 180 / Math.PI;
        let modDeg = Math.abs(angleDeg % snapDegIncrement);
        let dist = Math.min(modDeg, snapDegIncrement - modDeg);

        if(dist <= maxDistDeg) {
            angleDeg = Math.round(angleDeg / snapDegIncrement) * snapDegIncrement;
        }

        return angleDeg / 180 * Math.PI;
    }

    /**
     * angle always in range [-PI, PI]
     *
     * @param angleRad
     * @returns {number} - angle in radians
     */
    function minimizeAngleRad(angleRad) {
        angleRad = angleRad % (2 * Math.PI);
        if(angleRad > Math.PI) {
            angleRad -= 2 * Math.PI;
        } else if (angleRad < -Math.PI) {
            angleRad += 2 * Math.PI;
        }
        return angleRad;
    }

    let lastDrawEvent = null;
    let linetoolProcessor = new BB.EventChain.LinetoolProcessor({
        onDraw: function(event) {
            function getMatrix() {
                let art = getRenderedTransform();
                let matrix = BB.Matrix.getIdentity();
                matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(1/art.scale));
                matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(-art.angle));
                matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-art.x, -art.y));
                return matrix;
            }

            if(event.type === 'line' && !lastDrawEvent) {
                let matrix = getMatrix();
                let coords = [event.x1, event.y1, 0, 1];
                coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
                lastDrawEvent = {
                    x: coords[0],
                    y: coords[1],
                    pressure: event.pressure1
                };
                return;
            }

            if('x' in event || 'x0' in event) {

                let matrix = getMatrix();

                if('x' in event) { //down or move
                    let coords = [event.x, event.y, 0, 1];
                    coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
                    event.x = coords[0];
                    event.y = coords[1];
                }
                if('x0' in event) { //line
                    event.x0 = lastDrawEvent.x;
                    event.y0 = lastDrawEvent.y;
                    event.pressure0 = lastDrawEvent.pressure;
                    let coords = [event.x1, event.y1, 0, 1];
                    coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
                    event.x1 = coords[0];
                    event.y1 = coords[1];

                    lastDrawEvent = {
                        x: event.x1,
                        y: event.y1,
                        pressure: event.pressure1,
                    };
                }
            }


            if(['down', 'move'].includes(event.type)) {
                lastDrawEvent = event;
            }
            p.onDraw(event);
        }
    });


    let pointer = null;
    let isDrawing = false;



    let inputProcessorObj = {
        draw: {
            onPointer: function(val) {

                requestFrame();
                updateCursor(MODE_DRAW);

                let comboStr = keyListener.getComboStr();

                let event: any = {
                    scale: highResTransformObj.scale
                };
                event.shiftIsPressed = comboStr === 'shift';
                event.pressure = val.pressure;
                event.isCoalesced = !!val.isCoalesced;

                if (val.type === 'pointerdown') {

                    isDrawing = true;
                    event.type = 'down';

                } else if(val.button) {
                    event.type = 'move';

                } else if (val.type === 'pointerup') {

                    isDrawing = false;
                    event.type = 'up';

                    linetoolProcessor.process(event);
                    resetInputProcessor();
                    return;
                } else {
                    return;
                }

                event.x = val.relX;
                event.y = val.relY;

                linetoolProcessor.process(event);
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {

            },
            onKeyUp: function(keyStr, event, oldComboStr) {

            }
        },
        fill: {
            onPointer: function(event) {

                requestFrame();
                updateCursor(MODE_FILL);

                if (event.type === 'pointerdown') {
                    let coord = workspaceToCanvasCoord({x: event.relX, y: event.relY});
                    p.onFill(Math.floor(coord.x), Math.floor(coord.y));

                } else if (event.type === 'pointerup') {
                    resetInputProcessor();
                    return;

                }

            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {

            },
            onKeyUp: function(keyStr, event, oldComboStr) {

            }
        },
        text: {
            onPointer: function(event) {

                requestFrame();
                updateCursor(MODE_TEXT);

                if (event.type === 'pointerdown') {
                    let coord = workspaceToCanvasCoord({x: event.relX, y: event.relY});
                    p.onText(Math.floor(coord.x), Math.floor(coord.y), renderedTransformObj.angle);

                } else if (event.type === 'pointerup') {
                    resetInputProcessor();
                    return;

                }

            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {

            },
            onKeyUp: function(keyStr, event, oldComboStr) {

            }
        },
        shape: {
            onPointer: function(event) {

                requestFrame();
                updateCursor(MODE_SHAPE);
                let coord = workspaceToCanvasCoord({x: event.relX, y: event.relY});

                if (event.type === 'pointerdown') {
                    isDrawing = true;
                    p.onShape('down', coord.x, coord.y, renderedTransformObj.angle);

                } else if (event.type === 'pointermove') {
                    p.onShape('move', coord.x, coord.y, renderedTransformObj.angle);

                } else if (event.type === 'pointerup') {
                    isDrawing = false;
                    p.onShape('up', coord.x, coord.y, renderedTransformObj.angle);
                    resetInputProcessor();

                }
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {

            },
            onKeyUp: function(keyStr, event, oldComboStr) {

            }
        },
        hand: {
            onPointer: function(event) {
                updateCursor(MODE_HAND);
                if(['left', 'middle'].includes(event.button)) {
                    updateCursor(MODE_HAND_GRABBING);
                    targetTransformObj.x += event.dX;
                    targetTransformObj.y += event.dY;
                    highResTransformObj = JSON.parse(JSON.stringify(targetTransformObj));
                    doAnimateTranslate = false;
                    transformIsDirty = true;
                    requestFrame(true);
                } else if (event.type === 'pointerup') {
                    resetInputProcessor();
                }
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {

            },
            onKeyUp: function(keyStr, event, oldComboStr) {

            }
        },
        spaceHand: {
            onPointer: function(event) {
                updateCursor(MODE_HAND);
                if(['left', 'middle'].includes(event.button)) {
                    updateCursor(MODE_HAND_GRABBING);
                    targetTransformObj.x += event.dX;
                    targetTransformObj.y += event.dY;
                    highResTransformObj = JSON.parse(JSON.stringify(targetTransformObj));
                    doAnimateTranslate = false;
                    transformIsDirty = true;
                    requestFrame(true);
                }
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {
                if(comboStr !== 'space') {
                    resetInputProcessor();
                } else {
                    updateCursor(MODE_HAND);
                }
            },
            onKeyUp: function(keyStr, event, oldComboStr) {
                resetInputProcessor();
            }
        },
        zoom: {
            onPointer: function(event) {
                updateCursor(MODE_ZOOM);

                if(event.button === 'left' && !event.isCoalesced && event.dX != 0) {

                    let offsetX = event.pageX - event.relX;
                    let offsetY = event.pageY - event.relY;

                    internalZoomByStep(event.dX / 200, event.downPageX - offsetX, event.downPageY - offsetY);
                    highResTransformObj = JSON.parse(JSON.stringify(targetTransformObj));
                    lastRenderedState = -1;
                    requestFrame();

                    p.onViewChange({
                        changed: ['scale'],
                        angle: targetTransformObj.angle,
                        scale: targetTransformObj.scale
                    });
                }
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {
                if(comboStr !== 'z') {
                    resetInputProcessor();
                } else {
                    updateCursor(MODE_ZOOM);
                }
            },
            onKeyUp: function(keyStr, event, oldComboStr) {
                resetInputProcessor();
            }
        },
        picker: {
            onPointer: function(event) {
                updateCursor(MODE_PICK);
                if(
                    (['left', 'right'].includes(event.button) && !event.isCoalesced) ||
                    event.type === 'pointerup'
                ) {
                    let coord = workspaceToCanvasCoord({x: event.relX, y: event.relY});
                    let pickedColor = klCanvas.getColorAt(coord.x, coord.y);
                    p.onPick(pickedColor, event.type === 'pointerup');
                    svgOverlay.updateColorPreview({
                        x: event.relX,
                        y: event.relY,
                        color: pickedColor,
                        isVisible: event.type !== 'pointerup'
                    });

                    if(event.type === 'pointerup') {
                        resetInputProcessor();
                    }
                }
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {

            },
            onKeyUp: function(keyStr, event, oldComboStr) {

            }
        },
        altPicker: {
            onPointer: function(event) {
                updateCursor(MODE_PICK);
                if(
                    (['left', 'right'].includes(event.button) && !event.isCoalesced) ||
                    event.type === 'pointerup'
                ) {
                    let coord = workspaceToCanvasCoord({x: event.relX, y: event.relY});
                    let pickedColor = klCanvas.getColorAt(coord.x, coord.y);
                    p.onPick(pickedColor, event.type === 'pointerup');
                    svgOverlay.updateColorPreview({
                        x: event.relX,
                        y: event.relY,
                        color: pickedColor,
                        isVisible: event.type !== 'pointerup'
                    });
                }
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {
                if(comboStr !== 'alt') {
                    resetInputProcessor();
                } else {
                    updateCursor(MODE_PICK);
                }
            },
            onKeyUp: function(keyStr, event, oldComboStr) {
                resetInputProcessor();
            }
        },
        rotate: {
            onPointer: function(event) {
                updateCursor(event.button === 'left' ? MODE_ROTATING : MODE_ROTATE);

                if (event.type === 'pointerdown' && event.button === 'left') {
                    oldTransformObj = JSON.parse(JSON.stringify(targetTransformObj));
                } else if (event.button === 'left' && !event.isCoalesced && oldTransformObj) {


                    let offsetX = event.pageX - event.relX;
                    let offsetY = event.pageY - event.relY;
                    //rotation done around center
                    let centerObj = {
                        x: renderWidth / 2,
                        y: renderHeight / 2
                    };

                    let startAngleRad = BB.Vec2.angle(centerObj, {x: event.downPageX - offsetX, y: event.downPageY - offsetY});
                    let angleRad = BB.Vec2.angle(centerObj, {x: event.pageX - offsetX, y: event.pageY - offsetY});
                    let dAngleRad = angleRad - startAngleRad;

                    //apply angle
                    targetTransformObj = JSON.parse(JSON.stringify(oldTransformObj));
                    targetTransformObj.angle += dAngleRad;

                    if(keyListener.isPressed('shift')) {
                        targetTransformObj.angle = Math.round(targetTransformObj.angle / Math.PI * 8) * Math.PI / 8; //snap the angle to 45/2 degs
                        dAngleRad = targetTransformObj.angle - oldTransformObj.angle;
                    }

                    targetTransformObj.angle = minimizeAngleRad(targetTransformObj.angle);

                    //rotate transform.xy
                    let matrix = BB.Matrix.getIdentity();
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(centerObj.x, centerObj.y));
                    //matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(effectiveFactor));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(dAngleRad));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-centerObj.x, -centerObj.y));
                    //matrix = multiplyMatrices(matrix, createTranslationMatrix(val.x - val.startX, val.y - val.startY));

                    let origin = [targetTransformObj.x, targetTransformObj.y, 0, 1];
                    origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);
                    targetTransformObj.x = origin[0];
                    targetTransformObj.y = origin[1];

                    highResTransformObj = JSON.parse(JSON.stringify(targetTransformObj));

                    transformIsDirty = true;
                    lastRenderedState = -1;
                    requestFrame();

                    p.onViewChange({
                        changed: ['angle'],
                        scale: targetTransformObj.scale,
                        angle: targetTransformObj.angle
                    });

                }
            },
            onKeyDown: function(keyStr, event, comboStr, isRepeat) {
                if(['r', 'r+shift', 'shift+r', 'r+left', 'r+right', 'r+left+right', 'r+right+left', 'r+up'].includes(comboStr)) {
                    updateCursor(MODE_ROTATE);
                } else {
                    resetInputProcessor();
                }
            },
            onKeyUp: function(keyStr, event, oldComboStr) {
                let comboStr = keyListener.getComboStr();
                if(['r', 'r+shift', 'shift+r', 'r+left', 'r+right', 'r+left+right', 'r+right+left', 'r+up'].includes(comboStr)) {
                    updateCursor(MODE_ROTATE);
                } else {
                    resetInputProcessor();
                }
            }
        }
    };
    let currentInputProcessor = null;

    function resetInputProcessor() {
        currentInputProcessor = null;
        updateCursor(globalMode);
        requestFrame(true);
    }


    let angleIsExtraSticky = false;
    let pinchZoomer = new BB.EventChain.PinchZoomer({
        onPinch: function(event) {

            if (event.type === 'move') {

                if(!oldTransformObj) {
                    oldTransformObj = JSON.parse(JSON.stringify(targetTransformObj));
                    angleIsExtraSticky = targetTransformObj.angle % (Math.PI / 2) === 0;
                }

                let oldAngle = targetTransformObj.angle;
                targetTransformObj = JSON.parse(JSON.stringify(oldTransformObj));

                event.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetTransformObj.scale * event.scale)) / targetTransformObj.scale;

                targetTransformObj.scale *= event.scale;
                targetTransformObj.angle += event.angleRad;
                targetTransformObj.angle = minimizeAngleRad(
                    snapAngleRad(
                        targetTransformObj.angle,
                        90,
                        angleIsExtraSticky ? 12 : 4
                    )
                );
                if(targetTransformObj.angle % (Math.PI / 2) !== 0) {
                    angleIsExtraSticky = false;
                }
                //targetTransformObj.angle = minimizeAngleRad(snapAngleRad(targetTransformObj.angle, 90, 7));
                event.angleRad = targetTransformObj.angle - oldTransformObj.angle;

                //calc translation
                {
                    let matrix = BB.Matrix.getIdentity();
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(event.relX, event.relY));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(event.scale));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(event.angleRad));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-event.relX, -event.relY));
                    matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(event.relX - event.downRelX, event.relY - event.downRelY));


                    let origin = [targetTransformObj.x, targetTransformObj.y, 0, 1];
                    origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);

                    targetTransformObj.x = origin[0];
                    targetTransformObj.y = origin[1];

                }

                highResTransformObj = JSON.parse(JSON.stringify(targetTransformObj));

                //if(event.scale !== 1) {
                p.onViewChange({
                    changed: ['scale', 'angle'],
                    scale: targetTransformObj.scale,
                    angle: targetTransformObj.angle
                });
                //}
                requestFrame();
                transformIsDirty = true;
                lastRenderedState = -1;


            } else if (event.type === 'end') {
                oldTransformObj = null;
            }


        }
    });

    function onDoubleTap() {
        let oldTransform = JSON.parse(JSON.stringify(targetTransformObj));
        _this.fitView();
        //_this.resetView(true);
        lastRenderedState = -1;
        requestFrame();

        if(
            oldTransform.scale !== targetTransformObj.scale ||
            oldTransform.angle !== targetTransformObj.angle
        ) {
            p.onViewChange({
                changed: ['scale', 'angle'],
                angle: targetTransformObj.angle,
                scale: targetTransformObj.scale
            });
        }
    }

    let mainDoubleTapper = new BB.EventChain.DoubleTapper({
        onDoubleTap: onDoubleTap
    });
    let middleDoubleTapper = new BB.EventChain.DoubleTapper({
        onDoubleTap: onDoubleTap
    });
    middleDoubleTapper.setAllowedButtonArr(['middle']);


    let twoFingerTap = new BB.EventChain.NFingerTapper({
        fingers: 2,
        onTap: function() {
            p.onUndo();
        }
    });
    let threeFingerTap = new BB.EventChain.NFingerTapper({
        fingers: 3,
        onTap: function() {
            p.onRedo();
        }
    });


    let pointerEventChain = new BB.EventChain.EventChain({
        chainArr: [
            twoFingerTap,
            threeFingerTap,
            mainDoubleTapper,
            middleDoubleTapper,
            pinchZoomer,
            new BB.EventChain.OnePointerLimiter(),
            new BB.EventChain.CoalescedExploder()
        ]
    });
    pointerEventChain.setChainOut(function(event) {

        cursorPos.x = event.relX;
        cursorPos.y = event.relY;
        if(event.type === 'pointerup' && event.pointerType === 'touch') {
            pointer = null;
            lastRenderedState = -1;
            requestFrame();
        } else {
            if(!pointer) {
                pointer = {};
            }
            pointer.x = event.relX;
            pointer.y = event.relY;
        }

        if(currentInputProcessor) {
            currentInputProcessor.onPointer(event);

        } else {

            let comboStr = keyListener.getComboStr();

            if (globalMode === MODE_DRAW) {

                if (['', 'shift', 'ctrl'].includes(comboStr) && event.type === 'pointerdown' && event.button === 'left') {
                    currentInputProcessor = inputProcessorObj.draw;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                    currentInputProcessor = inputProcessorObj.picker;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                    currentInputProcessor = inputProcessorObj.hand;
                    currentInputProcessor.onPointer(event);
                } else {
                    updateCursor(MODE_DRAW);
                    requestFrame();
                }

            } else if (globalMode === MODE_HAND) {

                if(event.type === 'pointerdown' && ['left', 'middle'].includes(event.button)) {
                    currentInputProcessor = inputProcessorObj.hand;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                    currentInputProcessor = inputProcessorObj.picker;
                    currentInputProcessor.onPointer(event);
                } else {
                    updateCursor(MODE_HAND);
                }

            } else if (globalMode === MODE_PICK) {

                if(event.type === 'pointerdown' && ['left', 'right'].includes(event.button)) {
                    currentInputProcessor = inputProcessorObj.picker;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                    currentInputProcessor = inputProcessorObj.hand;
                    currentInputProcessor.onPointer(event);
                } else {
                    updateCursor(MODE_PICK);
                }

            } else if (globalMode === MODE_FILL) {

                if (event.type === 'pointerdown' && event.button === 'left') {
                    currentInputProcessor = inputProcessorObj.fill;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                    currentInputProcessor = inputProcessorObj.picker;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                    currentInputProcessor = inputProcessorObj.hand;
                    currentInputProcessor.onPointer(event);
                } else {
                    updateCursor(MODE_FILL);
                    requestFrame();
                }

            } else if (globalMode === MODE_TEXT) {

                if (event.type === 'pointerdown' && event.button === 'left') {
                    currentInputProcessor = inputProcessorObj.text;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                    currentInputProcessor = inputProcessorObj.picker;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                    currentInputProcessor = inputProcessorObj.hand;
                    currentInputProcessor.onPointer(event);
                } else {
                    updateCursor(MODE_TEXT);
                    requestFrame();
                }

            } else if (globalMode === MODE_SHAPE) {

                if (['', 'shift', 'ctrl'].includes(comboStr) && event.type === 'pointerdown' && event.button === 'left') {
                    currentInputProcessor = inputProcessorObj.shape;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'right') {
                    currentInputProcessor = inputProcessorObj.picker;
                    currentInputProcessor.onPointer(event);
                } else if ([''].includes(comboStr) && event.type === 'pointerdown' && event.button === 'middle') {
                    currentInputProcessor = inputProcessorObj.hand;
                    currentInputProcessor.onPointer(event);
                } else {
                    updateCursor(MODE_SHAPE);
                    requestFrame();
                }

            }


        }

    });

    //prevent ctrl scroll -> zooming page
    BB.addEventListener(div, 'wheel', function(event) {
        event.preventDefault();
    });


    let pointerListener;
    setTimeout(function() {
        pointerListener = new BB.PointerListener({
            target: div,
            fixScribble: true,
            onPointer: function(e) {
                if (e.type === 'pointerdown' && e.button === 'middle') {
                    try {
                        e.eventPreventDefault();
                    } catch (e) {}
                }
                /*if(e.type === 'pointermove') {
                    BB.throwOut(JSON.stringify(e));
                }*/

                pointerEventChain.chainIn(e)
            },
            onWheel: function(wheelEvent) {

                if (isDrawing) {
                    return;
                }

                requestFrame();
                let didZoom = internalZoomByStep(-wheelEvent.deltaY / (keyListener.isPressed('shift') ? 8 : 2), wheelEvent.relX, wheelEvent.relY);
                if(didZoom) {
                    p.onViewChange({
                        changed: ['scale'],
                        angle: targetTransformObj.angle,
                        scale: targetTransformObj.scale
                    });
                }

                //updateCursor(MODE_DRAW, true);
                lastRenderedState = -1;


            },
            onEnterLeave: function(isOver) {
                if(!isOver) {
                    if(!isDrawing) {
                        pointer = null;
                        lastRenderedState = -1;
                    }
                }
            },
            maxPointers: 4
        });
    }, 1);

    let brushRadius = 1;

    let animationFrameRequested = false;
    function requestFrame(doRedrawCanvas?) {
        animationFrameRequested = true;
        if(doRedrawCanvas) {
            lastRenderedState = -1;
        }
    }



    //setup rendering
    let lastRenderedState = -2;
    let lastRenderTime = performance.now();
    let debugtime = 0;
    function updateLoop() {
        window.requestAnimationFrame(updateLoop);

        let newState = parseInt(klHistory.getState());
        let doRender = lastRenderedState < newState;

        //handle variable framerate
        let nowTime = performance.now();
        let elapsedFrames = (nowTime - lastRenderTime) * 60 / 1000; //how many frames elapsed since last render if fps were 60fps
        lastRenderTime = nowTime;

        if(animationFrameRequested || doRender) {
            animationFrameRequested = false;
            checkChange(elapsedFrames);
        }



    }
    const animationSpeed = 0.3; //0.25;
    function checkChange(elapsedFrames) {

        let newState = parseInt(klHistory.getState());
        let doRender = lastRenderedState < newState ||
            highResTransformObj.scale !== targetTransformObj.scale ||
            highResTransformObj.x !== targetTransformObj.x ||
            highResTransformObj.y !== targetTransformObj.y;

        //update transform
        if(
            !doAnimateTranslate &&
            (highResTransformObj.scale === targetTransformObj.scale || Math.abs(highResTransformObj.scale - targetTransformObj.scale) < 0.008 * targetTransformObj.scale)
        ) {
            highResTransformObj.scale = targetTransformObj.scale;
            highResTransformObj.x = targetTransformObj.x;
            highResTransformObj.y = targetTransformObj.y;
            highResTransformObj.angle = targetTransformObj.angle;
            if(transformIsDirty) {
                transformIsDirty = false;
                bgVisible = testBgVisible();
            }

            svgOverlay.updateCursor({radius: brushRadius * highResTransformObj.scale});
        } else if (
            (highResTransformObj.x === targetTransformObj.x || Math.abs(highResTransformObj.x - targetTransformObj.x) < 0.5) &&
            (highResTransformObj.y === targetTransformObj.y || Math.abs(highResTransformObj.y - targetTransformObj.y) < 0.5) &&
            (highResTransformObj.scale === targetTransformObj.scale || Math.abs(highResTransformObj.scale - targetTransformObj.scale) < 0.008 * targetTransformObj.scale)
        ) {
            highResTransformObj.scale = targetTransformObj.scale;
            highResTransformObj.x = targetTransformObj.x;
            highResTransformObj.y = targetTransformObj.y;
            highResTransformObj.angle = targetTransformObj.angle;
            doAnimateTranslate = false;
            if(transformIsDirty) {
                transformIsDirty = false;
                bgVisible = testBgVisible();
            }

            svgOverlay.updateCursor({radius: brushRadius * highResTransformObj.scale});
        } else {
            requestFrame(); //probably needs another frame
            let blendFactor = Math.min(1, animationSpeed * elapsedFrames);
            mixTransformObj(highResTransformObj, targetTransformObj, blendFactor);
            bgVisible = true; // spare yourself the calculation
            svgOverlay.updateCursor({radius: brushRadius * highResTransformObj.scale});
        }

        if(pointer && currentMode == MODE_DRAW && !usesCssCursor) {
            svgOverlay.updateCursor({
                x: pointer.x,
                y: pointer.y,
                isVisible: true
            });
        } else {
            svgOverlay.updateCursor({isVisible: false});
        }


        if(doRender) {
            //console.log('scale', renderedTransform.scale, 'x', renderedTransform.x, 'y', renderedTransform.y);
            lastRenderedState = newState;
            let start = performance.now();
            render();
            renderTime = BB.mix(renderTime, performance.now() - start, 0.05);
        }
        //setTimeout(checkChange, 100);



        if(doRender) {

            //console.log('rendertime ms: ', renderTime);
        }


    }
    window.requestAnimationFrame(updateLoop);


    // --- interface ---

    this.getElement = function() {
        return div;
    };

    this.setCanvas = function(c) {

        klCanvas = c;
        lastDrawEvent = null;
        this.resetView();

        updateChangeListener();

        lastRenderedState = -1;
        requestFrame();
    };

    this.setSize = function(width, height) {
        let oldWidth = renderWidth;
        let oldHeight = renderHeight;

        if(width === oldWidth && height === oldHeight) {
            return;
        }

        doResizeCanvas = true;
        renderWidth = width;
        renderHeight = height;

        svgOverlay.setSize(width, height);

        targetTransformObj.x += (width - oldWidth) / 2;
        targetTransformObj.y += (height - oldHeight) / 2;

        highResTransformObj.x = targetTransformObj.x;
        highResTransformObj.y = targetTransformObj.y;

        bgVisible = testBgVisible();

        lastRenderedState = -1;
        requestFrame();
    };

    this.setMode = function(modeStr) {
        //only sets the base mode
        if(modeStr === 'draw') {
            globalMode = MODE_DRAW;
            mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if(modeStr === 'fill') {
            globalMode = MODE_FILL;
            mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if(modeStr === 'text') {
            globalMode = MODE_TEXT;
            mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if(modeStr === 'shape') {
            globalMode = MODE_SHAPE;
            mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
        if(modeStr === 'hand') {
            globalMode = MODE_HAND;
            mainDoubleTapper.setAllowedPointerTypeArr(['mouse', 'pen', 'touch']);
        }
        if(modeStr === 'pick') {
            globalMode = MODE_PICK;
            mainDoubleTapper.setAllowedPointerTypeArr(['touch']);
        }
    };

    this.setEnabled = function(b) {
        //todo
    };

    let disableRadiusPreviewTimeout;
    this.setCursorSize = function(s) {
        brushRadius = s / 2;

        svgOverlay.updateCursor({radius: brushRadius * highResTransformObj.scale});

        if(pointer === null) {
            clearTimeout(disableRadiusPreviewTimeout);

            svgOverlay.updateCursor({
                x: renderWidth / 2,
                y: renderHeight / 2,
                isVisible: true
            });

            disableRadiusPreviewTimeout = setTimeout(function() {
                if(pointer !== null) {
                    return;
                }
                svgOverlay.updateCursor({isVisible: false});
            }, 500);
        }
    };

    this.zoomByStep = function(stepNum) {
        let didZoom = internalZoomByStep(stepNum, renderWidth / 2, renderHeight / 2);
        if(!didZoom) {
            return;
        }

        lastRenderedState = -1;
        requestFrame();

        p.onViewChange({
            changed: ['scale'],
            angle: targetTransformObj.angle,
            scale: targetTransformObj.scale
        });
    };

    this.resetView = function(doAnimate) {

        targetTransformObj.scale = 1;
        targetTransformObj.angle = 0;

        targetTransformObj.x = (renderWidth - klCanvas.getWidth()) / 2;
        targetTransformObj.y = (renderHeight - klCanvas.getHeight()) / 2;

        if(!doAnimate) {
            highResTransformObj = JSON.parse(JSON.stringify(targetTransformObj));
        } else {
            doAnimateTranslate = true;
            transformIsDirty = true;
        }

        bgVisible = testBgVisible();
        requestFrame();

        if (doAnimate) {
            p.onViewChange({
                changed: ['scale', 'angle'],
                scale: targetTransformObj.scale,
                angle: targetTransformObj.angle
            });
        }
    };
    this.resetView();

    this.fitView = function() {
        //fit into view. center. keep angle. margin of 10px

        //calc width and height of bounds
        let canvasPointsArr = [
            [0, 0], // top left
            [klCanvas.getWidth(), 0], // top right
            [klCanvas.getWidth(), klCanvas.getHeight()], // bottom right
            [0, klCanvas.getHeight()], // bottom left
            [klCanvas.getWidth() / 2, klCanvas.getHeight() / 2], // center
        ];

        //setup transformation matrix
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(targetTransformObj.angle));

        //rotate points
        for(let i = 0; i < canvasPointsArr.length; i++) {
            let coords = [canvasPointsArr[i][0], canvasPointsArr[i][1], 0, 1];
            coords = BB.Matrix.multiplyMatrixAndPoint(matrix, coords);
            canvasPointsArr[i][0] = coords[0];
            canvasPointsArr[i][1] = coords[1];
        }

        let boundsObj = {
            x0: null,
            y0: null,
            x1: null,
            y1: null
        };
        for(let i = 0; i < canvasPointsArr.length; i++) {
            if(boundsObj.x0 === null || canvasPointsArr[i][0] < boundsObj.x0) {
                boundsObj.x0 = canvasPointsArr[i][0];
            }
            if(boundsObj.y0 === null || canvasPointsArr[i][1] < boundsObj.y0) {
                boundsObj.y0 = canvasPointsArr[i][1];
            }
            if(boundsObj.x1 === null || canvasPointsArr[i][0] > boundsObj.x1) {
                boundsObj.x1 = canvasPointsArr[i][0];
            }
            if(boundsObj.y1 === null || canvasPointsArr[i][1] > boundsObj.y1) {
                boundsObj.y1 = canvasPointsArr[i][1];
            }
        }
        let boundsWidth = boundsObj.x1 - boundsObj.x0;
        let boundsHeight = boundsObj.y1 - boundsObj.y0;

        //fit bounds
        let padding = 40;
        let fit = BB.fitInto(renderWidth - padding, renderHeight - padding, boundsWidth, boundsHeight, 1);

        //determine scale
        let factor = fit.width / boundsWidth;

        //center
        targetTransformObj.x = (renderWidth / 2) - (canvasPointsArr[4][0] - canvasPointsArr[0][0]) * factor;
        targetTransformObj.y = (renderHeight / 2) - (canvasPointsArr[4][1] - canvasPointsArr[0][1]) * factor;

        targetTransformObj.scale = factor;
        doAnimateTranslate = true;
        transformIsDirty = true;
        requestFrame();

        p.onViewChange({
            changed: ['scale', 'angle'],
            scale: targetTransformObj.scale,
            angle: targetTransformObj.angle
        });
    };

    this.setAngle = function(angleDeg, isRelative) {
        //rotation done around center
        let centerObj = {
            x: renderWidth / 2,
            y: renderHeight / 2
        };

        let oldAngleRad = targetTransformObj.angle;
        let angleRad = angleDeg / 180 * Math.PI;

        if(isRelative) {
            targetTransformObj.angle += angleRad;
        } else {
            targetTransformObj.angle = angleRad;
        }

        targetTransformObj.angle = minimizeAngleRad(
            snapAngleRad(
                targetTransformObj.angle,
                90,
                4
            )
        );

        //rotate transform.xy
        let matrix = BB.Matrix.getIdentity();
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(centerObj.x, centerObj.y));
        //matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createScaleMatrix(effectiveFactor));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createRotationMatrix(targetTransformObj.angle - oldAngleRad));
        matrix = BB.Matrix.multiplyMatrices(matrix, BB.Matrix.createTranslationMatrix(-centerObj.x, -centerObj.y));
        //matrix = multiplyMatrices(matrix, createTranslationMatrix(val.x - val.startX, val.y - val.startY));

        let origin = [targetTransformObj.x, targetTransformObj.y, 0, 1];
        origin = BB.Matrix.multiplyMatrixAndPoint(matrix, origin);
        targetTransformObj.x = origin[0];
        targetTransformObj.y = origin[1];

        highResTransformObj = JSON.parse(JSON.stringify(targetTransformObj));
        transformIsDirty = true;
        requestFrame(true);
    };

    this.translateView = function(tx, ty) {
        let scale = 40;

        targetTransformObj.x += tx * scale;
        targetTransformObj.y += ty * scale;

        transformIsDirty = true;
        doAnimateTranslate = true;
        requestFrame(true);
    };

    this.getIsDrawing = function() {
        return isDrawing;
    };

    this.getScale = function() {
        return targetTransformObj.scale;
    };

    this.getAngleDeg = function() {
        return targetTransformObj.angle * 180 / Math.PI;
    };

    this.getMaxScale = function() {
        return MAX_SCALE;
    };

    this.getMinScale = function() {
        return MIN_SCALE;
    };

    this.requestFrame = function() {
        lastRenderedState = -1;
        requestFrame();
    };

    this.setLastDrawEvent = function(x, y, pressure) {

        if(x === null) {
            lastDrawEvent = null;
            return;
        }

        if(!lastDrawEvent) {
            lastDrawEvent = {x: 0, y: 0, pressure: 0};
        }
        lastDrawEvent.x = x;
        lastDrawEvent.y = y;
        lastDrawEvent.pressure = pressure;
    };
}