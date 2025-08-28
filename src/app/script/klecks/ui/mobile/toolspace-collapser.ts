import { BB } from '../../../bb/bb';
import collapseImg from 'url:/src/app/img/ui/ui-collapse.svg';
import { LANG } from '../../../language/language';
import { TUiLayout } from '../../kl-types';

/**
 * button that allows to collapse toolspace (for mobile)
 */
export class ToolspaceCollapser {
    private readonly rootEl: HTMLElement;
    private orientation: TUiLayout;
    private readonly icon: HTMLElement;
    private stateIsOpen: boolean;

    private update(): void {
        if (this.orientation === 'left') {
            this.icon.style.transform = this.stateIsOpen ? 'rotate(180deg)' : '';
        } else {
            this.icon.style.transform = this.stateIsOpen ? '' : 'rotate(180deg)';
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: { onChange: () => void }) {
        this.stateIsOpen = true;
        this.orientation = 'right';

        this.rootEl = BB.el({
            className: 'kl-toolspace-toggle',
            css: {
                width: '36px',
                height: '36px',
                background: 'rgba(100, 100, 100, 0.9)',
                color: '#fff',
                textAlign: 'center',
                lineHeight: '36px',
                cursor: 'pointer',
                userSelect: 'none',
                padding: '6px',
                boxSizing: 'border-box',
            },
            title: LANG('toggle-show-tools'),
            onClick: (e) => {
                e.preventDefault();
                this.stateIsOpen = !this.stateIsOpen;
                this.update();
                p.onChange();
            },
        });

        this.icon = BB.el({
            parent: this.rootEl,
            css: {
                backgroundImage: `url(${collapseImg})`,
                width: '100%',
                height: '100%',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                userSelect: 'none',
            },
        });
        this.update();
        this.rootEl.oncontextmenu = () => {
            return false;
        };
    }

    // ---- interface ----

    isOpen(): boolean {
        return this.stateIsOpen;
    }

    setIsOpen(b: boolean): void {
        this.stateIsOpen = b;
        this.update();
    }

    setOrientation(dirStr: TUiLayout): void {
        this.orientation = dirStr;
        this.update();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
