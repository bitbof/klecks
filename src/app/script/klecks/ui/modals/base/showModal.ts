import { getIconSvg, getIconUrl } from '../../../../icon/icon';
import { TKeyString } from '../../../../bb/bb-types';
import { DIALOG_COUNTER } from '../modal-count';
import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import './scroll-fix';

export function showModal(p: {
    div?: HTMLElement; // node with content
    message: string | Element; // can be html
    callback?: (result: string) => void;
    buttons?: string[]; // "Ok", and "Cancel" will be automatically translated
    primaries?: string[];
    deleteButtonName?: string;
    type?: 'error' | 'warning' | 'upload' | 'ok'; // todo (...what is to be done?)
    closeFunc?: (f: () => void) => void; // returns a function you can call to close (Cancel) the dialog
    style?: TKeyString;
    clickOnEnter?: string; // name of button - will be clicked if enter key pressed
    autoFocus?: false | string; // name of  to automatically focus - default 'Ok' - false -> none
    ignoreBackground?: boolean; // default false; if true clicking on background doesn't close
}): {
    setIgnoreBackground: (b: boolean) => void;
} {
    DIALOG_COUNTER.increase();
    let isClosed = false;
    let ignoreBackground = !!p.ignoreBackground;

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
        },
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
        },
    });

    const bgEl = BB.el({
        parent: scrollContent,
        onClick: () => {
            if (ignoreBackground) {
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
        },
    });

    const titleHeight = 40;
    const xButton = BB.el({
        tagName: 'button',
        className: 'popup-x',
        content: `<img alt="${LANG('modal-close')}" height="20" src="${getIconUrl('cancel')}">`,
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
        },
    });

    let icon: HTMLElement | undefined = undefined;
    if (p.type) {
        icon = BB.el({
            className: {
                error: 'kl-popup__icon-error',
                ok: 'kl-popup__icon-ok',
                warning: 'kl-popup__icon-warning',
                upload: 'kl-popup__icon-upload',
            }[p.type],
        });
    }

    const boxClasses = ['kl-popup-box'];
    boxClasses.push('kl-popup-box--sm');
    const boxEl = BB.el({
        content: [
            xButton,
            icon,
            BB.el({
                content: p.message,
                css: {
                    marginRight: '15px',
                    marginBottom: p.div ? '10px' : undefined,
                },
            }),
            p.div,
        ],
        className: boxClasses.join(' '),
        css: p.style ? p.style : undefined,
    });

    scrollContent.append(
        BB.el({
            css: {
                flex: '0.5',
            },
        }),
        boxEl,
        BB.el({
            css: {
                flex: '1',
            },
        }),
    );

    const keyListener = new BB.KeyListener({
        onDown: function (keyStr, e, comboStr): void {
            if (isClosed) {
                return;
            }
            if (clickOnEnterBtn && comboStr === 'enter' && !BB.isInputFocused()) {
                e.stopPropagation();
                setTimeout(() => {
                    clickOnEnterBtn && clickOnEnterBtn.click();
                }, 10);
            }
            if (comboStr === 'esc') {
                e.stopPropagation();
                e.preventDefault(); // stay in fullscreen on Mac
                close('Cancel');
            }
        },
    });
    // prevent ctrl scroll -> zooming page
    const wheelPrevent = (event: WheelEvent): void => {
        if (keyListener.isPressed('ctrl')) {
            event.preventDefault();
        }
    };
    rootEl.addEventListener('wheel', wheelPrevent, { passive: false });
    rootEl.onclick = BB.handleClick;

    let autoFocus: string | undefined;
    if (p.autoFocus) {
        autoFocus = p.autoFocus;
    } else if (p.autoFocus === false) {
        autoFocus = undefined;
    } else {
        autoFocus = 'Ok';
    }

    const buttonRowEl =
        p.buttons && p.buttons.length > 0
            ? BB.el({
                  parent: boxEl,
                  css: {
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                      marginTop: '12px', // 8px already via buttons
                      marginLeft: '-8px',
                  },
              })
            : undefined;
    let clickOnEnterBtn: HTMLButtonElement | undefined;
    const btnElArr: HTMLButtonElement[] = [];
    if (p.buttons) {
        const iconSize = '17px';
        p.buttons.forEach((buttonName) => {
            const btnClasses = new Set(['kl-popup__btn']);
            if (p.primaries && p.primaries.includes(buttonName)) {
                btnClasses.add('kl-button-primary');
            }
            let label = buttonName;
            let iconImg: HTMLElement | SVGSVGElement | undefined = undefined;
            if (buttonName === p.deleteButtonName) {
                iconImg = getIconSvg('remove-layer', { width: iconSize, height: iconSize });
                btnClasses.add('kl-button-delete');
            }
            if (buttonName === 'Ok') {
                iconImg = getIconSvg('check', { width: iconSize, height: iconSize });
                btnClasses.add('kl-button-primary');
                label = LANG('modal-ok');
            }
            if (buttonName === 'Cancel') {
                iconImg = getIconSvg('cancel', { width: iconSize, height: iconSize });
                label = LANG('modal-cancel');
            }
            const btn = BB.el({
                parent: buttonRowEl,
                tagName: 'button',
                className: [...btnClasses].join(' '),
                content: [
                    iconImg,
                    BB.el({
                        className: 'kl-popup__btn__text',
                        content: label,
                    }),
                ],
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

    function close(value: string): void {
        if (isClosed) {
            return;
        }

        isClosed = true;
        BB.clearSelection();
        BB.unfocusAnyInput();
        rootRootEl.remove();
        DIALOG_COUNTER.decrease();
        BB.destroyEl(xButton);
        BB.destroyEl(bgEl);
        keyListener.destroy();
        rootEl.removeEventListener('wheel', wheelPrevent);
        // (disabled) eslint-disable-next-line no-null/no-null
        rootEl.onclick = null;
        btnElArr.forEach((item) => BB.destroyEl(item));
        btnElArr.splice(0, btnElArr.length);

        if (p.callback) {
            p.callback(value);
        }
    }

    if (p.closeFunc) {
        p.closeFunc(function () {
            close('Cancel');
        });
    }

    return {
        setIgnoreBackground: (b: boolean) => {
            ignoreBackground = b;
        },
    } as const;
}
