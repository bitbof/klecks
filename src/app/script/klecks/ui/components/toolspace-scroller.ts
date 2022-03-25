import {BB} from '../../../bb/bb';
// @ts-ignore
import caretImg from 'url:~/src/app/img/ui/caret-down.svg';
import {IKeyString} from '../../../bb/bb.types';
import {LANG} from '../../../language/language';

/**
 * Scroll buttons at the top and bottom of toolspace
 * Show up when window is very small.
 * Allow user to scroll up and down toolspace.
 */
export class ToolspaceScroller {

    private toolspace: HTMLElement;
    private downBtn: HTMLElement;
    private upBtn: HTMLElement;

    private update(): void {
        if (this.toolspace.scrollHeight > this.toolspace.offsetHeight) {
            this.downBtn.style.display = (
                this.toolspace.scrollTop + this.toolspace.offsetHeight === this.toolspace.scrollHeight ?
                    'none' : 'block'
            );
            this.upBtn.style.display = this.toolspace.scrollTop === 0 ? 'none' : 'block';
        } else {
            this.downBtn.style.display = 'none';
            this.upBtn.style.display = 'none';
        }
    }

    // --- public ---
    constructor(p: {toolspace: HTMLElement, uiState: 'left' | 'right'}) {
        const btnStyle: IKeyString = {
            position: 'fixed',
            cursor: 'pointer',
            background: 'rgba(155, 155, 155, 0.9)',
            filter: 'invert(1)',
            width: '36px',
            height: '36px',
            backgroundImage: `url(${caretImg})`,
            backgroundSize: '60%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        };

        this.toolspace = p.toolspace;
        this.downBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            css: {
                ...btnStyle,
                bottom: '0',
            }
        });
        this.upBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            css: {
                ...btnStyle,
                top: '0',
                transform: 'rotate(180deg)',
            }
        });
        this.updateUiState(p.uiState);

        let downInterval;
        const downListener = new BB.PointerListener({
            target: this.downBtn,
            onPointer: (e) => {
                if (e.type === 'pointerdown') {
                    downInterval = setInterval(() => {
                        this.toolspace.scrollBy(0, 10);
                        this.update();
                    }, 20);
                }
                if (e.type === 'pointerup') {
                    clearInterval(downInterval);
                }
            },
            onWheel: (e) => {
                this.toolspace.scrollBy(0, 20 * e.deltaY);
                this.update();
            },
        });
        const upListener = new BB.PointerListener({
            target: this.upBtn,
            onPointer: (e) => {
                if (e.type === 'pointerdown') {
                    downInterval = setInterval(() => {
                        this.toolspace.scrollBy(0, -10);
                        this.update();
                    }, 20);
                }
                if (e.type === 'pointerup') {
                    clearInterval(downInterval);
                }
            },
            onWheel: (e) => {
                this.toolspace.scrollBy(0, 20 * e.deltaY);
                this.update();
            },
        });

        this.update();

        const observer = new MutationObserver(() => this.update());
        observer.observe(
            this.toolspace,
            {
                attributes: true,
                childList: true,
                subtree: true,
            }
        );
        window.addEventListener('resize', () => this.update());
    }

    updateUiState (uiState: 'left' | 'right'): void {
        BB.css(this.upBtn, {
            left: uiState === 'left' ? '0' : null,
            right: uiState === 'right' ? '0' : null,
        });
        BB.css(this.downBtn, {
            left: uiState === 'left' ? '0' : null,
            right: uiState === 'right' ? '0' : null,
        });
    }
}