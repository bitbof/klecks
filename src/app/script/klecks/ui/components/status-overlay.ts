import { BB } from '../../../bb/bb';
import angleSvg from '/src/app/img/ui/angle.svg';

type TUiState = 'left' | 'right';

/**
 * display little messages at the top of KlWorkspace
 */
export class StatusOverlay {
    private readonly el: HTMLDivElement;
    private readonly innerEl: HTMLDivElement;
    private readonly angleIm: HTMLImageElement;
    private readonly innerInnerEl: HTMLDivElement;
    private isWide: boolean = false; // tool space hidden
    private uiState: TUiState = 'right';

    private timeout: ReturnType<typeof setTimeout> | undefined;
    private timeout2: ReturnType<typeof setTimeout> | undefined;
    private timeout3: ReturnType<typeof setTimeout> | undefined;

    private updateUiState() {
        if (this.uiState === 'left') {
            this.el.style.left = '271px';
        } else {
            this.el.style.removeProperty('left');
        }
    }

    // ----------------------------------- public -----------------------------------

    constructor() {
        this.el = BB.el({
            className: 'top-overlay g-root',
            onClick: BB.handleClick,
        });

        this.updateUiState();

        this.innerEl = BB.el({
            className: 'top-overlay--inner',
        });

        this.angleIm = new Image();
        this.angleIm.src = angleSvg;
        BB.css(this.angleIm, {
            verticalAlign: 'bottom',
            width: '20px',
            height: '20px',
            marginLeft: '5px',
            borderRadius: '10px',
        });

        this.innerInnerEl = document.createElement('div');
        this.innerInnerEl.style.display = 'inline-block';

        this.innerEl.append(this.innerInnerEl, this.angleIm);
        this.el.append(this.innerEl);
        document.body.append(this.el);
        this.el.style.display = 'none';
    }

    setWide(b: boolean) {
        this.isWide = b;

        if (!this.el) {
            return;
        }

        if (this.isWide) {
            this.el.style.width = '100%';
            this.el.style.left = '';
        } else {
            this.el.style.removeProperty('width');
            this.el.style.left = this.uiState === 'left' ? '271px' : '';
        }
    }

    setUiState(state: TUiState) {
        this.uiState = state;
        this.updateUiState();
    }

    out(msg: string | { type: 'transform'; angleDeg: number; scale: number }, doPulse?: boolean) {
        if (typeof msg === 'string') {
            this.angleIm.style.display = 'none';
            this.innerInnerEl.style.removeProperty('font-family');
            this.innerInnerEl.innerHTML = msg;
        } else {
            if (msg.type === 'transform') {
                this.angleIm.style.display = 'inline-block';
                this.angleIm.style.transform = 'rotate(' + msg.angleDeg + 'deg)';

                if (msg.angleDeg % 90 === 0) {
                    this.angleIm.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.7)';
                } else {
                    this.angleIm.style.boxShadow = '';
                }

                this.innerInnerEl.style.fontFamily = 'monospace';
                this.innerInnerEl.innerHTML = Math.round(msg.scale * 100) + '%';
            } else {
                this.angleIm.style.display = 'none';
            }
        }

        if (doPulse) {
            this.innerEl.style.animation = '';
            setTimeout(() => (this.innerEl.style.animation = 'topOverlayPulse 0.5s ease-out'), 20);
            clearTimeout(this.timeout3);
            this.timeout3 = setTimeout(() => (this.innerEl.style.animation = ''), 520);
        }

        clearTimeout(this.timeout);
        clearTimeout(this.timeout2);
        this.el.style.animationName = doPulse ? 'consoleInFast' : 'consoleIn';
        this.el.style.opacity = '1';
        this.timeout = setTimeout(() => {
            this.el.style.opacity = '0';
            this.el.style.animationName = 'consoleOut';
            this.timeout2 = setTimeout(() => {
                this.el.style.display = 'none';
            }, 450);
        }, 1200);
        this.el.style.display = 'flex';
    }
}
