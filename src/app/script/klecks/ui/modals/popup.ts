import {dialogCounter} from './modal-count';
import {BB} from '../../../bb/bb';
// @ts-ignore
import checkImg from 'url:~/src/app/img/ui/check.svg';
// @ts-ignore
import cancelImg from 'url:~/src/app/img/ui/cancel.svg';

/**
 *
 * params:
 * {
 *      target: DOM Element
 *      div: node with content
 *      message:
 *      callback?:
 *      buttons: [string, ...]
 *      primaries: [string, ...]
 *      type:
 *      closefunc:
 *      style:
 *      clickOnEnter: string //name of button
 *      autoFocus: string //name of button - default 'Ok' || 'Yes' || 'Upload' - false -> none
 * }
 *
 * @param params
 */
export const popup = function (params) {
    dialogCounter.count++;

    const target = params.target;
    const callback = params.callback ? params.callback : () => {};
    const buttons = params.buttons;
    const type = params.type;
    const div = document.createElement('div');
    div.className = 'g-root';
    div.id = 'popup';
    div.style.cursor = 'default';
    let destructed = false;
    BB.css(div, {
        width: '100%',
        height: '100%',
        position: 'absolute',
        left: '0',
        top: '0'
    });
    div.onclick = BB.handleClick;
    // prevent ctrl scroll -> zooming page
    const wheelPrevent = (event) => {
        event.preventDefault();
    }
    BB.addEventListener(div, 'wheel', wheelPrevent);

    let autoFocusArr = [];
    if(params.autoFocus) {
        autoFocusArr = [params.autoFocus];
    } else if(params.autoFocus === false) {
        autoFocusArr = [];
    } else {
        autoFocusArr = ['Ok', 'Yes', 'Upload'];
    }

    //for closing dialog when clicking outside of it
    const closingLayer = document.createElement('div');
    BB.css(closingLayer, {
        width: '100%',
        height: '100%',
        position: 'fixed',
        left: '0',
        top: '0'
    });
    div.appendChild(closingLayer);

    const cell = document.createElement('div');
    cell.id = 'cell';
    div.appendChild(cell);
    const content = document.createElement('div');
    content.style.position = 'relative';
    content.className = 'popup-content';

    function closePopup(result) {
        if(destructed) {
            return;
        }
        dialogCounter.count--;
        BB.clearSelection();
        target.removeChild(div);
        callback(result);
        keyListener.destroy();
        BB.removeEventListener(closingLayer, 'click', onClosingLayerClick);
        document.body.style.overflow = '';

        xButton.onclick = null;
        buttonArr.forEach(item => {
            item.onclick = null;
        });
        buttonArr.splice(0, buttonArr.length);
        BB.removeEventListener(div, 'wheel', wheelPrevent);
        div.onclick = null;

        destructed = true;
    }

    function onClosingLayerClick() {
        closePopup('Cancel');
    }
    BB.addEventListener(closingLayer, 'click', onClosingLayerClick);


    const xButton = document.createElement('div');
    xButton.className = 'dialog-closebtn';
    if (navigator.appName === 'Microsoft Internet Explorer') {
        xButton.textContent = 'X';
    } else {
        xButton.textContent = '╳';
    }
    xButton.title = 'Close';
    xButton.onclick = function () {
        closePopup('Cancel');
    };
    content.appendChild(xButton);


    cell.appendChild(content);
    target.appendChild(div);
    const message = document.createElement('div');
    content.appendChild(message);
    if (params.div) {
        content.appendChild(params.div);
        if(params.buttons) {
            params.div.style.marginBottom = '20px';
        }
    }
    if (!params.message) {
    } else if (typeof params.message === 'string') {
        message.innerHTML = params.message;
    } else {
        message.appendChild(params.message);
    }
    message.style.marginRight = '15px';
    message.style.marginBottom = '10px';
    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.textAlign = 'right';
    let clickOnEnterButton = null;
    const buttonArr = [];
    const addbutton = function (label, i) {
        const button = document.createElement('button');
        //button.style.cssFloat = "right";
        button.style.minWidth = '80px';
        button.style.display = 'inline-block';
        button.style.marginLeft = '8px';

        if (label === 'Ok' || (params.primaries && params.primaries.includes(label))) {
            button.className = 'kl-button-primary';
        }
        if (label === 'Ok') {
            button.innerHTML = '<img height="17" src="' + checkImg + '"/>' + label;
        } else if (label === 'Cancel') {
            button.innerHTML = '<img height="17" src="' + cancelImg + '"/>' + label;
        } else {
            button.innerHTML = label;
        }
        buttonWrapper.appendChild(button);
        //button.tabIndex = i + 1000;
        button.onclick = function () {
            closePopup(label);
        };

        if(autoFocusArr.includes(label)) {
            setTimeout(function () {
                button.focus();
            }, 10);
        }

        if(label === params.clickOnEnter) {
            clickOnEnterButton = button;
        }

        buttonArr.push(button);
    };
    /*for (let i = params.buttons.length - 1; i >= 0; i--) {
        addbutton(params.buttons[i], i);
    }*/
    if(params.buttons) {
        for (let i = 0; i < params.buttons.length; i++) {
            addbutton(params.buttons[i], i);
        }
        content.appendChild(buttonWrapper);
    }

    content.appendChild(BB.el({
        css: {
            clear: 'both'
        }
    }));

    const keyListener = new BB.KeyListener({
        onDown: function(keyStr, e, comboStr) {
            if (destructed) {
                return;
            }
            if(comboStr === 'enter') {
                setTimeout(function() {
                    if(clickOnEnterButton !== null) {
                        e.stopPropagation();
                        clickOnEnterButton.click();
                    }
                }, 10);
            }
            if (comboStr === 'esc') {
                e.stopPropagation();
                closePopup('Cancel');
            }
        }
    });

    if (type === 'error') {
        BB.addClassName(content, 'poperror');
    }
    if (type === 'ok') {
        BB.addClassName(content, 'popok');
    }
    if (type === 'warning') {
        BB.addClassName(content, 'popwarning');
    }
    if (type === 'upload') {
        BB.addClassName(content, 'popupload');
    }
    if (type === 'trash') {
        BB.addClassName(content, 'poptrash');
    }
    if (!type) {
        BB.addClassName(content, 'popdefault');
    }
    if (params.style) {
        BB.css(content, params.style);
    }
    /*content.onclick = function() {
    target.removeChild(div);
}*/
    if (params.closefunc) {
        params.closefunc(function () {
            closePopup('Cancel');
        });
    }

};


/**
 * popups that fill whole height, with some padding.
 * currently only used for iframe popups.
 *
 * p = {
 *      title: DOM Element | string, // optional (todo allow string)
 *      icon: 'ok', // optional todo
 *      content: DOM Element, // optional
 *      buttonArr: [ // optional todo
 *          'Ok',
 *          'Cancel'
 *      ],
 *      autoFocus: string | false, //todo
 *      clickOnEnter: string, //todo
 *      onClose: function(result: string), // optional (todo result)
 *
 *      //size and position
 *      width: 500,
 *      isMaxHeight: boolean //todo, currently always true
 * }
 *
 * @param p
 * @constructor
 */
export const Popup = function(p) {
    dialogCounter.count++;
    const parent = document.body;
    const div = BB.el({
        parent: parent,
        className: 'g-root',
        css: {
            position: 'fixed',
            left: '0',
            top: '0',
            bottom: '0',
            right: '0',
            background: 'rgba(0, 0, 0, 0.45)',
            overflow: 'auto',
            animationName: 'consoleIn',
            animationDuration: '0.3s',
            animationTimingFunction: 'ease-out'
        }
    });
    div.onclick = BB.handleClick;

    let updateInterval;

    function close() {
        dialogCounter.count--;
        div.onclick = null;
        parent.removeChild(div);
        clearInterval(updateInterval);
        window.removeEventListener('resize', updatePos);
        keyListener.destroy();
        BB.destroyEl(xButton);
        BB.destroyEl(bgEl);
        if(p.onClose) {
            p.onClose();
        }
    }

    //background element registering clicks
    const bgEl = BB.el({
        parent: div,
        css: {
            position: 'absolute',
            left: '0',
            top: '0',
            bottom: '0',
            right: '0'
        },
        onClick: close
    });

    //the actual popup box
    const popupEl = BB.el({
        parent: div,
        css: {
            position: 'absolute',
            width: (BB.isCssMinMaxSupported() ?
                'min(calc(100% - 40px), ' + (p.width ? p.width : 400) + 'px)' :
                (p.width ? p.width : 400) + 'px'),
            height: 'calc(100% - 40px)',
            background: '#eee',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: 'rgba(0, 0, 0, 0.25) 0px 5px 60px'
        }
    });

    //x and y position via script. flex not powerful enough imo
    function updatePos() {
        const elW = popupEl.offsetWidth;
        const elH = popupEl.offsetHeight;

        BB.css(popupEl, {
            left: Math.max(0, (window.innerWidth - elW) / 2) + 'px',
            top: Math.max(20, (window.innerHeight - elH) / 2 - (elH * 0.20)) + 'px'
        });
    }
    //todo also update when popup changes size - resizeobserver and fallback
    //updateInterval = setInterval(updatePos, 100);
    updatePos();
    window.addEventListener('resize', updatePos);

    //title row in popup
    const titleHeight = 40;
    const titleEl = BB.el({
        parent: popupEl,
        css: {
            height: titleHeight + 'px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingLeft: (titleHeight / 2) + 'px'
        }
    });
    if(p.title) {
        titleEl.appendChild(p.title);
    }
    const xButton = BB.el({
        parent: titleEl,
        className: 'popup-x',
        content: '╳',
        title: 'Close',
        onClick: close,
        css: {
            width: titleHeight + 'px',
            height: titleHeight + 'px',
            lineHeight: titleHeight + 'px'
        }
    });

    const contentEl = BB.el({
        parent: popupEl,
        css: {
            height: 'calc(100% - ' + titleHeight + 'px)'
        }
    });
    if(p.content) {
        contentEl.appendChild(p.content);
    }

    const keyListener = new BB.KeyListener({
        onDown: function(keyStr, e) {
            if (keyStr === 'esc') {
                e.stopPropagation();
                close();
            }
        }
    });


    // --- interface ---
    this.close = function() {
        close();
    };
};