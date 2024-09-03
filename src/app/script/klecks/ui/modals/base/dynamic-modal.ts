import { KeyListener } from '../../../../bb/input/key-listener';
import { dialogCounter } from '../modal-count';
import { BB } from '../../../../bb/bb';
import { LANG } from '../../../../language/language';
import './scroll-fix';
import cancelImg from '/src/app/img/ui/cancel.svg';

/**
 * popup that fill whole height, with some padding.
 * currently only used for iframe popups.
 */
export class DynamicModal {
    private readonly parent: HTMLElement;
    private readonly rootEl: HTMLElement;
    private readonly updatePos: () => void;
    private readonly keyListener: KeyListener;
    private readonly xButton: HTMLElement;
    private readonly bgEl: HTMLElement;
    private readonly onClose: ((result?: string) => void) | undefined;

    // ----------------------------------- public -----------------------------------
    constructor(p: {
        title?: HTMLElement;
        content?: HTMLElement;
        buttonArr?: string[];
        autoFocus?: string | false; // todo - not implemented
        clickOnEnter?: string; // button name - todo not implemented
        onClose?: (result?: string) => void;

        //size and position
        width: number;
        isMaxHeight: boolean; // todo - not implemented
    }) {
        dialogCounter.increase();
        this.onClose = p.onClose;
        this.parent = document.body;
        this.rootEl = BB.el({
            parent: this.parent,
            className: 'g-root kl-d-modal-root',
            css: {
                position: 'fixed',
                left: '0',
                top: '0',
                bottom: '0',
                right: '0',
                overflow: 'auto',
                animationName: 'consoleIn',
                animationDuration: '0.3s',
                animationTimingFunction: 'ease-out',
            },
            onClick: BB.handleClick,
        });

        //background element registering clicks
        this.bgEl = BB.el({
            parent: this.rootEl,
            css: {
                position: 'absolute',
                left: '0',
                top: '0',
                bottom: '0',
                right: '0',
            },
            onClick: () => this.close(),
        });

        //the actual popup box
        const popupEl = BB.el({
            parent: this.rootEl,
            className: 'kl-d-modal',
            css: {
                position: 'absolute',
                width: BB.isCssMinMaxSupported()
                    ? 'min(calc(100% - 40px), ' + (p.width ? p.width : 400) + 'px)'
                    : (p.width ? p.width : 400) + 'px',
                height: 'calc(100% - 40px)',
                borderRadius: '10px',
                overflow: 'hidden',
            },
        });

        //x and y position via script. flex not powerful enough imo
        this.updatePos = () => {
            const elW = popupEl.offsetWidth;
            const elH = popupEl.offsetHeight;

            BB.css(popupEl, {
                left: Math.max(0, (window.innerWidth - elW) / 2) + 'px',
                top: Math.max(20, (window.innerHeight - elH) / 2 - elH * 0.2) + 'px',
            });
        };

        this.updatePos();
        window.addEventListener('resize', this.updatePos);

        //title row in popup
        const titleHeight = 40;
        const titleEl = BB.el({
            parent: popupEl,
            css: {
                height: titleHeight + 'px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingLeft: titleHeight / 2 + 'px',
            },
        });
        if (p.title) {
            titleEl.append(p.title);
        }
        this.xButton = BB.el({
            parent: titleEl,
            tagName: 'button',
            className: 'popup-x',
            content: `<img alt="${LANG('modal-close')}" height="20" src="${cancelImg}">`,
            title: LANG('modal-close'),
            onClick: () => this.close(),
            css: {
                width: titleHeight + 'px',
                height: titleHeight + 'px',
                lineHeight: titleHeight + 'px',
                background: 'none',
                boxShadow: 'none',
            },
            custom: {
                tabindex: '0',
            },
        });

        const contentEl = BB.el({
            parent: popupEl,
            css: {
                height: 'calc(100% - ' + titleHeight + 'px)',
            },
        });
        if (p.content) {
            contentEl.append(p.content);
        }

        this.keyListener = new BB.KeyListener({
            onDown: (keyStr, e) => {
                if (keyStr === 'esc') {
                    e.stopPropagation();
                    e.preventDefault(); // stay in fullscreen on Mac
                    this.close();
                }
            },
        });
    }

    // ---- interface ----
    close(): void {
        dialogCounter.decrease();
        BB.destroyEl(this.rootEl);
        this.rootEl.remove();
        window.removeEventListener('resize', this.updatePos);
        this.keyListener.destroy();
        BB.destroyEl(this.xButton);
        BB.destroyEl(this.bgEl);
        this.onClose && this.onClose();
    }
}
