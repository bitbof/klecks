import { BB } from '../../../../bb/bb';
import { IPointerEvent } from '../../../../bb/input/event.types';
import { createMatrixFromTransform } from '../../../../bb/transform/create-matrix-from-transform';
import { applyToPoint, inverse } from 'transformation-matrix';
import {
    CoalescedExploder,
    ICoalescedPointerEvent,
} from '../../../../bb/input/event-chain/coalesced-exploder';
import { EventChain } from '../../../../bb/input/event-chain/event-chain';
import { IChainElement } from '../../../../bb/input/event-chain/event-chain.types';
import { TViewportTransform } from '../../project-viewport/project-viewport';
import { TEaselInterface, TEaselTool } from '../easel.types';
import { IVector2D } from '../../../../bb/bb-types';
import { BrushCursorPixelSquare } from './brush-cursor-pixel-square';
import { BrushCursorRound } from './brush-cursor-round';

export type TEaselBrushEvent = {
    x: number;
    y: number;
    isCoalesced: boolean;
    pressure: number;
};

export type TEaselBrushParams = {
    radius: number;

    onLineStart: (e: TEaselBrushEvent) => void;
    onLineGo: (e: TEaselBrushEvent) => void;
    onLineEnd: () => void;
    onLine: (p1: IVector2D, p2: IVector2D) => void;
};

type TLineToolDirection = 'x' | 'y';

export class EaselBrush implements TEaselTool {
    private readonly svgEl: SVGElement;
    private radius: number;
    private readonly onLineStart: TEaselBrushParams['onLineStart'];
    private readonly onLineGo: TEaselBrushParams['onLineGo'];
    private readonly onLineEnd: TEaselBrushParams['onLineEnd'];
    private readonly onLine: TEaselBrushParams['onLine'];
    private easel: TEaselInterface = {} as TEaselInterface;
    private oldScale: number = 1;
    private isDragging: boolean = false;
    private eventChain: EventChain; // to explode events
    private readonly brushCursorRound: BrushCursorRound;
    private readonly brushCursorPixelSquare: BrushCursorPixelSquare;
    private currentCursor: BrushCursorRound | BrushCursorPixelSquare;
    private lastPos: IVector2D = { x: 0, y: 0 };
    private lastLineEnd: IVector2D | undefined; // in canvas coords
    private lineToolDirection: TLineToolDirection | undefined;
    private firstShiftPos: IVector2D | undefined;
    private hideCursorTimeout: ReturnType<typeof setTimeout> | undefined;
    private isOver: boolean = false;

    private onExplodedPointer(e: ICoalescedPointerEvent): void {
        const vTransform = this.easel.getTransform();
        const m = createMatrixFromTransform(vTransform);
        // canvas coordinates
        const p = applyToPoint(inverse(m), { x: e.relX, y: e.relY });
        const x = p.x;
        const y = p.y;

        if (vTransform.scale !== this.oldScale) {
            this.oldScale = vTransform.scale;
        }

        if (!e.isCoalesced) {
            this.lastPos.x = e.relX;
            this.lastPos.y = e.relY;
            this.currentCursor.update(
                this.easel.getTransform(),
                { x: e.relX, y: e.relY },
                this.radius,
            );
            if (!this.isOver && e.type !== 'pointerup') {
                this._onPointerEnter();
            }
        }

        const pressure = e.pressure ?? 1;
        const isCoalesced = e.isCoalesced;
        const shiftIsPressed = this.easel.keyListener.isPressed('shift');

        if (shiftIsPressed && !this.firstShiftPos) {
            this.firstShiftPos = { x: e.relX, y: e.relY };
        }
        if (!shiftIsPressed) {
            this.firstShiftPos = undefined;
            this.lineToolDirection = undefined;
        }

        if (e.type === 'pointerdown' && e.button === 'left') {
            if (shiftIsPressed) {
                if (this.lastLineEnd) {
                    this.onLine(this.lastLineEnd, { x, y });
                }
                return;
            }

            this.onLineStart({ x, y, pressure, isCoalesced });
            this.isDragging = true;
        }
        if (e.type === 'pointermove' && e.button === 'left') {
            if (shiftIsPressed) {
                if (!this.lineToolDirection) {
                    const dX = Math.abs(e.relX - this.firstShiftPos!.x);
                    const dY = Math.abs(e.relY - this.firstShiftPos!.y);
                    if (dX > 5 || dY > 5) {
                        this.lineToolDirection = dX > dY ? 'x' : 'y';
                    }
                }
                if (this.lineToolDirection) {
                    const viewportP = {
                        x: this.lineToolDirection === 'x' ? e.relX : this.firstShiftPos!.x,
                        y: this.lineToolDirection === 'y' ? e.relY : this.firstShiftPos!.y,
                    };
                    const canvasP = applyToPoint(inverse(m), viewportP);
                    this.onLineGo({ ...canvasP, pressure, isCoalesced });
                }
            } else {
                this.onLineGo({ x, y, pressure, isCoalesced });
            }
        }
        if (e.type === 'pointerup' && e.button === undefined && this.isDragging) {
            this.onLineEnd();
            this.isDragging = false;
            if (e.pointerType === 'touch') {
                // due to delay of double-tap listener, pointerleave fires to early
                this.onPointerLeave();
            }
        }
    }

    private _onPointerEnter(): void {
        clearTimeout(this.hideCursorTimeout);
        this.svgEl.setAttribute('opacity', '1');
        this.isOver = true;
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TEaselBrushParams) {
        this.radius = p.radius;
        this.onLineStart = p.onLineStart;
        this.onLineGo = p.onLineGo;
        this.onLineEnd = p.onLineEnd;
        this.onLine = p.onLine;
        this.svgEl = BB.createSvg({
            elementType: 'g',
        });
        this.brushCursorRound = new BrushCursorRound();
        this.brushCursorPixelSquare = new BrushCursorPixelSquare();
        this.currentCursor = this.brushCursorRound;
        this.svgEl.append(this.currentCursor.getElement());

        this.eventChain = new EventChain({
            chainArr: [new CoalescedExploder() as IChainElement],
        });
        this.eventChain.setChainOut((e) => {
            this.onExplodedPointer(e as ICoalescedPointerEvent);
        });
    }

    getSvgElement(): SVGElement {
        return this.svgEl;
    }

    onPointer(e: IPointerEvent): void {
        this.eventChain.chainIn(e);
    }

    onPointerLeave(): void {
        clearTimeout(this.hideCursorTimeout);
        this.svgEl.setAttribute('opacity', '0');
        this.isOver = false;
    }

    setEaselInterface(easelInterface: TEaselInterface): void {
        this.easel = easelInterface;
    }

    onUpdateTransform(transform: TViewportTransform): void {
        this.currentCursor.update(transform, { x: this.lastPos.x, y: this.lastPos.y }, this.radius);
    }

    getIsLocked(): boolean {
        return this.isDragging;
    }

    setBrush(p: { radius?: number; type?: 'round' | 'pixel-square' }): void {
        if (p.radius !== undefined) {
            this.radius = p.radius;
            if (!this.isOver) {
                this.svgEl.setAttribute('opacity', '1');
                clearTimeout(this.hideCursorTimeout);
                this.hideCursorTimeout = setTimeout(() => {
                    this.svgEl.setAttribute('opacity', '0');
                }, 500);
            }
            const { width, height } = this.easel.getSize();
            this.currentCursor.update(
                this.easel.getTransform(),
                this.isOver ? this.lastPos : { x: width / 2, y: height / 2 },
                this.radius,
            );
        }
        if (p.type !== undefined) {
            const newBrushCursor =
                p.type === 'round' ? this.brushCursorRound : this.brushCursorPixelSquare;
            if (newBrushCursor !== this.currentCursor) {
                this.currentCursor.getElement().remove();
                this.currentCursor = newBrushCursor;
                this.getSvgElement().append(this.currentCursor.getElement());
            }
        }
    }

    setLastDrawEvent(p?: IVector2D): void {
        this.lastLineEnd = p ? { ...p } : undefined;
    }

    activate(cursorPos?: IVector2D): void {
        this.easel.setCursor('crosshair');
        this.isDragging = false;
        if (cursorPos) {
            this.lastPos.x = cursorPos.x;
            this.lastPos.y = cursorPos.y;
            this.currentCursor.update(
                this.easel.getTransform(),
                { x: cursorPos.x, y: cursorPos.y },
                this.radius,
            );
        } else {
            this.onPointerLeave();
        }
    }
}
