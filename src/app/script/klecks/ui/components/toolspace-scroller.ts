import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { dialogCounter } from '../modals/modal-count';

/**
 * Scroll buttons at the top and bottom of toolspace
 * Show up when window is very small.
 * Allow user to scroll up and down toolspace.
 */
export class ToolspaceScroller {
    private readonly toolspace: HTMLElement;
    private readonly upBtn: HTMLElement;
    private readonly downBtn: HTMLElement;
    private downInterval: any;
    private upInterval: any;

    private update(): void {
        let newUpDisplay = this.upBtn.style.display;
        let newDownDisplay = this.downBtn.style.display;
        if (this.toolspace.scrollHeight > this.toolspace.offsetHeight + 3) {
            // small buffer where it's not worth it
            if (!this.upInterval) {
                newUpDisplay = this.toolspace.scrollTop === 0 ? 'none' : 'block';
            }
            if (!this.downInterval) {
                newDownDisplay =
                    this.toolspace.scrollTop + this.toolspace.offsetHeight + 1 >=
                    this.toolspace.scrollHeight
                        ? 'none'
                        : 'block';
            }
        } else {
            newUpDisplay = 'none';
            newDownDisplay = 'none';
        }
        // check to prevent infinite MutationObserver loop in Pale Moon
        if (newUpDisplay !== this.upBtn.style.display) {
            this.upBtn.style.display = newUpDisplay;
        }
        if (newDownDisplay !== this.downBtn.style.display) {
            this.downBtn.style.display = newDownDisplay;
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: { toolspace: HTMLElement; uiState: 'left' | 'right' }) {
        this.toolspace = p.toolspace;
        this.upBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            className: 'kl-scroller',
            css: {
                top: '0',
                transform: 'rotate(180deg)',
            },
        });
        this.downBtn = BB.el({
            parent: this.toolspace,
            title: LANG('scroll'),
            className: 'kl-scroller',
            css: {
                bottom: '0',
            },
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
                    setTimeout(() => {
                        // prevent ff pressing anything underneath
                        this.upInterval = null;
                        this.update();
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
                    setTimeout(() => {
                        // prevent ff pressing anything underneath
                        this.downInterval = null;
                        this.update();
                    }, 50);
                }
            },
        });

        const wheelListener = (e: WheelEvent) => {
            this.toolspace.scrollBy(0, Math.round(0.7 * e.deltaY));
            this.update();
        };
        this.upBtn.addEventListener('wheel', wheelListener, { passive: false });
        this.downBtn.addEventListener('wheel', wheelListener, { passive: false });

        this.update();

        const observer = new MutationObserver(() => this.update());
        observer.observe(this.toolspace, {
            attributes: true,
            childList: true,
            subtree: true,
        });
        window.addEventListener('resize', () => this.update());

        // hide if in dialog because that can have its own scrollbar
        dialogCounter.subscribe((v) => {
            // ignores the 0.5 by tool dropdown
            this.upBtn.style.opacity = v >= 1 ? '0' : '';
            this.downBtn.style.opacity = v >= 1 ? '0' : '';
        });
    }

    updateUiState(uiState: 'left' | 'right'): void {
        BB.css(this.upBtn, {
            left: uiState === 'left' ? '0' : '',
            right: uiState === 'right' ? '0' : '',
        });
        BB.css(this.downBtn, {
            left: uiState === 'left' ? '0' : '',
            right: uiState === 'right' ? '0' : '',
        });
    }
}
