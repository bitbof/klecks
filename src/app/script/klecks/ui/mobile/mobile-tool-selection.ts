import { getIconSvg, getIconUrl, makeSvgIdsUnique } from '../../../icon/icon';
import { el } from '../../../bb/base/ui';
import { css } from '../../../bb/base/base';
import { LANG } from '../../../language/language';
import { Icon } from '../components/icon';
import { TToolType, TUiLayout } from '../../kl-types';
import { TBrushId } from '../../brushes-ui/brushes-ui';
import * as buttonClasses from './mobile-button.module.scss';

export type TMobileBrush = {
    id: TBrushId;
    image: HTMLElement | SVGSVGElement; // will be cloned
    title: string;
};

// select tool is split into its two modes
export type TMobileTool = Exclude<TToolType, 'brush'> | 'transform';

export type TMobileToolSelectionValue = TBrushId | TMobileTool;

export type TMobileToolSelectionParams = {
    brushArr: TMobileBrush[]; // excluding eraser
    getLastNonEraserBrushId: () => TBrushId;
    onBrush: (brushId: TBrushId) => void;
    onTool: (toolId: TMobileTool) => void;
};

type TOption = {
    id: TMobileToolSelectionValue;
    title: string;
    createIcon: () => HTMLElement | SVGSVGElement;
    onSelect: () => void;
};

function createBrushIcon(brush: TMobileBrush): HTMLElement | SVGSVGElement {
    const result = brush.image.cloneNode(true) as HTMLElement | SVGSVGElement;
    if (result instanceof SVGSVGElement) {
        makeSvgIdsUnique(result);
    }
    css(result, {
        width: 28,
        height: 28,
        display: 'block',
        color: 'inherit',
    });
    return result;
}

function createToolIcon(imageUrl: string): HTMLElement {
    return new Icon({
        imageUrl,
        width: 28,
        height: 28,
        darkInvert: true,
    }).getElement();
}

/**
 * Button showing the active brush/tool. Opens a popup with a row of brushes (+ eraser) and a row of
 * tools. Popup closes when an option is clicked, or on pointerdown outside.
 * Below it, swap button switches between brush and eraser. From other tools it goes to the last brush.
 */
export class MobileToolSelection {
    private readonly rootEl: HTMLElement;
    private readonly buttonEl: HTMLElement;
    private readonly popupEl: HTMLElement;
    private readonly optionArr: (TOption & { el: HTMLElement })[] = [];
    private value: TMobileToolSelectionValue | undefined; // button is empty until a value is set
    private orientation: TUiLayout = 'right';
    private isOpen = false;

    private readonly onPointerDownOutside = (e: PointerEvent): void => {
        if (!this.rootEl.contains(e.target as Node | null)) {
            this.close();
        }
    };

    private updateButton(): void {
        const option = this.optionArr.find((item) => item.id === this.value);
        if (!option) {
            return;
        }
        this.buttonEl.replaceChildren(option.createIcon());
        this.buttonEl.title = option.title;
        this.buttonEl.ariaLabel = option.title;
    }

    private open(): void {
        this.optionArr.forEach((option) => {
            option.el.setAttribute('aria-pressed', '' + (option.id === this.value));
        });
        css(this.popupEl, {
            display: 'flex',
            left: this.orientation === 'left' ? 40 : '',
            right: this.orientation === 'left' ? '' : 40,
        });
        this.isOpen = true;
        document.addEventListener('pointerdown', this.onPointerDownOutside);
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileToolSelectionParams) {
        const brushOptionArr: TOption[] = [
            ...p.brushArr.map((brush) => ({
                id: brush.id,
                title: brush.title,
                createIcon: () => createBrushIcon(brush),
                onSelect: () => p.onBrush(brush.id),
            })),
            {
                id: 'eraserBrush',
                title: LANG('eraser'),
                createIcon: () => getIconSvg('brush-eraser', { width: 28, height: 28 }),
                onSelect: () => p.onBrush('eraserBrush'),
            },
        ];
        const toolArr: { id: TMobileTool; image: string; title: string }[] = [
            { id: 'paintBucket', image: getIconUrl('tool-fill'), title: LANG('tool-paint-bucket') },
            { id: 'gradient', image: getIconUrl('tool-gradient'), title: LANG('tool-gradient') },
            { id: 'text', image: getIconUrl('tool-text'), title: LANG('tool-text') },
            { id: 'shape', image: getIconUrl('tool-shape'), title: LANG('tool-shape') },
            {
                id: 'select',
                image: getIconUrl('select-mode-select'),
                title: LANG('select-select'),
            },
            {
                id: 'transform',
                image: getIconUrl('select-mode-move'),
                title: LANG('select-transform'),
            },
            { id: 'hand', image: getIconUrl('tool-hand'), title: LANG('tool-hand') },
        ];
        const toolOptionArr: TOption[] = toolArr.map((tool) => ({
            id: tool.id,
            title: tool.title,
            createIcon: () => createToolIcon(tool.image),
            onSelect: () => p.onTool(tool.id),
        }));

        const createButton = (option: TOption): HTMLElement => {
            const button = el({
                tagName: 'button',
                className: [buttonClasses.button, buttonClasses.option],
                content: option.createIcon(),
                title: option.title,
                css: {
                    padding: 4,
                },
                props: {
                    type: 'button',
                    tabIndex: -1,
                    ariaLabel: option.title,
                },
                onClick: () => {
                    const wasSelected = option.id === this.value;
                    this.close();
                    if (!wasSelected) {
                        option.onSelect();
                    }
                },
            });
            this.optionArr.push({ ...option, el: button });
            return button;
        };

        this.popupEl = el({
            content: [brushOptionArr, toolOptionArr].map((row) =>
                el({
                    content: row.map(createButton),
                    css: {
                        display: 'flex',
                        gap: 4,
                    },
                }),
            ),
            css: {
                position: 'absolute',
                top: 0,
                zIndex: 1,
                width: 'max-content',
                display: 'none',
                flexDirection: 'column',
                gap: 4,
                padding: 4,
                borderRadius: 4,
                background: 'var(--canvas-overlay-bg)',
            },
        });
        this.popupEl.oncontextmenu = () => false;

        this.buttonEl = el({
            tagName: 'button',
            className: buttonClasses.button,
            css: {
                padding: 4,
            },
            props: {
                type: 'button',
                tabIndex: -1,
            },
            onClick: () => {
                if (this.isOpen) {
                    this.close();
                } else {
                    this.open();
                }
            },
        });
        this.buttonEl.oncontextmenu = () => false;

        const swapButton = el({
            tagName: 'button',
            className: buttonClasses.button,
            content: getIconSvg('brush-eraser-swap', { width: '100%', height: '100%' }),
            title: `${LANG('tool-brush')} / ${LANG('eraser')}`,
            css: {
                padding: 4,
            },
            props: {
                type: 'button',
                tabIndex: -1,
            },
            onClick: () => {
                this.close();
                if (p.brushArr.some((brush) => brush.id === this.value)) {
                    p.onBrush('eraserBrush');
                } else {
                    p.onBrush(p.getLastNonEraserBrushId());
                }
            },
        });
        swapButton.oncontextmenu = () => false;

        this.rootEl = el({
            content: [this.buttonEl, swapButton, this.popupEl],
            css: {
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                flexShrink: 0,
            },
        });
    }

    setValue(value: TMobileToolSelectionValue): void {
        if (this.value === value) {
            return;
        }
        this.value = value;
        this.updateButton();
    }

    setOrientation(orientation: TUiLayout): void {
        this.orientation = orientation;
        this.close();
    }

    close(): void {
        if (!this.isOpen) {
            return;
        }
        this.isOpen = false;
        this.popupEl.style.display = 'none';
        document.removeEventListener('pointerdown', this.onPointerDownOutside);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
