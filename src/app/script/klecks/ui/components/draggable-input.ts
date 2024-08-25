import { TViewportTransform } from '../project-viewport/project-viewport';
import { BB } from '../../../bb/bb';
import { IVector2D } from '../../../bb/bb-types';
import { applyToPoint } from 'transformation-matrix';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { PointerListener } from '../../../bb/input/pointer-listener';

export type TDraggableInputParams = {
    value: IVector2D;
    onChange: (value: IVector2D) => void;
};

const SIZE = 16;

export class DraggableInput {
    private readonly rootEl: HTMLElement;
    private transform: TViewportTransform;
    private value: IVector2D;
    private readonly pointerListener: PointerListener;

    private update(): void {
        const p = applyToPoint(createMatrixFromTransform(this.transform), this.value);
        BB.css(this.rootEl, {
            left: p.x - SIZE / 2 + 'px',
            top: p.y - SIZE / 2 + 'px',
        });
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TDraggableInputParams) {
        this.value = { ...p.value };
        this.transform = {
            x: 0,
            y: 0,
            scale: 1,
            angleDeg: 0,
        };

        this.rootEl = BB.el({
            css: {
                width: SIZE + 'px',
                height: SIZE + 'px',
                backgroundColor: '#fff',
                border: '2px solid #000',
                borderRadius: SIZE + 'px',
                position: 'absolute',
                cursor: 'move',
                userSelect: 'none',
                touchAction: 'none',
            },
        });

        this.pointerListener = new BB.PointerListener({
            target: this.rootEl,
            onPointer: (event) => {
                event.eventPreventDefault();
                if (event.button === 'left' && event.type === 'pointermove') {
                    this.value.x += event.dX / this.transform.scale;
                    this.value.y += event.dY / this.transform.scale;
                    this.update();
                    p.onChange(this.value);
                }
            },
        });
    }

    setTransform(transform: TViewportTransform): void {
        if (JSON.stringify(this.transform) === JSON.stringify(transform)) {
            return;
        }
        this.transform = transform;
        this.update();
    }

    getValue(): IVector2D {
        return this.value;
    }

    setValue(p: IVector2D): void {
        this.value = { ...p };
        this.update();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.rootEl.remove();
        this.pointerListener.destroy();
    }
}
