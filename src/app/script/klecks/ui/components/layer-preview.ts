import {BB} from '../../../bb/bb';
import {klHistory} from '../../history/kl-history';
import {LANG} from '../../../language/language';

/**
 * Previews currently active layer
 * thumbnail (hover shows bigger preview), layername, opacity
 *
 * internally listens to kl history. updates when there's a change.
 * but you need to update it when the active layer changed. (different canvas object)
 *
 * update visibility for performance
 *
 * p = {
 *     onClick: function() // when clicking on layer name
 *     klRootEl: klRootEl,
 * }
 *
 * @param p
 * @constructor
 */
export function LayerPreview(p) {

    // internally redraws with in an interval. checks history is something changed
    // this update will be animated
    // it will not be animated if the resolution changed
    // also redraws when you call updateLayer - not animated

    // syncs via updateLayer, and internally updates layer opacity via a hack

    let div = BB.el({});
    let layerObj;
    let isVisible = true;
    const height = 40;
    const canvasSize = height - 10;
    const largeCanvasSize = 300;
    let lastDrawnState = -2;
    let lastDrawnSize = {
        width: 0,
        height: 0
    };
    let animationCanvas = BB.canvas(); // to help animate the transition
    let animationCanvasCtx = animationCanvas.getContext('2d');
    const animationLength = 30;
    let animationCount = 0; // >0 means it's animating
    let largeCanvasIsVisible = false;
    let largeCanvasAnimationTimeout;
    const largeCanvasAnimationDurationMs = 300;
    let uiState = 'right'; // 'left' | 'right'


    // --- setup dom ---
    let contentWrapperEl = BB.el({
        css: {
            display: 'flex',
            alignItems: 'center',
            height: height + 'px',
            color: '#666',
        }
    });
    let canvasWrapperEl = BB.el({
        css: {
            //background: '#f00',
            minWidth: height + 'px',
            height: height + 'px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }
    });
    let canvas = BB.canvas(canvasSize, canvasSize);
    let canvasCtx = canvas.getContext('2d');
    canvas.title = LANG('layers-active-layer');
    BB.css(canvas, {
        boxShadow: '0 0 0 1px #9e9e9e',
        colorScheme: 'only light',
    });
    let nameWrapper = BB.el({
        css: {
            //background: '#ff0',
            flexGrow: '1',
            paddingLeft: '10px',
            fontSize: '13px',
            overflow: 'hidden',
            position: 'relative'
        }
    });
    let nameLabelEl = BB.el({
        content: '',
        css: {
            cssFloat: 'left',
            whiteSpace: 'nowrap'
        }
    });
    let nameFadeEl = BB.el({
        css: {
            backgroundImage: 'linear-gradient(to right, rgba(221,221,221,0) 0%, rgba(221,221,221,0.8) 100%)',
            position: 'absolute',
            right: "0",
            top: "0",
            width: "50px",
            height: '100%'
        }
    });
    let clickableEl = BB.el({
        css: {
            //background: 'rgba(0,255,0,0.6)',
            position: 'absolute',
            left: "10px",
            top: "0",
            width: "90px",
            height: '100%'
        }
    });
    if (p.onClick) {
        BB.addEventListener(clickableEl,'click', function() {
            p.onClick();
        });
        BB.addEventListener(canvas,'click', function() {
            p.onClick();
        });
    }
    let opacityEl = BB.el({
        content: LANG('opacity') + '<br>100%',
        css: {
            minWidth: '60px',
            fontSize: '12px',
            textAlign: 'center',
            background: '#dddddd',
            color: '#555'
        }
    });

    const largeCanvasWrapper = BB.el({
        onClick: BB.handleClick,
        css: {
            pointerEvents: 'none',
            background: '#fff',
            position: 'absolute',
            right: '280px',
            top: '10px',
            border: '1px solid #aaa',
            boxShadow: '1px 1px 3px rgba(0,0,0,0.3)',
            transition: 'opacity '+largeCanvasAnimationDurationMs+'ms ease-in-out',
            userSelect: 'none',
            display: 'block',
            webkitTouchCallout: 'none',
            colorScheme: 'only light',
        }
    });
    let largeCanvas = BB.canvas(largeCanvasSize, largeCanvasSize);
    largeCanvasWrapper.append(largeCanvas);
    let largeCanvasCtx = largeCanvas.getContext('2d');
    BB.css(largeCanvas, {
        display: 'block',
    });

    div.appendChild(contentWrapperEl);
    contentWrapperEl.appendChild(canvasWrapperEl);
    canvasWrapperEl.appendChild(canvas);
    contentWrapperEl.appendChild(nameWrapper);
    nameWrapper.appendChild(nameLabelEl);
    nameWrapper.appendChild(nameFadeEl);
    nameWrapper.appendChild(clickableEl);
    contentWrapperEl.appendChild(opacityEl);


    let animationCanvasCheckerPattern = animationCanvasCtx.createPattern(BB.createCheckerCanvas(4), 'repeat');
    let largeCanvasCheckerPattern = canvasCtx.createPattern(BB.createCheckerCanvas(4), 'repeat');



    // --- update logic ---

    function animate() {
        if (animationCount === 0) {
            return;
        }

        animationCount--;

        canvasCtx.save();
        canvasCtx.globalAlpha = Math.pow((animationLength - animationCount) / animationLength, 2);
        canvasCtx.drawImage(animationCanvas, 0, 0);
        canvasCtx.restore();

        if (animationCount > 0) {
            requestAnimationFrame(animate);
        }
    }

    function draw(isInstant) {

        if (!isVisible) {
            return;
        }

        nameLabelEl.textContent = layerObj.name;
        opacityEl.innerHTML = LANG('opacity') + '<br>' + Math.round(layerObj.opacity * 100) + '%';

        let layerCanvas = layerObj.context.canvas;

        if (layerCanvas.width !== lastDrawnSize.width || layerCanvas.height !== lastDrawnSize.height) {
            let canvasDimensions = BB.fitInto(layerCanvas.width, layerCanvas.height, canvasSize, canvasSize, 1);
            canvas.width = Math.round(canvasDimensions.width);
            canvas.height = Math.round(canvasDimensions.height);

            isInstant = true;
        }

        animationCanvas.width = canvas.width;
        animationCanvas.height = canvas.height;

        animationCanvasCtx.save();
        animationCanvasCtx.imageSmoothingEnabled = false;
        animationCanvasCtx.fillStyle = animationCanvasCheckerPattern;
        animationCanvasCtx.fillRect(0, 0, animationCanvas.width, animationCanvas.height);
        animationCanvasCtx.drawImage(layerCanvas, 0, 0, animationCanvas.width, animationCanvas.height);
        animationCanvasCtx.restore();

        if (isInstant) {
            animationCount = 0;
            canvasCtx.save();
            canvasCtx.drawImage(animationCanvas, 0, 0);
            canvasCtx.restore();

        } else {
            animationCount = animationLength;
            animate();

        }

        drawLargeCanvas();

        lastDrawnState = klHistory.getState();
        lastDrawnSize.width = layerCanvas.width;
        lastDrawnSize.height = layerCanvas.height;
    }

    function update() {
        draw(true);
    }

    setInterval(function() {

        if (!layerObj) {
            return;
        }

        let currentState = klHistory.getState();
        if (currentState === lastDrawnState) {
            return;
        }

        //update opacity w hack
        layerObj.opacity = layerObj.context.canvas.opacity;

        draw(false);

    }, 2000);


    //is always instant
    function drawLargeCanvas() {

        if (!largeCanvasIsVisible || !layerObj) {
            return;
        }

        let layerCanvas = layerObj.context.canvas;

        let canvasDimensions = BB.fitInto(layerCanvas.width, layerCanvas.height, largeCanvasSize, largeCanvasSize, 1);
        largeCanvas.width = Math.round(canvasDimensions.width);
        largeCanvas.height = Math.round(canvasDimensions.height);
        largeCanvasCtx.save();
        if (largeCanvas.width > layerCanvas.width) {
            largeCanvasCtx.imageSmoothingEnabled = false;
        } else {
            largeCanvasCtx.imageSmoothingEnabled = true;
            largeCanvasCtx.imageSmoothingQuality = 'high';
        }
        largeCanvasCtx.fillStyle = largeCanvasCheckerPattern;
        largeCanvasCtx.fillRect(0, 0, largeCanvas.width, largeCanvas.height);
        largeCanvasCtx.drawImage(layerCanvas, 0, 0, largeCanvas.width, largeCanvas.height);
        largeCanvasCtx.restore();

        const bounds = div.getBoundingClientRect();
        BB.css(largeCanvasWrapper, {
            top: Math.max(10, (bounds.top + height / 2 - largeCanvas.height / 2)) + "px"
        });

    }

    function removeLargeCanvas() {
        try {
            p.klRootEl.removeChild(largeCanvasWrapper);
        } catch(e) {

        }
    }

    function showLargeCanvas(b) {
        if (largeCanvasIsVisible === b) {
            return;
        }

        clearTimeout(largeCanvasAnimationTimeout);
        largeCanvasIsVisible = b;

        if (b) {
            largeCanvasAnimationTimeout = setTimeout(function() {
                drawLargeCanvas();
                largeCanvasWrapper.style.opacity = '0';
                p.klRootEl.appendChild(largeCanvasWrapper);
                setTimeout(function() {
                    largeCanvasWrapper.style.opacity = '1';
                }, 20);
            }, 250);

        } else {
            largeCanvasWrapper.style.opacity = '0';
            largeCanvasAnimationTimeout = setTimeout(removeLargeCanvas, largeCanvasAnimationDurationMs + 20);
        }

    }

    let pointerListener = new BB.PointerListener({
        target: canvas,
        onEnterLeave: function(b) {
            showLargeCanvas(b);
        }
    });



    // --- interface ---

    this.getElement = function() {
        return div;
    };

    this.setIsVisible = function(b) {
        if (isVisible === b) {
            return;
        }
        isVisible = b;
        contentWrapperEl.style.display = isVisible ? 'flex' : 'none';
        div.style.marginBottom = isVisible ? '' : '10px';

        let currentState = klHistory.getState();
        if (b && lastDrawnState !== currentState) {
            update();
        }
    };

    //when the layer might have changed
    this.setLayer = function(klCanvasLayerObj) {
        layerObj = klCanvasLayerObj;
        update();
    };

    this.setUiState = function(stateStr) {
        uiState = '' + stateStr;

        if (uiState === 'left') {
            BB.css(largeCanvasWrapper, {
                left: '280px',
                right: ''
            });
        } else {
            BB.css(largeCanvasWrapper, {
                left: '',
                right: '280px'
            });
        }
    };

}