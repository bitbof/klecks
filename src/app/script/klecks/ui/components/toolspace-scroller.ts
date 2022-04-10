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
        this.toolspace = p.toolspace;
        this.upBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            className: 'kl-scroller',
            css: {
                top: '0',
                transform: 'rotate(180deg)',
            }
        });
        this.downBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            className: 'kl-scroller',
            css: {
                bottom: '0',
            }
        });
        this.updateUiState(p.uiState);

        const upListener = new BB.PointerListener({
            target: this.upBtn,
            onPointer: (e) => {
                if (e.type === 'pointerdown') {
                    this.upInterval = setInterval(() => {
                        this.toolspace.scrollBy(0, -13);
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
        });
        const downListener = new BB.PointerListener({
            target: this.downBtn,
            onPointer: (e) => {
                if (e.type === 'pointerdown') {
                    this.downInterval = setInterval(() => {
                        this.toolspace.scrollBy(0, 13);
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
            }
        });

        const wheelListener = (e: WheelEvent) => {
            this.toolspace.scrollBy(0, Math.round(0.7 * e.deltaY));
            this.update();
        };
        this.upBtn.addEventListener('wheel', wheelListener);
        this.downBtn.addEventListener('wheel', wheelListener);

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