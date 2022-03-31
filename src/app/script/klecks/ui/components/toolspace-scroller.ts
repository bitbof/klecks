import {BB} from '../../../bb/bb';
// @ts-ignore
import caretImg from 'url:~/src/app/img/ui/caret-down.svg';
import {IKeyString} from '../../../bb/bb.types';
import {LANG} from '../../../language/language';
import {dialogCounter} from '../modals/modal-count';

/**
 * Scroll buttons at the top and bottom of toolspace
 * Show up when window is very small.
 * Allow user to scroll up and down toolspace.
 */
export class ToolspaceScroller {

    private toolspace: HTMLElement;
    private upBtn: HTMLElement;
    private downBtn: HTMLElement;
    private downInterval: any;
    private upInterval: any;

    private update(): void {
        if (this.toolspace.scrollHeight > this.toolspace.offsetHeight + 3) { // small buffer where it's not worth it
            if (!this.upInterval) {
                this.upBtn.style.display = this.toolspace.scrollTop === 0 ? 'none' : 'block';
            }
            if (!this.downInterval) {
                this.downBtn.style.display = (
                    this.toolspace.scrollTop + this.toolspace.offsetHeight + 1 >= this.toolspace.scrollHeight ?
                        'none' : 'block'
                );
            }
        } else {
            this.upBtn.style.display = 'none';
            this.downBtn.style.display = 'none';
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
            userSelect: 'none',
        };

        this.toolspace = p.toolspace;
        this.upBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            css: {
                ...btnStyle,
                top: '0',
                transform: 'rotate(180deg)',
            }
        });
        this.downBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            css: {
                ...btnStyle,
                bottom: '0',
            }
        });
        this.updateUiState(p.uiState);

        const upListener = new BB.PointerListener({
            target: this.upBtn,
            onPointer: (e) => {
                if (e.type === 'pointerdown') {
                    this.upInterval = setInterval(() => {
                        this.toolspace.scrollBy(0, -10);
                        this.update();
                    }, 20);
                }
                if (e.type === 'pointerup') {
                    clearInterval(this.upInterval);
                    setTimeout(() => { // prevent ff pressing anything underneath
                        this.upInterval = null;
                        this.update()
                    }, 50);
                }
            },
            onWheel: (e) => {
                this.toolspace.scrollBy(0, 20 * e.deltaY);
                this.update();
            },
        });
        const downListener = new BB.PointerListener({
            target: this.downBtn,
            onPointer: (e) => {
                if (e.type === 'pointerdown') {
                    this.downInterval = setInterval(() => {
                        this.toolspace.scrollBy(0, 10);
                        this.update();
                    }, 20);
                }
                if (e.type === 'pointerup') {
                    clearInterval(this.downInterval);
                    setTimeout(() => { // prevent ff pressing anything underneath
                        this.downInterval = null;
                        this.update()
                    }, 50);
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

        // hide if in dialog because that can have its own scrollbar
        dialogCounter.subscribe((v) => {
            // ignores the 0.5 by tool dropdown
            this.upBtn.style.opacity = v >= 1 ? '0' : '';
            this.downBtn.style.opacity = v >= 1 ? '0' : '';
        });
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