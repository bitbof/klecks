import { BB } from '../../../bb/bb';
import { ToolspaceCollapser } from './toolspace-collapser';
import { KL } from '../../kl';
import { TUiLayout } from '../../kl-types';

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

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileUiParams) {
        this.toolspaceCollapser = new KL.ToolspaceCollapser({
            onChange: () => {
                this.toolspaceIsOpen = this.toolspaceCollapser.isOpen();
                p.onShowToolspace(this.toolspaceIsOpen);
            },
        });

        this.mobileWrapperEl = BB.el({
            css: {
                marginTop: '4px',
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
                    BB.css(this.rootEl, {
                        left: '271px',
                        right: '',
                    });
                } else {
                    BB.css(this.rootEl, {
                        left: '',
                        right: '271px',
                    });
                }
            } else {
                this.mobileWrapperEl.style.display = 'block';
                if (this.orientation === 'left') {
                    BB.css(this.rootEl, {
                        left: '0',
                        right: '',
                    });
                } else {
                    BB.css(this.rootEl, {
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

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
