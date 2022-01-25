import {BB} from '../../../bb/bb';
// @ts-ignore
import angleImg from 'url:~/src/app/img/ui/angle.svg';
// @ts-ignore
import rotateImg from 'url:~/src/app/img/ui/edit-rotate.svg';

/**
 * Ui, when hand tool tab is open.
 *
 * p = {
 *     scale: number, // initial value
 *     angleDeg: number, // initial value
 *     onReset: function(),
 *     onFit: function(),
 *     onAngleChange: function(angleDeg number, isRelative number)
 * }
 *
 * @param p
 * @constructor
 */
export function HandUi(p) {
    let div = BB.el({
        css: {
            margin: '10px'
        }
    });
    let isVisible = true;
    let scale = p.scale;
    let angleDeg = p.angleDeg;

    let row1 = BB.el({
        css: {
            marginBottom: '10px',
            display: 'flex'
        }
    });
    div.appendChild(row1);
    let row2 = BB.el({
        css: {
            display: 'flex'
        }
    });
    div.appendChild(row2);


    let scaleEl = BB.el({
        css: {
            width: '55px',
            userSelect: 'none'
        }
    });
    row1.appendChild(scaleEl);

    let angleIm = new Image();
    angleIm.src = angleImg;
    BB.css(angleIm, {
        verticalAlign: 'bottom',
        width: '20px',
        height: '20px',
        marginRight: '5px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.2)',
        userSelect: 'none'
    });
    row1.appendChild(angleIm);

    let angleEl = BB.el({
        css: {
            userSelect: 'none'
        }
    });
    row1.appendChild(angleEl);


    function update() {
        scaleEl.innerHTML = Math.round(scale * 100) + '%';
        angleEl.innerHTML =  Math.round(angleDeg) + '°';


        angleIm.style.transform = 'rotate(' + angleDeg + 'deg)';
        if(angleDeg % 90 === 0) {
            angleIm.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255, 1), 0 0 0 1px rgba(0, 0, 0, 0.3)';
        } else {
            angleIm.style.boxShadow = '';
        }
    }
    update();


    let resetButton = BB.el({
        tagName: 'button',
        content: 'Reset',
        onClick: p.onReset
    });
    BB.makeUnfocusable(resetButton);
    row2.appendChild(resetButton);

    let fitButton = BB.el({
        tagName: 'button',
        content: 'Fit',
        css: {
            marginLeft: '10px'
        },
        onClick: p.onFit
    });
    BB.makeUnfocusable(fitButton);
    row2.appendChild(fitButton);

    row2.appendChild(BB.el({css: {flexGrow: '1'}}));

    let leftRotateButton = BB.el({
        tagName: 'button',
        content: '<img height="20" src="' + rotateImg + '" alt="Rotate" style="transform: scale(-1, 1)"/>',
        css: {
            marginLeft: '10px'
        },
        onClick: function() {
            p.onAngleChange(-15, true);
        }
    });
    BB.makeUnfocusable(leftRotateButton);
    row2.appendChild(leftRotateButton);

    let resetAngleButton = BB.el({
        tagName: 'button',
        content: '0°',
        css: {
            marginLeft: '10px'
        },
        onClick: function() {
            p.onAngleChange(0);
        }
    });
    BB.makeUnfocusable(resetAngleButton);
    row2.appendChild(resetAngleButton);

    let rightRotateButton = BB.el({
        tagName: 'button',
        content: '<img height="20" src="' + rotateImg + '" alt="Rotate"/>',
        css: {
            marginLeft: '10px'
        },
        onClick: function() {
            p.onAngleChange(15, true);
        }
    });
    BB.makeUnfocusable(rightRotateButton);
    row2.appendChild(rightRotateButton);



    // --- interface ---
    this.getElement = function() {
        return div;
    };
    this.setIsVisible = function(pIsVisible) {
        isVisible = !!pIsVisible;
        div.style.display = isVisible ? 'block' : 'none';
        if(isVisible) {
            update();
        }
    };
    this.update = function(pScale, pAngleDeg) {
        scale = pScale;
        angleDeg = pAngleDeg;
        if(isVisible) {
            update();
        }
    };
}