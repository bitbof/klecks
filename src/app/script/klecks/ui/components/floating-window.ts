import { getIconUrl } from '../../../icon/icon';
import { BB } from '../../../bb/bb';
import { TVector2D } from '../../../bb/bb-types';
import { clamp } from '../../../bb/math/math';
import { LANG } from '../../../language/language';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { css } from '../../../bb/base/base';

export type TFloatingWindowParams = {
    content: HTMLElement;
    // called after window gets closed
    onClose?: () => void;
    onMove?: (position: TVector2D) => void;
    position?: TVector2D;
    closeOnOutsideClick?: boolean;
    // will be ignored on click outside
    triggerElement?: HTMLElement;
};

export class FloatingWindow {
    private readonly rootEl: HTMLDivElement;
    private readonly closeButton: HTMLElement;
    private readonly position: TVector2D;
    private readonly pointerListener: PointerListener;
    private outsideClickListenerTimeout: number | undefined;
    private readonly onDocumentPointerDown: (event: PointerEvent) => void;
    private readonly onResize: () => void;
    private readonly fractionalPosition: TVector2D = { x: 0.5, y: 0.5 };
    private doCenterInitially: boolean;
    private isDestroyed = false;

    private applyPosition(): void {
        const rect = this.rootEl.getBoundingClientRect();
        if (this.doCenterInitially) {
            this.doCenterInitially = false;
            this.position.x = (window.innerWidth - rect.width) / 2;
            this.position.y = (window.innerHeight - rect.height) / 2;
        }
        this.position.x = clamp(this.position.x, 0, Math.max(0, window.innerWidth - rect.width));
        this.position.y = clamp(this.position.y, 0, Math.max(0, window.innerHeight - rect.height));
        css(this.rootEl, {
            left: this.position.x,
            top: this.position.y,
            visibility: 'visible',
        });
        this.fractionalPosition.x = (this.position.x + rect.width / 2) / window.innerWidth;
        this.fractionalPosition.y = (this.position.y + rect.height / 2) / window.innerHeight;
    }

    // keep window roughly in same area - similar to easel
    private applyFractionalPosition(): void {
        const newFloatingCenterX = Math.round(window.innerWidth * this.fractionalPosition.x);
        const newFloatingCenterY = Math.round(window.innerHeight * this.fractionalPosition.y);
        const rect = this.rootEl.getBoundingClientRect();
        this.position.x = newFloatingCenterX - rect.width / 2;
        this.position.y = newFloatingCenterY - rect.height / 2;
        this.applyPosition();
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TFloatingWindowParams) {
        this.position = p.position ? { ...p.position } : { x: 0, y: 0 };
        this.doCenterInitially = !p.position;
        this.onDocumentPointerDown = (event) => {
            if (p.triggerElement && p.triggerElement.contains(event.target as Node | null)) {
                return;
            }
            if (this.rootEl.contains(event.target as Node | null)) {
                return;
            }
            this.destroy();
            p.onClose?.();
        };
        this.onResize = () => this.applyFractionalPosition();
        this.closeButton = BB.el({
            tagName: 'button',
            className: 'popup-x',
            content: `<img alt="${LANG('modal-close')}" height="20" src="${getIconUrl('cancel')}">`,
            title: LANG('modal-close'),
            noRef: true,
            onClick: () => {
                this.destroy();
                p.onClose?.();
            },
            css: {
                width: 32,
                height: 32,
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
        header.append(this.closeButton);

        const body = BB.el({
            content: p.content,
            css: {
                minWidth: 0,
                minHeight: 0,
                overflow: 'auto',
            },
        });

        let downPosition: TVector2D = {
            x: 0,
            y: 0,
        };
        let isDragging = false;
        this.pointerListener = new BB.PointerListener({
            target: header,
            onPointer: (event) => {
                if (!isDragging && event.button === 'left' && event.type === 'pointerdown') {
                    if (event.target && this.closeButton.contains(event.target)) {
                        // don't drag close button
                        return;
                    }
                    event.eventPreventDefault();
                    isDragging = true;
                    downPosition = { ...this.position };
                }
                if (isDragging && event.button === 'left' && event.type === 'pointermove') {
                    event.eventPreventDefault();
                    this.position.x = downPosition.x + event.pageX - event.downPageX!;
                    this.position.y = downPosition.y + event.pageY - event.downPageY!;
                    this.applyPosition();
                }
                if (isDragging && event.type === 'pointerup') {
                    p.onMove?.({ ...this.position });
                    isDragging = false;
                }
            },
        });

        this.rootEl = BB.el({
            className: 'kl-floating-window',
            css: {
                position: 'fixed',
                display: 'flex',
                flexDirection: 'column',
                left: this.position.x,
                top: this.position.y,
                visibility: this.doCenterInitially ? 'hidden' : undefined,
                maxWidth: '100vw',
                maxHeight: '100vh',
                borderRadius: 4,
                overflow: 'hidden',
            },
        });
        this.rootEl.append(header, body);
        document.body.append(this.rootEl);
        window.addEventListener('resize', this.onResize);
        setTimeout(() => this.applyPosition());
        if (p.closeOnOutsideClick) {
            this.outsideClickListenerTimeout = undefined;
            document.addEventListener('pointerdown', this.onDocumentPointerDown);
        }
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;

        this.rootEl.remove();
        if (this.outsideClickListenerTimeout !== undefined) {
            clearTimeout(this.outsideClickListenerTimeout);
            this.outsideClickListenerTimeout = undefined;
        }
        document.removeEventListener('pointerdown', this.onDocumentPointerDown);
        window.removeEventListener('resize', this.onResize);
        this.pointerListener.destroy();
    }
}
