import { getIconUrl } from '../../../icon/icon';
import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { BoxToggle } from '../components/box-toggle';
import { Icon } from '../components/icon';
import { TRgb } from '../../kl-types';
import { TVector2D } from '../../../bb/bb-types';
import { ColorPickerWindow } from '../components/color-picker-window';

const eyedropperImg = getIconUrl('tool-picker');
export type TMobileColorUiParams = {
    onEyedropper: (isActive: boolean) => void;
    color: TRgb;
    onColorChange: (c: TRgb) => void;
};

export class MobileColorUi {
    private readonly rootEl: HTMLElement;
    private readonly eyedropperToggle: BoxToggle;
    private readonly colorCircle: HTMLDivElement;
    private colorPickerWindow: ColorPickerWindow | undefined;
    private colorPickerPosition: TVector2D = { x: 100, y: 100 };
    private color: TRgb = { r: 0, g: 0, b: 0 };

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileColorUiParams) {
        this.color = { ...p.color };
        this.colorCircle = BB.el({
            css: {
                width: 30,
                height: 30,
                background: BB.ColorConverter.toRgbStr(p.color),
                borderRadius: '100%',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.5)',
                alignSelf: 'center',
                cursor: 'pointer',
            },
            noRef: true,
            onClick: () => {
                if (this.colorPickerWindow) {
                    this.closeColorPicker();
                    return;
                }
                this.colorPickerWindow = new ColorPickerWindow({
                    color: this.color,
                    onChange: p.onColorChange,
                    onClose: () => this.closeColorPicker(),
                    onMove: (position) => {
                        this.colorPickerPosition = position;
                    },
                    position: this.colorPickerPosition,
                });
            },
        });

        const icon = new Icon({
            imageUrl: eyedropperImg,
            width: 1,
            height: 1,
            css: {
                width: '100%',
                height: '100%',
            },
            darkInvert: true,
        });
        this.eyedropperToggle = new BoxToggle({
            init: false,
            title: LANG('eyedropper'),
            onChange: (b) => {
                p.onEyedropper(b);
            },
            label: BB.el({
                content: icon.getElement(),
                css: {
                    padding: 6,
                    height: 36,
                },
            }),
        });

        this.rootEl = BB.el({
            css: {
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
            },
        });
        this.rootEl.append(this.colorCircle, this.eyedropperToggle.getElement());
    }

    getIsEyedropping(): boolean {
        return this.eyedropperToggle.getValue();
    }

    setIsEyedropping(b: boolean): void {
        this.eyedropperToggle.setValue(b);
    }

    setColor(color: TRgb): void {
        this.color = { ...color };
        this.colorCircle.style.backgroundColor = BB.ColorConverter.toRgbStr(color);
        this.colorPickerWindow?.setColor(color);
    }

    closeColorPicker(): void {
        if (this.colorPickerWindow) {
            this.colorPickerWindow.destroy();
            this.colorPickerWindow = undefined;
        }
    }

    setIsVisible(b: boolean): void {
        this.rootEl.style.display = b ? 'flex' : 'none';
        if (!b) {
            this.closeColorPicker();
        }
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
