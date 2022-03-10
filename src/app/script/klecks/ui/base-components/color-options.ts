import {BB} from '../../../bb/bb';

/**
 * UI to pick between colors in colorArr. can display full transparent (checkerboard).
 * Can't deal with 0.5 alpha.
 * Rectangular buttons.
 *
 * p = {
 *     colorArr: rgba[], // duplicates are removed
 *     onChange: func(rgbaObj),
 *     label: string,
 *     initialIndex: int// optional, index before duplicates were removed
 * }
 *
 * @param p
 * @constructor
 */
export const ColorOptions = function(p) {
    const div = BB.el({
        content: p.label ? p.label : '',
        css: {
            display: 'flex',
            alignItems: 'center',
            colorScheme: 'only light',
        }
    });

    let selectedIndex = 0;
    const colorArr = [];
    const buttonArr = [];
    const buttonSize = 22;
    const checkerUrl = BB.createCheckerDataUrl(5);

    // build colorArr while removing duplicates
    for (let i = 0; i < p.colorArr.length; i++) {
        const item = p.colorArr[i];
        let found = false;
        for (let e = 0; e < colorArr.length; e++) {
            const sItem = colorArr[e];
            if (sItem === null || item === null) {
                continue;
            }
            if (sItem.r === item.r && sItem.g === item.g && sItem.b === item.b && sItem.a === item.a) {
                found = true;
                break;
            }
        }
        if (found) {
            continue;
        }
        colorArr.push(item);
        if ('initialIndex' in p && p.initialIndex === i) {
            selectedIndex = colorArr.length - 1;
        }
    }

    for (let i = 0; i < colorArr.length; i++) {
        (function(i) {

            const colorButton = BB.el({
                content: colorArr[i] ? '' : 'X',
                css: {
                    width: buttonSize + 'px',
                    height: buttonSize + 'px',
                    backgroundColor: colorArr[i] ? BB.ColorConverter.toRgbaStr(colorArr[i]) : 'transparent',
                    marginLeft: '7px',
                    boxShadow: '0 0 0 1px #aaa',
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'center',
                    lineHeight: (buttonSize + 1) + 'px',
                    color: '#aaa'
                }
            });
            if (colorArr[i] && colorArr[i].a === 0) {
                colorButton.style.backgroundImage = 'url(' + checkerUrl + ')';
            }

            colorButton.onclick = function(e) {
                e.preventDefault();
                selectedIndex = i;
                update();
                p.onChange(colorArr[i]);
            };

            (colorButton as any).setIsSelected = function(b) {
                if (b) {
                    BB.css(colorButton, {
                        boxShadow: '0 0 0 2px var(--active-highlight-color), 0 0 5px 0 var(--active-highlight-color)',
                        pointerEvents: 'none'
                    });
                } else {
                    BB.css(colorButton, {
                        boxShadow: '0 0 0 1px #aaa',
                        pointerEvents: ''
                    });
                }
            };


            div.appendChild(colorButton);
            buttonArr.push(colorButton);
        })(i);
    }


    function update() {
        for (let i = 0; i < buttonArr.length; i++) {
            buttonArr[i].setIsSelected(i === selectedIndex);
        }
    }
    update();

    // --- interface ---
    this.getElement = function() {
        return div;
    };

    this.destroy = () => {
        buttonArr.forEach(item => {
            item.onclick = null;
        });
        buttonArr.splice(0, buttonArr.length);
    };
};