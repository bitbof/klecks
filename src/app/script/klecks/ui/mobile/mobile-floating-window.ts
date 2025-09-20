import { BB } from '../../../bb/bb';
import { TVector2D } from '../../../bb/bb-types';
import { clamp } from '../../../bb/math/math';
import { LANG } from '../../../language/language';
import cancelImg from 'url:/src/app/img/ui/cancel.svg';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { css } from '../../../bb/base/base';

export type TMobileFloatingWindowParams = {
    content: HTMLElement;
    // called after window gets closed
    onClose: () => void;
    position: TVector2D;
};

export class MobileFloatingWindow {
    private readonly rootEl: HTMLDivElement;
    private readonly xButton: HTMLElement;
    private readonly position: TVector2D;
    private readonly pointerListener: PointerListener;

    private applyPosition(): void {
        const rect = this.rootEl.getBoundingClientRect();
        this.position.x = clamp(this.position.x, 0, window.innerWidth - rect.width);
        this.position.y = clamp(this.position.y, 0, window.innerHeight - rect.height);
        css(this.rootEl, {
            left: this.position.x + 'px',
            top: this.position.y + 'px',
        });
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileFloatingWindowParams) {
        this.position = { ...p.position };
        this.xButton = BB.el({
            tagName: 'button',
            className: 'popup-x',
            content: `<img alt="${LANG('modal-close')}" height="20" src="${cancelImg}">`,
            title: LANG('modal-close'),
            noRef: true,
            onClick: () => {
                p.onClose();
            },
            css: {
                width: '32px',
                height: '32px',
                lineHeight: '32px',
                background: 'none',
                boxShadow: 'none',
            },
            custom: {
                tabindex: '0',
            },
        });

        const header = BB.el({
            className: 'kl-floating-window-header',
        });
        header.append(this.xButton);

        const body = BB.el({
            content: p.content,
        });

        let downPosition: TVector2D = {
            x: 0,
            y: 0,
        };
        this.pointerListener = new BB.PointerListener({
            target: header,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.button === 'left' && event.type === 'pointerdown') {
                    downPosition = { ...this.position };
                }
                if (event.button === 'left' && event.type === 'pointermove') {
                    this.position.x = downPosition.x + event.pageX - event.downPageX!;
                    this.position.y = downPosition.y + event.pageY - event.downPageY!;
                    this.applyPosition();
                }
            },
        });

        this.rootEl = BB.el({
            css: {
                position: 'fixed',
                display: 'flex',
                flexDirection: 'column',
                left: this.position.x + 'px',
                top: this.position.y + 'px',
            },
        });
        this.rootEl.append(header, body);
        setTimeout(() => this.applyPosition());
    }

    getElement(): HTMLDivElement {
        return this.rootEl;
    }

    getPosition(): TVector2D {
        return { ...this.position };
    }

    destroy(): void {
        this.pointerListener.destroy();
    }
}
