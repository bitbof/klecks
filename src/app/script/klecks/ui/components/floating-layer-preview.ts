import { BB } from '../../../bb/bb';
import { css } from '../../../bb/base/base';
import { TUiLayout } from '../../kl-types';
import * as classes from './floating-layer-preview.module.scss';

const animationDurationMs = 300;

export class FloatingLayerPreview {
    private readonly rootEl: HTMLElement;
    private uiState: TUiLayout = 'right';
    private timeout: ReturnType<typeof setTimeout> | undefined;

    // ----------------------- public -----------------------
    constructor() {
        this.rootEl = BB.el({
            className: classes.root,
            css: {
                transition: 'opacity ' + animationDurationMs + 'ms ease-in-out',
            },
        });
    }

    show(image: HTMLCanvasElement | HTMLImageElement, yCenter: number): void {
        clearTimeout(this.timeout);
        this.timeout = undefined;

        if (this.rootEl.parentElement) {
            css(this.rootEl, {
                top: Math.max(10, Math.round(yCenter - image?.height / 2)),
                opacity: 1,
            });
            this.rootEl.replaceChildren(image);
            return;
        }

        this.timeout = setTimeout(() => {
            css(this.rootEl, {
                top: Math.max(10, Math.round(yCenter - image?.height / 2)),
                opacity: 0,
            });
            this.rootEl.replaceChildren(image);
            document.body.append(this.rootEl);
            this.timeout = setTimeout(() => {
                css(this.rootEl, {
                    opacity: 1,
                });
            }, 20);
        }, 250);
    }

    hide(): void {
        clearTimeout(this.timeout);
        this.timeout = undefined;

        css(this.rootEl, {
            opacity: 0,
        });
        this.timeout = setTimeout(() => {
            this.rootEl.remove();
            this.rootEl.replaceChildren();
        }, animationDurationMs + 20);
    }

    setUiState(stateStr: TUiLayout): void {
        this.uiState = stateStr;

        if (this.uiState === 'left') {
            css(this.rootEl, {
                left: 280,
                right: undefined,
            });
        } else {
            css(this.rootEl, {
                left: undefined,
                right: 280,
            });
        }
    }
}
