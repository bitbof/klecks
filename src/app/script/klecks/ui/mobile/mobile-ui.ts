import { BB } from '../../../bb/bb';
import { ToolspaceCollapser } from './toolspace-collapser';
import { KL } from '../../kl';
import { TUiLayout } from '../../kl-types';
import { LocalStorage } from '../../../bb/base/local-storage';
import { css } from '../../../bb/base/base';
import { MobileColorUi } from './mobile-color-ui';
import { MobileToolUi } from './mobile-tool-ui';
import { MobileUndoRedoUi } from './mobile-undo-redo-ui';

export type TMobileUiParams = {
    orientation: TUiLayout;
    isVisible: boolean;
    onShowToolspace: (b: boolean) => void;
    onUndo: () => void;
    onRedo: () => void;
    // column below collapse button
    colorUi: MobileColorUi;
    toolUi: MobileToolUi;
};

export class MobileUi {
    private readonly rootEl: HTMLElement;
    private readonly columnEl: HTMLElement;
    private readonly cornerEl: HTMLElement;
    private toolspaceIsOpen: boolean;
    private orientation: TUiLayout;
    private isVisible: boolean;
    private readonly toolspaceCollapser: ToolspaceCollapser;
    private readonly controlsEl: HTMLElement;
    private readonly onShowToolspace: TMobileUiParams['onShowToolspace'];
    private readonly colorUi: MobileColorUi;
    private readonly toolUi: MobileToolUi;
    private readonly undoRedoUi: MobileUndoRedoUi;

    private close(): void {
        this.colorUi.close();
        this.toolUi.close();
    }

    private update(): void {
        if (!this.isVisible) {
            this.rootEl.style.display = 'none';
            return;
        }
        this.rootEl.style.display = 'block';
        const isLeft = this.orientation === 'left';
        // when toolspace is open, collapse button sits next to it
        const columnOffset = this.toolspaceIsOpen ? 271 : 0;
        css(this.columnEl, {
            display: 'flex',
            left: isLeft ? columnOffset : '',
            right: isLeft ? '' : columnOffset,
        });
        this.controlsEl.style.display = this.toolspaceIsOpen ? 'none' : 'flex';
        css(this.cornerEl, {
            display: this.toolspaceIsOpen ? 'none' : 'block',
            left: isLeft ? '' : 0,
            right: isLeft ? 0 : '',
        });
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileUiParams) {
        this.orientation = p.orientation;
        this.isVisible = p.isVisible;
        this.toolspaceIsOpen = !LocalStorage.getItem('uiShowMobile');
        this.onShowToolspace = p.onShowToolspace;
        this.colorUi = p.colorUi;
        this.toolUi = p.toolUi;
        this.toolspaceCollapser = new KL.ToolspaceCollapser({
            onChange: () => {
                this.toolspaceIsOpen = this.toolspaceCollapser.isOpen();
                this.close();
                this.update();
                this.onShowToolspace(this.toolspaceIsOpen);
                if (this.toolspaceIsOpen) {
                    LocalStorage.removeItem('uiShowMobile');
                } else {
                    LocalStorage.setItem('uiShowMobile', 'true');
                }
            },
        });
        this.toolspaceCollapser.setIsOpen(this.toolspaceIsOpen);
        this.toolspaceCollapser.setOrientation(this.orientation);
        this.toolUi.setOrientation(this.orientation);

        // color & tool controls, hidden while toolspace is open.
        // can shrink (brush size slider) to fit on short screens
        this.controlsEl = BB.el({
            css: {
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: 0,
            },
        });
        this.controlsEl.append(this.colorUi.getElement(), this.toolUi.getElement());

        this.columnEl = BB.el({
            css: {
                position: 'absolute',
                top: 0,
                maxHeight: 'calc(100% - 4px)', // spacing to bottom of viewport, same as gap
                flexDirection: 'column',
                userSelect: 'none',
            },
        });
        this.columnEl.append(this.toolspaceCollapser.getElement(), this.controlsEl);

        this.undoRedoUi = new MobileUndoRedoUi({
            onUndo: p.onUndo,
            onRedo: p.onRedo,
        });
        this.cornerEl = BB.el({
            content: this.undoRedoUi.getElement(),
            css: {
                position: 'absolute',
                top: 0,
                userSelect: 'none',
            },
        });

        // not positioned, children are positioned relative to app root
        this.rootEl = BB.el({
            content: [this.columnEl, this.cornerEl],
        });
        this.update();
    }

    setOrientation(orientation: TUiLayout): void {
        if (orientation === this.orientation) {
            return;
        }
        this.orientation = orientation;
        this.toolspaceCollapser.setOrientation(orientation);
        this.toolUi.setOrientation(orientation);
        this.update();
    }

    setIsVisible(b: boolean): void {
        if (b === this.isVisible) {
            return;
        }
        this.isVisible = b;
        if (!b) {
            this.close();
        }
        this.update();
    }

    updateUndoRedo(canUndo: boolean, canRedo: boolean): void {
        this.undoRedoUi.updateUndoRedo(canUndo, canRedo);
    }

    getToolspaceIsOpen(): boolean {
        return this.toolspaceIsOpen;
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
