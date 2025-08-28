import { BB } from '../../../bb/bb';
import { Options } from '../components/options';
import { LANG } from '../../../language/language';
import brushIconImg from 'url:/src/app/img/ui/tool-paint.svg';
import eraserIconImg from 'url:/src/app/img/ui/brush-eraser.svg';
import { Icon } from '../components/icon';

export type TMobileBrushUiParams = {
    onEraser: () => void;
    onBrush: () => void;
};

type TBrushType = 'brush' | 'eraser';

export class MobileBrushUi {
    private readonly rootEl: HTMLElement;
    private readonly brushOptions: Options<TBrushType>;

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileBrushUiParams) {
        const brushIcon = new Icon({
            imageUrl: brushIconImg,
            width: 28,
            height: 28,
            darkInvert: true,
            css: {
                margin: '4px',
            },
        });

        const eraserIcon = new Icon({
            imageUrl: eraserIconImg,
            width: 28,
            height: 28,
            darkInvert: true,
            css: {
                margin: '4px',
            },
        });

        this.brushOptions = new Options<TBrushType>({
            optionArr: [
                {
                    id: 'brush',
                    label: brushIcon.getElement(),
                    title: LANG('tool-brush'),
                },
                {
                    id: 'eraser',
                    label: eraserIcon.getElement(),
                    title: LANG('eraser'),
                },
            ],
            initId: 'brush',
            onChange: (id: string): void => {
                if (id === 'brush') {
                    p.onBrush();
                } else {
                    p.onEraser();
                }
            },
            isColumn: true,
        });

        this.rootEl = BB.el({
            css: {},
        });
        this.rootEl.append(this.brushOptions.getElement());
    }

    setIsVisible(b: boolean): void {
        this.rootEl.style.display = b ? 'block' : 'none';
    }

    setType(type: TBrushType): void {
        this.brushOptions.setValue(type, true);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
