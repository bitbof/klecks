import {BB} from '../../../bb/bb';
// @ts-ignore
import angleImg from 'url:~/src/app/img/ui/angle.svg';
// @ts-ignore
import rotateImg from 'url:~/src/app/img/ui/edit-rotate.svg';
import {LANG} from '../../../language/language';

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
    let row2 = BB.el({
        css: {
            display: 'flex',
            marginBottom: '10px',
        }
    });
    let row3 = BB.el({
        css: {
            display: 'flex'
        }
    });
    div.append(row1, row2, row3);


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
        if (angleDeg % 90 === 0) {
            angleIm.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255, 1), 0 0 0 1px rgba(0, 0, 0, 0.3)';
        } else {
            angleIm.style.boxShadow = '';
        }
    }
    update();


    let resetButton = BB.el({
        tagName: 'button',
        content: LANG('hand-reset'),
        onClick: p.onReset
    });
    BB.makeUnfocusable(resetButton);

    let fitButton = BB.el({
        tagName: 'button',
        content: LANG('hand-fit'),
        css: {
            marginLeft: '10px'
        },
        onClick: p.onFit
    });
    BB.makeUnfocusable(fitButton);
    row2.append(resetButton, fitButton);

    let leftRotateButton = BB.el({
        tagName: 'button',
        content: '<img height="20" src="' + rotateImg + '" alt="Rotate" style="transform: scale(-1, 1)"/>',
        onClick: function() {
            p.onAngleChange(-15, true);
        }
    });
    BB.makeUnfocusable(leftRotateButton);

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
    row3.append(leftRotateButton, resetAngleButton, rightRotateButton);



    // --- interface ---
    this.getElement = function() {
        return div;
    };
    this.setIsVisible = function(pIsVisible) {
        isVisible = !!pIsVisible;
        div.style.display = isVisible ? 'block' : 'none';
        if (isVisible) {
            update();
        }
    };
    this.update = function(pScale, pAngleDeg) {
        scale = pScale;
        angleDeg = pAngleDeg;
        if (isVisible) {
            update();
        }
    };
}