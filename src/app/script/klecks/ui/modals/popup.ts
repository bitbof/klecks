import {dialogCounter} from './modal-count';
import {BB} from '../../../bb/bb';
// @ts-ignore
import checkImg from 'url:~/src/app/img/ui/check.svg';
// @ts-ignore
import cancelImg from 'url:~/src/app/img/ui/cancel.svg';
import {LANG} from '../../../language/language';
import {IKeyString} from '../../../bb/bb.types';

window.onscroll = (e) => {
    e.preventDefault();
}

export function popup (
    p: {
        target: HTMLElement;
        div?: HTMLElement; // node with content
        message: string; // can be html
        callback?: (result: string) => void;
        buttons?: string[]; // "Ok", and "Cancel" will be automatically translated
        primaries?: string[];
        type?: 'error' | 'warning' | 'upload' | 'ok'; // todo
        closefunc?: (f: () => void) => void; // returns a function you can call to close (Cancel) the dialog
        style?: IKeyString;
        clickOnEnter?: string; // name of button - will be clicked if enter key pressed
        autoFocus?: false | string; // name of  to automatically focus - default 'Ok' - false -> none
        ignoreBackground?: boolean; // deafult false; if true clicking on background doesn't close
    }
): void {
    dialogCounter.increase();
    let isClosed = false;


    // need this extra layer because chrome mobile otherwise scrolls the page and then glitches as the address bar goes away
    const rootRootEl = BB.el({
        parent: document.body,
        css: {
            position: 'absolute',
            left: '0',
            top: '0',
            right: '0',
            bottom: '0',
            overflow: 'hidden',
        }
    });
    const rootEl = BB.el({
        parent: rootRootEl,
        className: 'kl-popup',
    });

    const scrollContent = BB.el({
        parent: rootEl,
        css: {
            width: '100%',
            minHeight: '100%',
            // padding: '10px 0',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
        }
    });

    const bgEl = BB.el({
        parent: scrollContent,
        onClick: () => {
            if (p.ignoreBackground) {
                return;
            }
            close('Cancel');
        },
        css: {
            position: 'absolute',
            left: '0',
            top: '0',
            zIndex: '0',
            width: '100%',
            height: '100%',
        }
    });

    const titleHeight = 40;
    const xButton = BB.el({
        tagName: 'button',
        className: 'popup-x',
        content: `<img alt="${LANG('modal-close')}" height="20" src="${cancelImg}">`,
        title: LANG('modal-close'),
        onClick: () => {
            close('Cancel');
        },
        css: {
            width: titleHeight + 'px',
            height: titleHeight + 'px',
            lineHeight: titleHeight + 'px',
            position: 'absolute',
            right: '0',
            top: '0',
            background: 'none',
            boxShadow: 'none',
        }
    });

    const boxClasses = ['kl-popup-box'];
    boxClasses.push('kl-popup-box--sm');
    const boxEl = BB.el({
        content: [
            xButton,
            BB.el({
                content:p.message,
                css: {
                    marginBottom: p.div ? '10px' : null,
                    marginRight: '15px',
                }
            }),
            p.div,
        ],
        className: boxClasses.join(' '),
        css: p.style ? p.style : null,
    });

    scrollContent.append(
        BB.el({
            css: {
                flex: '0.5',
            }
        }),
        boxEl,
        BB.el({
            css: {
                flex: '1',
            }
        })
    );

    if (p.type === 'error') {
        BB.addClassName(boxEl, 'poperror');
    }
    if (p.type === 'ok') {
        BB.addClassName(boxEl, 'popok');
    }
    if (p.type === 'warning') {
        BB.addClassName(boxEl, 'popwarning');
    }
    if (p.type === 'upload') {
        BB.addClassName(boxEl, 'popupload');
    }

    const keyListener = new BB.KeyListener({
        onDown: function(keyStr, e, comboStr) {
            if (isClosed) {
                return;
            }
            if (clickOnEnterBtn && comboStr === 'enter' && !BB.isInputFocused()) {
                e.stopPropagation();
                setTimeout(function() {
                    clickOnEnterBtn.click();
                }, 10);
            }
            if (comboStr === 'esc') {
                e.stopPropagation();
                close('Cancel');
            }
        }
    });
    // prevent ctrl scroll -> zooming page
    const wheelPrevent = (event) => {
        if (keyListener.isPressed('ctrl')) {
            event.preventDefault();
        }
    };
    BB.addEventListener(rootEl, 'wheel', wheelPrevent);
    rootEl.onclick = BB.handleClick;

    let autoFocus = null;
    if (p.autoFocus) {
        autoFocus = p.autoFocus;
    } else if (p.autoFocus === false) {
        autoFocus = null;
    } else {
        autoFocus = 'Ok';
    }

    const buttonRowEl = p.buttons && p.buttons.length > 0 ? BB.el({
        parent: boxEl,
        css: {
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            marginTop: '12px', // 8px already via buttons
            marginLeft: '-8px',
        }
    }) : null;
    let clickOnEnterBtn;
    const btnElArr = [];
    if (p.buttons) {
        p.buttons.forEach(buttonName => {
            const btnClasses = ['kl-popup__btn'];
            if (buttonName === 'Ok' || (p.primaries && p.primaries.includes(buttonName))) {
                btnClasses.push('kl-button-primary');
            }
            let iconUrl;
            let label = buttonName;
            if (buttonName === 'Ok') {
                label = LANG('modal-ok');
                iconUrl = checkImg;
            }
            if (buttonName === 'Cancel') {
                label = LANG('modal-cancel');
                iconUrl = cancelImg;
            }
            let iconImg = null;
            if (iconUrl) {
                iconImg = BB.el({
                    tagName: 'img',
                    custom: {
                        src: iconUrl,
                        height: '17',
                    }
                });
            }
            const btn = BB.el({
                parent: buttonRowEl,
                tagName: 'button',
                className: btnClasses.join(' '),
                content: [iconImg, label],
                onClick: () => {
                    close(buttonName);
                },
            });
            btnElArr.push(btn);
            if (autoFocus === buttonName) {
                setTimeout(() => {
                    btn.focus();
                    rootEl.scrollTo(0, 0);
                }, 10);
                setTimeout(() => {
                    // safari needs a separate timeout
                    rootEl.scrollTo(0, 0);
                }, 20);
            }
            if (buttonName === p.clickOnEnter) {
                clickOnEnterBtn = btn;
            }
        });
    }

    function close (value: string) {
        if (isClosed) {
            return;
        }

        isClosed = true;
        BB.clearSelection();
        {
            /*
            Unfocus anything that is focused.

            If an Input is focused in Firefox, and it gets detached from the DOM via a Node
            that isn't its direct parent, then Firefox will keep anything attached to this
            Input in memory. It will not be garbage collected until a new Input is focused.

            Workaround: Temporarily create an input, focus it, detach it.
             */
            const focusEl = BB.el({
                parent: document.body,
                tagName: 'input',
                css: {
                    opacity: '0',
                    width: '0',
                    height: '0',
                }
            }) as HTMLInputElement;
            setTimeout(() => {
                focusEl.select();
                focusEl.focus();
                focusEl.parentNode.removeChild(focusEl);
            }, 10);
        }
        document.body.removeChild(rootRootEl);
        dialogCounter.decrease();
        BB.destroyEl(xButton);
        BB.destroyEl(bgEl);
        keyListener.destroy();
        BB.removeEventListener(rootEl, 'wheel', wheelPrevent);
        rootEl.onclick = null;
        btnElArr.forEach(item => {
            BB.destroyEl(item);
        });
        btnElArr.splice(0, btnElArr.length);

        if (p.callback) {
            p.callback(value);
        }
    }

    if (p.closefunc) {
        p.closefunc(function () {
            close('Cancel');
        });
    }

}


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
    dialogCounter.increase();
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
        dialogCounter.decrease();
        div.onclick = null;
        parent.removeChild(div);
        clearInterval(updateInterval);
        window.removeEventListener('resize', updatePos);
        keyListener.destroy();
        BB.destroyEl(xButton);
        BB.destroyEl(bgEl);
        if (p.onClose) {
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
    if (p.title) {
        titleEl.appendChild(p.title);
    }
    const xButton = BB.el({
        parent: titleEl,
        tagName: 'button',
        className: 'popup-x',
        content: `<img alt="${LANG('modal-close')}" height="20" src="${cancelImg}">`,
        title: LANG('modal-close'),
        onClick: close,
        css: {
            width: titleHeight + 'px',
            height: titleHeight + 'px',
            lineHeight: titleHeight + 'px',
            background: 'none',
            boxShadow: 'none',
        },
        custom: {
            tabindex: '0',
        }
    });

    const contentEl = BB.el({
        parent: popupEl,
        css: {
            height: 'calc(100% - ' + titleHeight + 'px)'
        }
    });
    if (p.content) {
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