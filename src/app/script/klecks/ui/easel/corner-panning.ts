import { ISize2D, IVector2D } from '../../../bb/bb-types';
import { IPointerEvent } from '../../../bb/input/event.types';
import { TViewportTransform } from '../project-viewport/project-viewport';

export type TCornerPanningParams = {
    getEaselSize: () => ISize2D;
    getTransform: () => TViewportTransform;
    setTransform: (transform: TViewportTransform) => void;
    testCanPan: (buttonIsPressed: boolean) => boolean;
    onRepeatEvent: (e: IPointerEvent) => void;
};

export class CornerPanning {
    // from params
    private getEaselSize: () => ISize2D;
    private getTransform: () => TViewportTransform;
    private setTransform: (transform: TViewportTransform) => void;
    private testCanPan: (buttonIsPressed: boolean) => boolean;
    private onRepeatEvent: (e: IPointerEvent) => void;

    private readonly thresholdPx = 25;

    // state
    private animationFrameHandle: ReturnType<typeof requestAnimationFrame> | undefined;
    private lastFrameTimestamp = 0;
    private cornerDirection: IVector2D | undefined;
    private repeatEvent: IPointerEvent = {} as IPointerEvent;

    // only call through requestAnimationFrame when animationFrameHandle undefined
    private movementLoop(): void {
        if (!this.cornerDirection) {
            if (this.animationFrameHandle) {
                cancelAnimationFrame(this.animationFrameHandle);
            }
            this.animationFrameHandle = undefined;
            this.lastFrameTimestamp = 0;
            return;
        }
        this.animationFrameHandle = requestAnimationFrame(() => this.movementLoop());

        const now = performance.now();
        const deltaMs = now - this.lastFrameTimestamp;
        const defaultDeltaMs = 1000 / 60;
        const timeFactor = Math.min(deltaMs / defaultDeltaMs, 10);
        this.lastFrameTimestamp = now;

        const transform = this.getTransform();
        transform.x += this.cornerDirection.x * timeFactor;
        transform.y += this.cornerDirection.y * timeFactor;
        this.setTransform(transform);
        this.onRepeatEvent(this.repeatEvent);
    }

    getSpeed(thresholdDelta: number): number {
        return Math.min(thresholdDelta, this.thresholdPx) * (3 / 5);
    }

    // ----------------- public ------------------

    constructor(p: TCornerPanningParams) {
        this.getEaselSize = p.getEaselSize;
        this.getTransform = p.getTransform;
        this.setTransform = p.setTransform;
        this.testCanPan = p.testCanPan;
        this.onRepeatEvent = p.onRepeatEvent;
    }

    onPointer(event: IPointerEvent): void {
        let isMoving = false;
        this.cornerDirection = { x: 0, y: 0 };

        if (this.testCanPan(event.button !== undefined) && event.type === 'pointermove') {
            if (event.relX > this.getEaselSize().width - this.thresholdPx) {
                this.cornerDirection.x -= this.getSpeed(
                    event.relX - (this.getEaselSize().width - this.thresholdPx),
                );
                isMoving = true;
            }
            if (event.relX < this.thresholdPx) {
                this.cornerDirection.x += this.getSpeed(this.thresholdPx - event.relX);
                isMoving = true;
            }
            if (event.relY > this.getEaselSize().height - this.thresholdPx) {
                this.cornerDirection.y -= this.getSpeed(
                    event.relY - (this.getEaselSize().height - this.thresholdPx),
                );
                isMoving = true;
            }
            if (event.relY < this.thresholdPx) {
                this.cornerDirection.y += this.getSpeed(this.thresholdPx - event.relY);
                isMoving = true;
            }
        }

        if (isMoving) {
            if (this.lastFrameTimestamp === 0) {
                this.lastFrameTimestamp = performance.now();
            }
            this.repeatEvent = event;
            this.animationFrameHandle = requestAnimationFrame(() => this.movementLoop());
        } else {
            this.cornerDirection = undefined;
        }
    }
}
