import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { showIframeModal } from '../modals/show-iframe-modal';
import { createHelpButton } from './help-button';
import { Destroyer } from '../../../bb/base/base';

export class BrowserStorageHeaderUi {
    private readonly rootEl: HTMLElement;
    private readonly infoButton: HTMLElement;
    private readonly destroyer = new Destroyer();

    // ----------------------------------- public -----------------------------------
    constructor(helpPath: string) {
        this.infoButton = createHelpButton({
            title: LANG('file-storage-about'),
            isFocusable: false,
            destroyer: this.destroyer,
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
        this.destroyer.destroy();
    }
}
