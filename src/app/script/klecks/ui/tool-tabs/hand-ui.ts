import { BB } from '../../../bb/bb';
import angleImg from '/src/app/img/ui/angle.svg';
import rotateImg from '/src/app/img/ui/edit-rotate.svg';
import { LANG } from '../../../language/language';
import { Checkbox } from '../components/checkbox';

const LS_INERTIA_KEY = 'kl-inertia-scroll';

/**
 * Ui, when hand tool tab is open.
 */
export class HandUi {
    private readonly rootEl: HTMLElement;
    private readonly onAngleChange: (angleDeg: number, isRelative?: boolean) => void;
    private isVisible: boolean = true;
    private scale: number;
    private angleDeg: number;
    private readonly scaleEl: HTMLElement;
    private readonly angleEl: HTMLElement;
    private readonly angleIm: HTMLImageElement;

    private updateUi(): void {
        this.scaleEl.innerHTML = Math.round(this.scale * 100) + '%';
        this.angleEl.innerHTML = Math.round(this.angleDeg) + '°';

        this.angleIm.style.transform = 'rotate(' + this.angleDeg + 'deg)';
        if (this.angleDeg % 90 === 0) {
            this.angleIm.style.boxShadow =
                'inset 0 0 0 1px rgba(255,255,255, 1), 0 0 0 1px rgba(0, 0, 0, 0.3)';
        } else {
            this.angleIm.style.boxShadow = '';
        }
    }

    // ----------------------------------- public -----------------------------------

    constructor(p: {
        scale: number; // initial value
        angleDeg: number; // initial value
        onReset: () => void;
        onFit: () => void;
        onAngleChange: (angleDeg: number, isRelative?: boolean) => void;
        onChangeUseInertiaScrolling: (b: boolean) => void;
    }) {
        this.rootEl = BB.el({
            css: {
                margin: '10px',
            },
        });
        this.scale = p.scale;
        this.angleDeg = p.angleDeg;
        this.onAngleChange = p.onAngleChange;

        const row1 = BB.el({
            css: {
                marginBottom: '10px',
                display: 'flex',
            },
        });
        const row2 = BB.el({
            css: {
                display: 'flex',
                marginBottom: '10px',
            },
        });
        const row3 = BB.el({
            css: {
                display: 'flex',
            },
        });
        this.rootEl.append(row1, row2, row3);

        this.scaleEl = BB.el({
            css: {
                width: '65px',
                userSelect: 'none',
                fontFamily: 'monospace',
            },
        });
        row1.append(this.scaleEl);

        this.angleIm = new Image();
        this.angleIm.src = angleImg;
        BB.css(this.angleIm, {
            verticalAlign: 'bottom',
            width: '20px',
            height: '20px',
            marginRight: '5px',
            borderRadius: '10px',
            background: 'rgba(0,0,0,0.2)',
            userSelect: 'none',
        });
        row1.append(this.angleIm);

        this.angleEl = BB.el({
            parent: row1,
            css: {
                userSelect: 'none',
            },
        });

        this.updateUi();

        const resetButton = BB.el({
            tagName: 'button',
            content: LANG('hand-reset'),
            onClick: p.onReset,
        });
        BB.makeUnfocusable(resetButton);

        const fitButton = BB.el({
            tagName: 'button',
            content: LANG('hand-fit'),
            css: {
                marginLeft: '10px',
            },
            onClick: p.onFit,
        });
        BB.makeUnfocusable(fitButton);
        row2.append(resetButton, fitButton);

        const leftRotateButton = BB.el({
            tagName: 'button',
            content:
                '<img height="20" src="' +
                rotateImg +
                '" alt="Rotate" style="transform: scale(-1, 1)"/>',
            onClick: function () {
                p.onAngleChange(-15, true);
            },
        });
        BB.makeUnfocusable(leftRotateButton);

        const resetAngleButton = BB.el({
            tagName: 'button',
            content: '0°',
            css: {
                marginLeft: '10px',
            },
            onClick: function () {
                p.onAngleChange(0);
            },
        });
        BB.makeUnfocusable(resetAngleButton);

        const rightRotateButton = BB.el({
            tagName: 'button',
            content: '<img height="20" src="' + rotateImg + '" alt="Rotate"/>',
            css: {
                marginLeft: '10px',
            },
            onClick: function () {
                p.onAngleChange(15, true);
            },
        });
        BB.makeUnfocusable(rightRotateButton);
        row3.append(leftRotateButton, resetAngleButton, rightRotateButton);

        const inertiaToggle = new Checkbox({
            label: LANG('hand-inertia-scrolling'),
            init: localStorage.getItem(LS_INERTIA_KEY) === 'true',
            callback: (b) => {
                localStorage.setItem(LS_INERTIA_KEY, '' + b);
                p.onChangeUseInertiaScrolling(b);
            },
        });
        setTimeout(() => {
            p.onChangeUseInertiaScrolling(inertiaToggle.getValue());
        }, 500);
        BB.css(inertiaToggle.getElement(), {
            marginTop: '10px',
            display: 'inline-block',
        });
        this.rootEl.append(inertiaToggle.getElement());
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    setIsVisible(pIsVisible: boolean): void {
        this.isVisible = !!pIsVisible;
        this.rootEl.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.updateUi();
        }
    }

    update(pScale: number, pAngleDeg: number): void {
        this.scale = pScale;
        this.angleDeg = pAngleDeg;
        if (this.isVisible) {
            this.updateUi();
        }
    }
}
