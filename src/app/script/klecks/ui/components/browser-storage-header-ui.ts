import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { showIframeModal } from '../modals/show-iframe-modal';
import { createHelpButton } from './help-button';

export class BrowserStorageHeaderUi {
    private readonly rootEl: HTMLElement;
    private readonly infoButton: HTMLElement;

    // ----------------------------------- public -----------------------------------
    constructor(helpPath: string) {
        this.infoButton = createHelpButton({
            title: LANG('file-storage-about'),
            isFocusable: false,
            onClick: () => {
                showIframeModal(helpPath + '#help-browser-storage', false);
            },
        });

        this.rootEl = BB.el({
            content: LANG('file-storage'),
            css: {
                display: 'flex',
                margin: '-5px 0',
                gap: 6,
            },
        });
        this.rootEl.append(this.infoButton);
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    show(): void {}

    destroy(): void {
        BB.destroyEl(this.infoButton);
    }
}
