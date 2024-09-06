import { IVector2D } from '../../../bb/bb-types';
import { TViewportTransform } from '../project-viewport/project-viewport';
import { BB } from '../../../bb/bb';

export type TInertiaScrollingParams = {
    getTransform: () => TViewportTransform;
    setTransform: (transform: TViewportTransform) => void;
};

/**
 * flings the viewport into the direction the pointer was dragging
 */
export class InertiaScrolling {
    // from params
    private getTransform: () => TViewportTransform;
    private setTransform: (transform: TViewportTransform) => void;

    private readonly defaultDeltaMs = 1000 / 60; // time factor is 1 for 60fps, 2 for 120fps
    private momentum: IVector2D = { x: 0, y: 0 };
    private isDragging: boolean = false;
    private lastDragTimestamp: number = 0;
    private lastTransform: TViewportTransform | undefined;
    private animationFrameHandle: ReturnType<typeof requestAnimationFrame> | undefined;
    private lastTimestamp: number = 0;
    private isEnabled: boolean = false;

    private stop(): void {
        if (this.animationFrameHandle === undefined) {
            return;
        }
        cancelAnimationFrame(this.animationFrameHandle);
        this.animationFrameHandle = undefined;
    }

    private dampen(timeFactor: number): void {
        const vecLen = BB.Vec2.len(this.momentum);

        if (vecLen < 0.3) {
            this.momentum.x = 0;
            this.momentum.y = 0;
            this.stop();
        } else if (vecLen < 5) {
            this.momentum.x *= 0.85 ** timeFactor;
            this.momentum.y *= 0.85 ** timeFactor;
        } else {
            this.momentum.x *= 0.95 ** timeFactor;
            this.momentum.y *= 0.95 ** timeFactor;
        }
    }

    // only call through requestAnimationFrame when animationFrameHandle undefined
    private physicsLoop(): void {
        this.animationFrameHandle = requestAnimationFrame(() => this.physicsLoop());
        const nowMs = performance.now();
        const deltaMs = nowMs - this.lastTimestamp;
        const timeFactor = deltaMs / this.defaultDeltaMs;
        this.lastTimestamp = nowMs;
        if ((this.momentum.x === 0 && this.momentum.y === 0) || this.isDragging) {
            if (this.isDragging) {
                this.dampen(timeFactor);
            } else {
                this.stop();
            }
            return;
        }
        const transform = this.getTransform();
        if (
            this.lastTransform &&
            (this.lastTransform.x !== transform.x ||
                this.lastTransform.y !== transform.y ||
                this.lastTransform.x !== transform.x ||
                this.lastTransform.x !== transform.x)
        ) {
            this.momentum.x = 0;
            this.momentum.y = 0;
            this.lastTransform = undefined;
            this.stop();
            return;
        }

        transform.x += this.momentum.x;
        transform.y += this.momentum.y;
        this.lastTransform = transform;

        this.dampen(timeFactor);
        this.setTransform(transform);
    }

    // -------------------- public --------------------------

    constructor(p: TInertiaScrollingParams) {
        this.getTransform = p.getTransform;
        this.setTransform = p.setTransform;
    }

    dragStart(): void {
        if (!this.isEnabled) {
            return;
        }
        this.isDragging = true;
        this.momentum.x = 0;
        this.momentum.y = 0;
        this.stop();
    }

    dragMove(dX: number, dY: number): void {
        if (!this.isEnabled) {
            return;
        }
        this.momentum = {
            x: BB.mix(this.momentum.x, dX, 0.6),
            y: BB.mix(this.momentum.y, dY, 0.6),
        };
        this.lastDragTimestamp = new Date().getTime();
    }

    dragEnd(): void {
        if (!this.isEnabled) {
            return;
        }
        if (new Date().getTime() - this.lastDragTimestamp > 80) {
            this.momentum.x = 0;
            this.momentum.y = 0;
        } else {
            this.lastTimestamp = performance.now();
            this.animationFrameHandle = requestAnimationFrame(() => this.physicsLoop());
        }
        this.lastTransform = undefined;
        this.lastDragTimestamp = 0;
        this.isDragging = false;
    }

    setIsEnabled(b: boolean): void {
        this.isEnabled = b;
    }
}
