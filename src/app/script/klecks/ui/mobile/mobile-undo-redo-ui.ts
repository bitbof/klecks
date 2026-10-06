import { getIconUrl } from '../../../icon/icon';
import { el } from '../../../bb/base/ui';
import { css } from '../../../bb/base/base';
import { LANG } from '../../../language/language';
import * as classes from './mobile-button.module.scss';

const undoImg = getIconUrl('tool-undo');

export type TMobileUndoRedoUiParams = {
    onUndo: () => void;
    onRedo: () => void;
};

/**
 * Undo & redo buttons for collapsed mobile UI.
 */
export class MobileUndoRedoUi {
    private readonly rootEl: HTMLElement;
    private readonly undoButton: HTMLButtonElement;
    private readonly redoButton: HTMLButtonElement;

    private createButton(
        title: string,
        isMirrored: boolean,
        onClick: () => void,
    ): HTMLButtonElement {
        const icon = el({
            className: [classes.icon, 'dark-invert', ...(isMirrored ? [classes.mirrored] : [])],
        });
        css(icon, { backgroundImage: `url("${undoImg}")` });
        const button = el({
            tagName: 'button',
            className: classes.button,
            title,
            content: icon,
            props: {
                type: 'button',
                tabIndex: -1,
                disabled: true,
            },
            onClick: (e) => {
                e.preventDefault();
                onClick();
            },
        });
        button.oncontextmenu = () => false;
        return button;
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TMobileUndoRedoUiParams) {
        this.undoButton = this.createButton(LANG('undo'), false, p.onUndo);
        this.redoButton = this.createButton(LANG('redo'), true, p.onRedo);
        this.rootEl = el({
            css: {
                display: 'flex',
                gap: 4,
            },
            content: [this.undoButton, this.redoButton],
        });
    }

    updateUndoRedo(canUndo: boolean, canRedo: boolean): void {
        this.undoButton.disabled = !canUndo;
        this.redoButton.disabled = !canRedo;
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }
}
