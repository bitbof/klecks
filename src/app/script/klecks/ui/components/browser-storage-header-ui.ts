import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { showIframeModal } from '../modals/show-iframe-modal';

export class BrowserStorageHeaderUi {
    private readonly rootEl: HTMLElement;
    private readonly infoButton: HTMLElement;

    // ----------------------------------- public -----------------------------------
    constructor() {
        this.infoButton = BB.el({
            content: '?',
            className: 'kl-info-btn',
            title: LANG('file-storage-about'),
            onClick: () => {
                showIframeModal('./help/#help-browser-storage', false);
            },
        });

        this.rootEl = BB.el({
            content: LANG('file-storage'),
            css: {
                display: 'flex',
                margin: '-5px 0',
                gap: '6px',
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
