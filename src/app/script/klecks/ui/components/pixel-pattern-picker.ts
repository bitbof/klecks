import { css } from '../../../bb/base/base';
import { ctx, freeCanvas } from '../../../bb/base/canvas';
import { createCanvas } from '../../../bb/base/create-canvas';
import { el } from '../../../bb/base/ui';
import { clamp } from '../../../bb/math/math';
import { TCss } from '../../../bb/bb-types';
import { PointerListener } from '../../../bb/input/pointer-listener';
import { TPointerEvent } from '../../../bb/input/event.types';
import { getIconSvg } from '../../../icon/icon';
import { LANG } from '../../../language/language';
import { TPixelPattern } from '../../brushes/pixel-brush-patterns';
import { InertiaScrolling } from '../easel/inertia-scrolling';
import { Options } from './options';
import * as classes from './pixel-pattern-picker.module.scss';

// patterns are identified by their index
export type TPixelPatternPickerParams = {
    patterns: TPixelPattern[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    // clicked the pattern that is already selected
    onClickSelected: (index: number) => void;
    onAdd: () => void;
    css?: TCss;
};

const FADE_WIDTH = 28; // same as in the CSS
const DRAG_THRESHOLD_PX = 6;
const REVEAL_SPRING_STIFFNESS = 0.00035; // critically damped spring, per ms²

const previewUrlCache = new Map<string, string>();

function createPatternPreview(pattern: TPixelPattern): HTMLElement {
    // displayed at 2x, so it's easier to see
    const key = `${pattern.width}x${pattern.height}:${pattern.data.join('')}`;
    let url = previewUrlCache.get(key);
    if (!url) {
        const canvas = createCanvas(pattern.width * 2, pattern.height * 2);
        const canvasCtx = ctx(canvas);
        pattern.data.forEach((value, i) => {
            if (value) {
                canvasCtx.fillRect(
                    (i % pattern.width) * 2,
                    Math.floor(i / pattern.width) * 2,
                    2,
                    2,
                );
            }
        });
        url = canvas.toDataURL('image/png');
        freeCanvas(canvas);
        previewUrlCache.set(key, url);
    }
    return el({
        className: 'dark-invert',
        css: {
            // padding matches tip preview. option size stays the same (35)
            width: 27,
            height: 27,
            margin: 4,
            backgroundImage: `url(${url})`,
            backgroundSize: `${pattern.width * 2}px ${pattern.height * 2}px`,
            imageRendering: 'pixelated',
        },
    });
}

/**
 * Pixel brush patterns in a single row with a fixed height. The row scrolls sideways when it
 * doesn't fit: drag (mouse, pen, touch) with the same inertia as the canvas, hard stop at the
 * ends. Mouse wheel changes the selection (down -> right). The add button stays visible.
 */
export class PixelPatternPicker {
    private readonly rootEl: HTMLElement;
    private readonly viewportEl: HTMLElement;
    private readonly trackEl: HTMLElement;
    private readonly addButton: HTMLButtonElement;
    private readonly onSelect: (index: number) => void;
    private readonly onClickSelected: (index: number) => void;
    private options: Options<number> | undefined;
    private patterns: TPixelPattern[] = [];
    private selectedIndex: number;

    private scrollX: number = 0;
    private maxScrollX: number = 0;
    private readonly inertiaScrolling: InertiaScrolling;
    private readonly pointerListener: PointerListener;
    private isPointerDown: boolean = false;
    private isDragging: boolean = false;
    private didCatchFling: boolean = false;
    private doSuppressClick: boolean = false;

    // animated scroll that brings the selected pattern into view
    private revealTarget: number | undefined;
    private revealVelocity: number = 0; // px per ms
    private revealAnimationFrame: ReturnType<typeof requestAnimationFrame> | undefined;
    private revealLastMs: number = 0;

    private readonly resizeObserver: ResizeObserver | undefined;
    // hidden, e.g. while another brush is selected
    private isHidden: boolean = true;

    private getIsVisible(): boolean {
        return this.viewportEl.clientWidth > 0;
    }

    private measure(): void {
        // While hidden there's nothing to measure. Keep the old values, so the scroll position
        // is still there when it's shown again.
        if (!this.getIsVisible()) {
            return;
        }
        this.maxScrollX = Math.max(0, this.trackEl.scrollWidth - this.viewportEl.clientWidth);
    }

    // isInstant -> fades switch without transition
    private setScrollX(x: number, isInstant: boolean = false): void {
        this.scrollX = clamp(x, 0, this.maxScrollX);
        this.trackEl.style.transform = `translateX(${-this.scrollX}px)`;
        this.updateFades(isInstant);
    }

    private updateFades(isInstant: boolean = false): void {
        if (!this.getIsVisible()) {
            return;
        }
        if (isInstant) {
            this.viewportEl.style.transition = 'none';
        }
        // Use where it's heading. Otherwise the fade only starts fading out once the slow tail
        // of the animation reaches the end.
        const heading = this.revealTarget ?? this.scrollX;
        this.viewportEl.style.setProperty('--kl-fade-left', heading > 2 ? '1' : '0');
        this.viewportEl.style.setProperty(
            '--kl-fade-right',
            heading < this.maxScrollX - 2 ? '1' : '0',
        );
        if (isInstant) {
            // apply the values before the transition is back
            void this.viewportEl.offsetWidth;
            this.viewportEl.style.transition = '';
        }
    }

    // jump there right away, no animation
    private scrollToInstant(x: number): void {
        this.stopReveal();
        this.setScrollX(x, true);
    }

    private stopReveal(): void {
        if (this.revealAnimationFrame !== undefined) {
            cancelAnimationFrame(this.revealAnimationFrame);
            this.revealAnimationFrame = undefined;
        }
        this.revealTarget = undefined;
        this.revealVelocity = 0;
    }

    private revealLoop(): void {
        this.revealAnimationFrame = requestAnimationFrame(() => this.revealLoop());
        const nowMs = performance.now();
        let remainingMs = Math.min(32, nowMs - this.revealLastMs);
        this.revealLastMs = nowMs;
        const target = this.revealTarget!;
        const k = REVEAL_SPRING_STIFFNESS;
        let x = this.scrollX;
        // small fixed sub steps keep the spring stable
        while (remainingMs > 0) {
            const dt = Math.min(4, remainingMs);
            remainingMs -= dt;
            this.revealVelocity +=
                (-k * (x - target) - 2 * Math.sqrt(k) * this.revealVelocity) * dt;
            x += this.revealVelocity * dt;
        }
        if (Math.abs(x - target) < 0.3 && Math.abs(this.revealVelocity) < 0.02) {
            this.stopReveal();
            this.setScrollX(target);
            return;
        }
        this.setScrollX(x);
    }

    private scrollToAnimated(x: number): void {
        const target = clamp(x, 0, this.maxScrollX);
        if (target === this.scrollX) {
            this.stopReveal();
            return;
        }
        this.revealTarget = target;
        if (this.revealAnimationFrame === undefined) {
            this.revealLastMs = performance.now();
            this.revealAnimationFrame = requestAnimationFrame(() => this.revealLoop());
        }
        this.updateFades();
    }

    // keep selected pattern in view, clear of the fades
    private revealSelected(isAnimated: boolean): void {
        if (!this.getIsVisible()) {
            return; // happens when it's shown again
        }
        this.measure();
        const scrollTo = (x: number): void =>
            isAnimated ? this.scrollToAnimated(x) : this.scrollToInstant(x);
        const index = this.selectedIndex;
        if (index === this.patterns.length - 1) {
            scrollTo(this.maxScrollX);
            return;
        }
        const button = this.trackEl.querySelectorAll('button')[index];
        if (!button) {
            return;
        }
        const left = button.offsetLeft;
        const right = left + button.offsetWidth;
        const current = this.revealTarget ?? this.scrollX;
        const width = this.viewportEl.clientWidth;
        if (left < current + FADE_WIDTH) {
            scrollTo(left - FADE_WIDTH);
        } else if (right > current + width - FADE_WIDTH) {
            scrollTo(right - width + FADE_WIDTH);
        }
    }

    private onPointer(e: TPointerEvent): void {
        if (e.type === 'pointerdown') {
            if (e.button !== 'left') {
                return;
            }
            this.isPointerDown = true;
            this.isDragging = false;
            this.stopReveal();
            this.measure();
            // a tap that stops a moving row doesn't pick anything
            this.didCatchFling = this.inertiaScrolling.getIsActive();
            this.inertiaScrolling.dragStart();
        }
        if (e.type === 'pointermove' && e.button === 'left' && this.isPointerDown) {
            if (!this.isDragging) {
                if (Math.abs(e.pageX - (e.downPageX ?? e.pageX)) < DRAG_THRESHOLD_PX) {
                    return;
                }
                this.isDragging = true;
            }
            this.setScrollX(this.scrollX - e.dX);
            this.inertiaScrolling.dragMove(e.dX, 0);
        }
        if (e.type === 'pointerup' && this.isPointerDown) {
            this.isPointerDown = false;
            this.inertiaScrolling.dragEnd();
            if (this.isDragging || this.didCatchFling) {
                this.doSuppressClick = true;
                setTimeout(() => (this.doSuppressClick = false));
            }
            this.isDragging = false;
        }
    }

    private readonly onClickCapture = (e: MouseEvent): void => {
        if (this.doSuppressClick) {
            e.stopPropagation();
            e.preventDefault();
        }
    };

    // trackpads: sideways swipe scrolls. (vertical is handled by the pointer listener)
    private readonly onNativeWheel = (e: WheelEvent): void => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) {
            return;
        }
        e.preventDefault();
        this.stopReveal();
        this.measure();
        this.setScrollX(this.scrollX + e.deltaX);
    };

    // hidden overflow can still be scrolled by the browser, e.g. when focusing a button
    private readonly onNativeScroll = (): void => {
        this.viewportEl.scrollLeft = 0;
    };

    // ----------------------------------- public -----------------------------------

    constructor(p: TPixelPatternPickerParams) {
        this.onSelect = p.onSelect;
        this.onClickSelected = p.onClickSelected;
        this.selectedIndex = p.selectedIndex;

        this.trackEl = el({ className: classes.track });
        this.viewportEl = el({
            className: classes.viewport,
            content: [this.trackEl],
        });
        this.viewportEl.addEventListener('click', this.onClickCapture, true);
        this.viewportEl.addEventListener('wheel', this.onNativeWheel, { passive: false });
        this.viewportEl.addEventListener('scroll', this.onNativeScroll);

        this.addButton = el({
            tagName: 'button',
            className: ['kl-button', classes.addButton],
            title: LANG('brush-pixel-pattern-add'),
            content: [getIconSvg('add-layer', { width: 20, height: 20 })],
            onClick: () => p.onAdd(),
        });
        this.addButton.type = 'button';
        this.addButton.tabIndex = -1;

        this.rootEl = el({
            className: classes.root,
            content: [this.viewportEl, this.addButton],
        });
        p.css && css(this.rootEl, p.css);

        this.inertiaScrolling = new InertiaScrolling({
            getTransform: () => ({
                scale: 1,
                angleDeg: 0,
                x: -this.scrollX,
                y: 0,
                isMirrored: false,
            }),
            // clamping at the ends makes the inertia stop (it notices the transform changed)
            setTransform: (transform) => this.setScrollX(-transform.x),
        });
        this.inertiaScrolling.setIsEnabled(true);

        this.pointerListener = new PointerListener({
            target: this.viewportEl,
            onPointer: (e) => this.onPointer(e),
            onWheel: (e) => {
                e.event?.preventDefault();
                // down -> right, up -> left
                const newIndex = clamp(this.selectedIndex + e.deltaY, 0, this.patterns.length - 1);
                if (newIndex !== this.selectedIndex) {
                    this.options?.setValue(newIndex);
                }
            },
        });

        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver(() => {
                if (!this.getIsVisible()) {
                    this.isHidden = true;
                    return;
                }
                this.measure();
                if (this.isHidden) {
                    // shown again (e.g. switched back to this brush): no fade transition,
                    // selected pattern in view right away
                    this.isHidden = false;
                    this.scrollToInstant(this.scrollX);
                    this.revealSelected(false);
                } else {
                    this.setScrollX(this.scrollX);
                }
            });
            this.resizeObserver.observe(this.viewportEl);
        }

        this.setPatterns(p.patterns, p.selectedIndex);
    }

    // replaces all patterns, e.g. after adding or editing one
    setPatterns(patterns: TPixelPattern[], selectedIndex: number): void {
        const didSelectionChange = selectedIndex !== this.selectedIndex;
        this.patterns = patterns;
        this.selectedIndex = selectedIndex;
        this.options?.destroy();
        this.options = new Options<number>({
            optionArr: patterns.map((pattern, index) => ({
                id: index,
                label: createPatternPreview(pattern),
            })),
            initId: selectedIndex,
            onChange: (index) => {
                this.selectedIndex = index;
                this.revealSelected(true);
                this.onSelect(index);
            },
            onClickSelected: (index) => this.onClickSelected(index),
            ariaLabel: LANG('brush-pixel-dither'),
        });
        this.trackEl.append(this.options.getElement());
        this.measure();
        this.scrollToInstant(this.scrollX);
        if (didSelectionChange) {
            // e.g. after creating a pattern. jump, no animation
            this.revealSelected(false);
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.stopReveal();
        this.options?.destroy();
        this.pointerListener.destroy();
        this.resizeObserver?.disconnect();
        this.viewportEl.removeEventListener('click', this.onClickCapture, true);
        this.viewportEl.removeEventListener('wheel', this.onNativeWheel);
        this.viewportEl.removeEventListener('scroll', this.onNativeScroll);
        this.rootEl.remove();
    }
}
