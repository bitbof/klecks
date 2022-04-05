import {BB} from '../../../bb/bb';
// @ts-ignore
import angleSvg from 'url:~/src/app/img/ui/angle.svg';


type TUiState = 'left' | 'right';

/**
 * display little messages at the top of KlWorkspace
 */
export class StatusOverlay {

    private el: HTMLDivElement;
    private innerEl: HTMLDivElement;
    private angleIm: HTMLImageElement;
    private innerInnerEl: HTMLDivElement;
    private isWide: boolean;
    private uiState: TUiState;

    private timeout: number;
    private timeout2: number;
    private timeout3: number;

    private updateUiState() {
        if (!this.el) {
            return;
        }
        setTimeout(()=>{}, 100);
        if (this.uiState === 'left') {
            this.el.style.left = '271px';
        } else {
            this.el.style.removeProperty('left');
        }
    }

    private init() {
        this.el = BB.el({
            className: "top-overlay g-root",
            onClick: BB.handleClick,
        }) as HTMLDivElement;

        if (this.isWide) {
            this.el.style.width = '100%';
        }

        this.updateUiState();

        this.innerEl = BB.el({
            className: 'top-overlay-inner',
        }) as HTMLDivElement


        this.angleIm = new Image();
        this.angleIm.src = angleSvg;
        BB.css(this.angleIm, {
            verticalAlign: 'bottom',
            width: '20px',
            height: '20px',
            marginLeft: '5px',
            borderRadius: '10px'
        });

        this.innerInnerEl = document.createElement('div');
        this.innerInnerEl.style.display = 'inline-block';

        this.innerEl.appendChild(this.innerInnerEl);
        this.innerEl.appendChild(this.angleIm);
        this.el.appendChild(this.innerEl);
        document.body.appendChild(this.el);
        this.el.style.display = "none";
    }


    // --- public ---

    constructor () {
        this.init();
    }

    setWide(b: boolean) {
        this.isWide = !!b;

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

    out(msg: string | {type: 'transform', angleDeg: number, scale: number}, doPulse?: boolean) {

        if (msg && typeof msg === 'object') {

            if (msg.type === 'transform') {
                this.angleIm.style.display = 'inline-block';
                this.angleIm.style.transform = 'rotate(' + msg.angleDeg + 'deg)';

                if (msg.angleDeg % 90 === 0) {
                    this.angleIm.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.7)';
                } else {
                    this.angleIm.style.boxShadow = '';
                }

                this.innerInnerEl.innerHTML = Math.round(msg.scale * 100) + "%";


            } else {
                this.angleIm.style.display = 'none';
            }



        } else if (typeof msg === 'string') {
            this.angleIm.style.display = 'none';
            this.innerInnerEl.innerHTML = msg;
        }

        if (doPulse) {
            this.innerEl.style.animation = '';
            setTimeout(
                () => this.innerEl.style.animation = 'top-overlay-pulse 0.5s ease-out',
                20
            );
            if (this.timeout3) {
                clearTimeout(this.timeout3);
            }
            this.timeout3 = window.setTimeout(
                () => this.innerEl.style.animation = '',
                520
            );
        }



        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        if (this.timeout2) {
            clearTimeout(this.timeout2);
        }
        this.el.style.animationName = doPulse ? 'consoleInFast' : "consoleIn";
        this.el.style.opacity = "1";
        this.timeout = window.setTimeout(() => {
            this.el.style.opacity = "0";
            this.el.style.animationName = "consoleOut";
            this.timeout2 = window.setTimeout(() => {
                this.el.style.display = "none";
                this.timeout2 = 0;
            }, 450);
            this.timeout = 0;
        }, 1200);
        this.el.style.display = "flex";
    }


}
