import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import eyedropperImg from 'url:/src/app/img/ui/tool-picker.svg';
import { BoxToggle } from '../components/box-toggle';
import { Icon } from '../components/icon';
import { TRgb } from '../../kl-types';
import { MobileFloatingWindow } from './mobile-floating-window';
import { KlColorSliderSmall } from '../components/kl-color-slider-small';
import { TVector2D } from '../../../bb/bb-types';

export type TMobileColorUiParams = {
    onEyedropper: (isActive: boolean) => void;
    color: TRgb;
    onColorChange: (c: TRgb) => void;
};

export class MobileColorUi {
    private readonly rootEl: HTMLElement;
    private readonly eyedropperToggle: BoxToggle;
    private readonly colorCircle: HTMLDivElement;
    private colorPicker: KlColorSliderSmall | undefined;
    private colorWindow: MobileFloatingWindow | undefined;
    private colorPickerPosition: TVector2D = { x: 100, y: 100 };
    private color: TRgb = { r: 0, g: 0, b: 0 };

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileColorUiParams) {
        this.color = { ...p.color };
        this.colorCircle = BB.el({
            css: {
                width: '30px',
                height: '30px',
                background: BB.ColorConverter.toRgbStr(p.color),
                borderRadius: '100%',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.5)',
                alignSelf: 'center',
                cursor: 'pointer',
            },
            noRef: true,
            onClick: () => {
                if (this.colorPicker) {
                    this.closeColorPicker();
                    return;
                }
                this.colorPicker = new KlColorSliderSmall({
                    width: 200,
                    heightSV: 200,
                    heightH: 30,
                    color: this.color,
                    callback: p.onColorChange,
                });
                this.colorWindow = new MobileFloatingWindow({
                    content: BB.el({ content: this.colorPicker.getElement() }),
                    onClose: () => {
                        this.closeColorPicker();
                    },
                    position: this.colorPickerPosition,
                });
                document.body.append(this.colorWindow.getElement());
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
                    padding: '6px',
                    height: '36px',
                },
            }),
        });

        this.rootEl = BB.el({
            css: {
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
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
        this.colorPicker?.setColor(color);
    }

    closeColorPicker(): void {
        if (this.colorWindow) {
            this.colorPickerPosition = this.colorWindow.getPosition();
            this.colorWindow?.destroy();
            this.colorWindow?.getElement().remove();
            this.colorWindow = undefined;
        }
        this.colorPicker?.destroy();
        this.colorPicker = undefined;
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
