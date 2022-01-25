import {BB} from '../../bb/bb';

/**
 * Overlay for KlCanvasWorkspace.
 * - brush circle
 * - eyedropper circle
 * - compass needle (rotation hud)
 *
 * @param p - {width: number, height: number}
 * @constructor
 */
export function WorkspaceSvgOverlay(p) {

    const namespaceStr = 'http://www.w3.org/2000/svg';
    let rootElement = document.createElementNS(namespaceStr, 'svg');
    BB.css(rootElement, {
        position: 'absolute',
        left: '0',
        top: '0',
        pointerEvents: 'none',
        userSelect: 'none'
    });
    rootElement.setAttribute('width', p.width);
    rootElement.setAttribute('height', p.height);

    //brush circles
    let brushCircleOuter = document.createElementNS(namespaceStr, 'circle');
    brushCircleOuter.setAttribute('r', '10'); //temp
    brushCircleOuter.setAttribute('stroke', 'rgba(0,0,0,0.7)');
    brushCircleOuter.setAttribute('stroke-width', '1');
    brushCircleOuter.setAttribute('fill', 'none');
    //circleElement.setAttribute('shape-rendering', 'optimizeSpeed');
    let brushCircleInner = document.createElementNS(namespaceStr, 'circle');
    brushCircleInner.setAttribute('r', '9'); //temp
    brushCircleInner.setAttribute('stroke', 'rgba(255,255,255,0.7)');
    brushCircleInner.setAttribute('stroke-width', '1');
    brushCircleInner.setAttribute('fill', 'none');
    //brushCircleInner.setAttribute('shape-rendering', 'optimizeSpeed');
    rootElement.appendChild(brushCircleOuter);
    rootElement.appendChild(brushCircleInner);

    //color picker preview circle
    let pickerPreviewBorder = document.createElementNS(namespaceStr, 'circle');
    pickerPreviewBorder.setAttribute('r', '47');
    pickerPreviewBorder.setAttribute('stroke', 'black'); //temp
    pickerPreviewBorder.setAttribute('stroke-width', '22');
    pickerPreviewBorder.setAttribute('fill', 'none');
    pickerPreviewBorder.style.opacity = '0';
    let pickerPreviewCol = document.createElementNS(namespaceStr, 'circle');
    pickerPreviewCol.setAttribute('r', '47');
    pickerPreviewCol.setAttribute('stroke', 'black'); //temp
    pickerPreviewCol.setAttribute('stroke-width', '20');
    pickerPreviewCol.setAttribute('fill', 'none');
    pickerPreviewCol.style.opacity = '0';
    rootElement.appendChild(pickerPreviewBorder);
    rootElement.appendChild(pickerPreviewCol);




    //rotation compass
    let compassSize = 30;
    let compass = document.createElementNS(namespaceStr, 'g');
    let compassInner = document.createElementNS(namespaceStr, 'g');
    let compassBaseCircle = document.createElementNS(namespaceStr, 'circle');
    let compassLineCircle = document.createElementNS(namespaceStr, 'circle');
    let compassUpperTriangle = document.createElementNS(namespaceStr, 'path');
    let compassLowerTriangle = document.createElementNS(namespaceStr, 'path');

    compassInner.appendChild(compassBaseCircle);
    compassInner.appendChild(compassLineCircle);
    compassInner.appendChild(compassUpperTriangle);
    compassInner.appendChild(compassLowerTriangle);
    compass.appendChild(compassInner);
    rootElement.appendChild(compass);

    compass.style.transition = 'opacity 0.25s ease-in-out';
    compass.style.opacity = '0';

    compass.setAttribute('transform', 'translate(' + (p.width/2) + ', ' + (p.height/2) + ')');
    compassInner.setAttribute('transform', 'rotate(45)');
    compassBaseCircle.setAttribute('fill', 'rgba(0,0,0,0.9)');
    compassBaseCircle.setAttribute('stroke', 'none');
    compassLineCircle.setAttribute('fill', 'none');
    compassLineCircle.setAttribute('stroke', 'rgba(255,255,255,0.75)');
    compassLineCircle.setAttribute('stroke-width', '1');
    compassUpperTriangle.setAttribute('fill', '#f00');
    compassUpperTriangle.setAttribute('stroke', 'none');
    compassLowerTriangle.setAttribute('fill', '#fff');
    compassLowerTriangle.setAttribute('stroke', 'none');

    compassBaseCircle.setAttribute('cx', '0');
    compassBaseCircle.setAttribute('cy', '0');
    compassBaseCircle.setAttribute('r', '' + compassSize);
    compassLineCircle.setAttribute('cx', '0');
    compassLineCircle.setAttribute('cy', '0');
    compassLineCircle.setAttribute('r', '' + (compassSize * 0.9));
    compassUpperTriangle.setAttribute('d', 'M -'+(compassSize * 0.25)+',0 '+(compassSize * 0.25)+',0 0,-'+(compassSize * 0.9)+' z');
    compassLowerTriangle.setAttribute('d', 'M -'+(compassSize * 0.25)+',0 '+(compassSize * 0.25)+',0 0,'+(compassSize * 0.9)+' z');




    // --- interface ---
    this.getElement = function() {
        return rootElement;
    }
    this.setSize = function(width, height) {
        rootElement.setAttribute('width', width);
        rootElement.setAttribute('height', height);
        compass.setAttribute('transform', 'translate(' + (width/2) + ', ' + (height/2) + ')');
    };
    this.updateCursor = function(p) {

        if('x' in p) {
            brushCircleOuter.setAttribute('cx', p.x);
            brushCircleInner.setAttribute('cx', p.x);
        }
        if('y' in p) {
            brushCircleOuter.setAttribute('cy', p.y);
            brushCircleInner.setAttribute('cy', p.y);
        }
        if('radius' in p) {
            brushCircleOuter.setAttribute('r', '' + Math.max(0, p.radius));
            brushCircleInner.setAttribute('r', '' + Math.max(0, p.radius - 1));
        }
        if('isVisible' in p) {
            brushCircleOuter.style.opacity = p.isVisible ? '1' : '0';
            brushCircleInner.style.opacity = p.isVisible ? '1' : '0';
        }

    };
    this.updateColorPreview = function(p) {

        if('x' in p) {
            pickerPreviewCol.setAttribute('cx', p.x);
            pickerPreviewBorder.setAttribute('cx', p.x);
        }
        if('y' in p) {
            pickerPreviewCol.setAttribute('cy', p.y);
            pickerPreviewBorder.setAttribute('cy', p.y);
        }
        if('color' in p) {
            pickerPreviewCol.setAttribute('stroke', "rgb(" + parseInt(p.color.r, 10) + ", " + parseInt(p.color.g, 10) + ", " + parseInt(p.color.b, 10) + ")");
            let borderColor = BB.testIsWhiteBestContrast(p.color) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
            pickerPreviewBorder.setAttribute('stroke', borderColor);
        }
        if('isVisible' in p) {
            pickerPreviewCol.style.opacity = p.isVisible ? '1' : '0';
            pickerPreviewBorder.style.opacity = p.isVisible ? '1' : '0';
        }

    };
    this.updateCompass = function(p) {

        if('angleDeg' in p) {
            compassInner.setAttribute('transform', 'rotate('+p.angleDeg+')');
            compassLineCircle.style.opacity = p.angleDeg % 90 === 0 ? '1' : '0';
        }
        if('isVisible' in p) {
            compass.style.opacity = p.isVisible ? '1' : '0';
        }

    };
}