import { BB } from '../../../bb/bb';
import { ToolspaceCollapser } from './toolspace-collapser';
import { KL } from '../../kl';
import { TUiLayout } from '../../kl-types';
import { LocalStorage } from '../../../bb/base/local-storage';
import { css } from '../../../bb/base/base';

export type TMobileUiParams = {
    onShowToolspace: (b: boolean) => void;
    toolUis: HTMLElement[];
};

export class MobileUi {
    private readonly rootEl: HTMLElement;
    private toolspaceIsOpen: boolean = true;
    private orientation: TUiLayout = 'right';
    private isVisible: boolean = false;
    private readonly toolspaceCollapser: ToolspaceCollapser;
    private readonly mobileWrapperEl: HTMLElement;
    private readonly onShowToolspace: TMobileUiParams['onShowToolspace'];

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileUiParams) {
        this.onShowToolspace = p.onShowToolspace;
        this.toolspaceCollapser = new KL.ToolspaceCollapser({
            onChange: () => {
                this.toolspaceIsOpen = this.toolspaceCollapser.isOpen();
                this.onShowToolspace(this.toolspaceIsOpen);
                if (this.toolspaceIsOpen) {
                    LocalStorage.removeItem('uiShowMobile');
                } else {
                    LocalStorage.setItem('uiShowMobile', 'true');
                }
            },
        });

        this.mobileWrapperEl = BB.el({
            css: {
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
            },
        });
        this.mobileWrapperEl.append(...p.toolUis);

        this.rootEl = BB.el({
            css: {
                position: 'absolute',
                top: '0',
                userSelect: 'none',
            },
        });
        this.rootEl.append(this.toolspaceCollapser.getElement(), this.mobileWrapperEl);
        this.update();
    }

    update(): void {
        if (this.isVisible) {
            if (this.toolspaceIsOpen) {
                this.mobileWrapperEl.style.display = 'none';
                if (this.orientation === 'left') {
                    css(this.rootEl, {
                        left: '271px',
                        right: '',
                    });
                } else {
                    css(this.rootEl, {
                        left: '',
                        right: '271px',
                    });
                }
            } else {
                this.mobileWrapperEl.style.display = 'flex';
                if (this.orientation === 'left') {
                    css(this.rootEl, {
                        left: '0',
                        right: '',
                    });
                } else {
                    css(this.rootEl, {
                        left: '',
                        right: '0',
                    });
                }
            }
            this.rootEl.style.display = 'block';
        } else {
            this.rootEl.style.display = 'none';
        }
    }

    setOrientation(orientation: TUiLayout): void {
        this.orientation = orientation;
        this.toolspaceCollapser.setOrientation(orientation);
    }

    setIsVisible(b: boolean): void {
        this.isVisible = b;
    }

    getToolspaceIsOpen(): boolean {
        return this.toolspaceIsOpen;
    }

    setToolspaceIsOpen(b: boolean): void {
        this.toolspaceIsOpen = b;
        this.toolspaceCollapser.setIsOpen(b);
        this.onShowToolspace(b);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
