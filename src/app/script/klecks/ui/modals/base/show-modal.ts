import { getIconSvg, getIconUrl } from '../../../../icon/icon';
import { DIALOG_COUNTER } from '../modal-count';
import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import { TCss } from '../../../../bb/bb-types';

export type TModalButton<G extends string> = 'Ok' | 'Cancel' | { id: G; label: string };
type TModalResult<GButton extends TModalButton<string>> =
    | 'Cancel'
    | Extract<GButton, 'Ok'>
    | Extract<GButton, { id: string }>['id'];

export function showModal<const GButton extends TModalButton<string> = never>(p: {
    div?: HTMLElement; // node with content
    message: string | Element; // can be html
    callback?: (result: NoInfer<TModalResult<GButton>>) => void;
    buttons?: readonly GButton[]; // "Ok", and "Cancel" will be automatically translated
    primaries?: NoInfer<TModalResult<GButton>>[];
    deleteButton?: NoInfer<TModalResult<GButton>>; // button to style as a delete button
    type?: 'error' | 'warning' | 'upload' | 'ok';
    closeFunc?: (f: () => void) => void; // returns a function you can call to close (Cancel) the dialog
    style?: TCss;
    clickOnEnter?: NoInfer<TModalResult<GButton>>; // button to click when pressing Enter
    autoFocus?: false | NoInfer<TModalResult<GButton>>; // button to automatically focus - default 'Ok' - false -> none
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
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
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
            left: 0,
            top: 0,
            zIndex: 0,
            width: '100%',
            height: '100%',
        },
    });

    const titleSize = 40;
    const xButton = BB.el({
        tagName: 'button',
        className: 'popup-x',
        content: `<img alt="${LANG('modal-close')}" height="20" src="${getIconUrl('cancel')}">`,
        title: LANG('modal-close'),
        onClick: () => {
            close('Cancel');
        },
        css: {
            width: titleSize,
            height: titleSize,
            lineHeight: titleSize + 'px',
            position: 'absolute',
            right: 0,
            top: 0,
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
                    marginRight: 15,
                    marginBottom: p.div ? 10 : undefined,
                },
            }),
            p.div,
        ],
        className: boxClasses,
        css: p.style ? p.style : undefined,
    });

    scrollContent.append(
        BB.el({
            css: {
                flex: 0.5,
            },
        }),
        boxEl,
        BB.el({
            css: {
                flex: 1,
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

    let autoFocus: 'Ok' | TModalResult<GButton> | undefined;
    if (p.autoFocus === undefined) {
        autoFocus = 'Ok';
    } else if (p.autoFocus === false) {
        autoFocus = undefined;
    } else {
        autoFocus = p.autoFocus;
    }

    const buttonToId = <B extends TModalButton<string>>(button: B): TModalResult<B> => {
        return (button === 'Ok' || button === 'Cancel' ? button : button.id) as TModalResult<B>;
    };

    const buttonRowEl =
        p.buttons && p.buttons.length > 0
            ? BB.el({
                  parent: boxEl,
                  css: {
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                      marginTop: 12, // 8px already via buttons
                      marginLeft: -8,
                  },
              })
            : undefined;
    let clickOnEnterBtn: HTMLButtonElement | undefined;
    const btnElArr: HTMLButtonElement[] = [];
    if (p.buttons) {
        const iconSize = '17px';
        p.buttons.forEach((button) => {
            const buttonId = buttonToId(button);
            const label = (() => {
                if (button === 'Ok') {
                    return LANG('modal-ok');
                }
                if (button === 'Cancel') {
                    return LANG('modal-cancel');
                }
                return button.label;
            })();

            const btnClasses = new Set(['kl-button', 'kl-popup__btn']);
            if (p.primaries?.includes(buttonId)) {
                btnClasses.add('kl-button-primary');
            }
            let iconImg: HTMLElement | SVGSVGElement | undefined = undefined;
            if (buttonId === p.deleteButton) {
                iconImg = getIconSvg('remove-layer', { width: iconSize, height: iconSize });
                btnClasses.add('kl-button-delete');
            }
            if (buttonId === 'Ok') {
                iconImg = getIconSvg('check', { width: iconSize, height: iconSize });
                btnClasses.add('kl-button-primary');
            }
            if (buttonId === 'Cancel') {
                iconImg = getIconSvg('cancel', { width: iconSize, height: iconSize });
            }
            const btn = BB.el({
                parent: buttonRowEl,
                tagName: 'button',
                className: [...btnClasses],
                content: [
                    iconImg,
                    BB.el({
                        className: 'kl-popup__btn__text',
                        content: label,
                    }),
                ],
                onClick: () => {
                    close(buttonId);
                },
            });
            btnElArr.push(btn);
            if (autoFocus === buttonId) {
                setTimeout(() => {
                    btn.focus();
                    rootEl.scrollTo(0, 0);
                }, 10);
                setTimeout(() => {
                    // safari needs a separate timeout
                    rootEl.scrollTo(0, 0);
                }, 20);
            }
            if (buttonId === p.clickOnEnter) {
                clickOnEnterBtn = btn;
            }
        });
    }

    function close(buttonId: TModalResult<GButton>): void {
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
            p.callback(buttonId);
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
