import { TVector2D } from '../../../bb/bb-types';
import { TRgb } from '../../kl-types';
import { FloatingWindow } from './floating-window';
import { KlColorSliderSmall } from './kl-color-slider-small';

export class ColorPickerWindow {
    private readonly colorPicker: KlColorSliderSmall;
    private readonly floatingWindow: FloatingWindow;
    private isDestroyed = false;

    constructor(p: {
        color: TRgb;
        onChange: (color: TRgb) => void;
        onMove: (position: TVector2D) => void;
        onClose?: () => void;
        position?: TVector2D;
        closeOnOutsideClick?: boolean;
        triggerElement?: HTMLElement;
    }) {
        this.colorPicker = new KlColorSliderSmall({
            width: 200,
            heightSV: 200,
            heightH: 30,
            color: p.color,
            callback: p.onChange,
        });
        this.floatingWindow = new FloatingWindow({
            content: this.colorPicker.getElement(),
            onClose: () => {
                this.destroy();
                p.onClose?.();
            },
            onMove: p.onMove,
            position: p.position,
            closeOnOutsideClick: p.closeOnOutsideClick,
            triggerElement: p.triggerElement,
        });
    }

    setColor(color: TRgb): void {
        this.colorPicker.setColor(color);
    }

    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.floatingWindow.destroy();
        this.colorPicker.destroy();
    }
}
