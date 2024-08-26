import { BB } from '../../../bb/bb';

import removeLayerImg from '/src/app/img/ui/remove-layer.svg';
import { IKlProject } from '../../kl-types';
import { showIframeModal } from '../modals/show-iframe-modal';
import { SaveReminder } from './save-reminder';
import { IProjectStoreListener, ProjectStore } from '../../storage/project-store';
import { KL } from '../../kl';
import { LANG } from '../../../language/language';
import { theme } from '../../../theme/theme';

export class BrowserStorageUi {
    private previewEl: HTMLDivElement = {} as HTMLDivElement;
    private readonly infoEl: HTMLElement = {} as HTMLElement;
    private readonly ageEl: HTMLElement = {} as HTMLElement;
    private readonly storeButtonEl: HTMLButtonElement = {} as HTMLButtonElement;
    private readonly clearButtonEl: HTMLButtonElement = {} as HTMLButtonElement;
    private readonly storeListener: IProjectStoreListener = {} as IProjectStoreListener;
    private readonly updateCheckerboard: () => void = () => {};

    private timestamp: number | undefined;
    private thumbnail: HTMLImageElement | HTMLCanvasElement | undefined;

    private updateAge() {
        if (!this.timestamp) {
            return;
        }
        let age = new Date().getTime() - this.timestamp;
        let ageStr;
        age = Math.floor(age / 1000 / 60);
        ageStr = LANG('file-storage-min-ago').replace('{x}', '' + age);
        if (age > 60) {
            age = Math.floor(age / 60);
            ageStr = LANG('file-storage-hours-ago').replace('{x}', '' + age);
            if (age > 24) {
                age = Math.floor(age / 24);
                ageStr = LANG('file-storage-days-ago').replace('{x}', '' + age);
                if (age > 31) {
                    ageStr = LANG('file-storage-month-ago');
                }
            }
        }
        this.ageEl.textContent = ageStr;
    }

    private resetButtons() {
        if (this.timestamp) {
            this.storeButtonEl.textContent = LANG('file-storage-overwrite');
            this.storeButtonEl.disabled = false;
            this.clearButtonEl.disabled = false;
        } else {
            this.storeButtonEl.textContent = LANG('file-storage-store');
            this.storeButtonEl.disabled = false;
            this.clearButtonEl.disabled = true;
        }
    }

    private updateThumb(timestamp?: number, thumbnail?: HTMLImageElement | HTMLCanvasElement) {
        this.timestamp = timestamp;
        this.thumbnail = thumbnail;
        if (this.timestamp && thumbnail) {
            thumbnail.classList.add('kl-storage-preview__im');
            this.previewEl.innerHTML = '';
            this.updateAge();
            this.previewEl.append(thumbnail, this.ageEl);
        } else {
            this.previewEl.innerHTML = LANG('file-storage-empty');
        }
        this.resetButtons();
    }

    private async store() {
        this.applyUncommitted?.();
        this.storeButtonEl.textContent = LANG('file-storage-storing');
        this.storeButtonEl.disabled = true;
        this.clearButtonEl.disabled = true;
        await new Promise((resolve) => {
            setTimeout(() => resolve(null), 20);
        });
        try {
            await this.projectStore.store(this.getProject());
            this.saveReminder.reset();
        } catch (e) {
            this.resetButtons();
            KL.popup({
                target: this.klRootEl,
                type: 'error',
                message: [
                    `${LANG('file-storage-failed-1')}<ul>`,
                    `<li>${LANG('file-storage-failed-2')}</li>`,
                    `<li>${LANG('file-storage-failed-3')}</li>`,
                    `<li>${LANG('file-storage-failed-4')}</li>`,
                    '</ul>',
                ].join(''),
                buttons: ['Ok'],
            });
            setTimeout(() => {
                throw new Error('storage-ui: failed to store browser storage, ' + e);
            }, 0);
        }
    }

    private async clear() {
        this.storeButtonEl.disabled = true;
        this.clearButtonEl.disabled = true;
        try {
            await this.projectStore.clear();
        } catch (e) {
            this.resetButtons();
            KL.popup({
                target: this.klRootEl,
                type: 'error',
                message: LANG('file-storage-failed-clear'),
                buttons: ['Ok'],
            });
            setTimeout(() => {
                throw new Error('storage-ui: failed to clear browser storage, ' + e);
            }, 0);
        }
    }

    element: HTMLDivElement;

    constructor(
        private projectStore: ProjectStore,
        private getProject: () => IKlProject,
        private saveReminder: SaveReminder,
        private klRootEl: HTMLElement,
        private applyUncommitted?: () => void,
        private options?: { hideClearButton?: boolean; isFocusable?: boolean }, // isFocusable default = false
    ) {
        this.element = BB.el({
            css: {
                display: 'grid',
                gridTemplateColumns: '1fr 0fr',
                gridTemplateRows: '0fr 0fr 0fr',
                gap: '0 0',
                gridTemplateAreas: '"title title" "preview store" "preview clear"',
            },
        });

        const title = BB.el({
            parent: this.element,
            content: LANG('file-storage'),
            css: {
                gridArea: 'title',
                display: 'flex',
                margin: '-5px 0',
                gap: '5px',
                //background: '#f00',
            },
        });

        this.infoEl = BB.el({
            parent: title,
            content: '?',
            className: 'kl-info-btn',
            title: LANG('file-storage-about'),
            onClick: () => {
                showIframeModal('./help/#help-browser-storage', false);
            },
        });

        if (this.projectStore.isBroken()) {
            BB.el({
                parent: this.element,
                content: '🔴 ' + LANG('file-storage-cant-access'),
                css: {
                    marginTop: '10px',
                },
            });
            return;
        }

        this.previewEl = BB.el({
            parent: this.element,
            title: LANG('file-storage-thumb-title'),
            className: 'kl-storage-preview',
        });
        this.ageEl = BB.el({
            css: {
                position: 'absolute',
                right: '1px',
                bottom: '1px',
                width: 'calc(100% - 2px)',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                textSize: '13px',
            },
        });
        const btnCustom: { [key: string]: string } = options?.isFocusable
            ? {}
            : {
                  tabIndex: '-1',
              };
        this.storeButtonEl = BB.el({
            parent: this.element,
            tagName: 'button',
            className: 'grid-button',
            content: LANG('file-storage-store'),
            css: {
                gridArea: 'store',
                //background: '#00f',
            },
            custom: btnCustom,
            onClick: () => this.store(),
        });
        this.clearButtonEl = BB.el({
            parent: this.element,
            tagName: 'button',
            className: 'grid-button',
            content:
                '<img src="' + removeLayerImg + '" height="20"/> ' + LANG('file-storage-clear'),
            css: {
                gridArea: 'clear',
                //background: '#ff0',
            },
            custom: btnCustom,
            onClick: () => this.clear(),
        });

        if (this.options?.hideClearButton) {
            this.clearButtonEl.style.visibility = 'hidden';
        }

        this.storeListener = {
            onUpdate: (timestamp, thumbnail) => {
                this.updateThumb(timestamp, thumbnail);
            },
        };
        this.projectStore.subscribe(this.storeListener);

        this.updateCheckerboard = (): void => {
            if (!this.thumbnail) {
                return;
            }
            BB.css(this.thumbnail, {
                background:
                    "url('" +
                    BB.createCheckerCanvas(4, theme.isDark()).toDataURL('image/png') +
                    "')",
            });
        };
        theme.addIsDarkListener(this.updateCheckerboard);

        setInterval(() => this.updateAge(), 1000 * 60);

        (async () => {
            try {
                const readResult = await this.projectStore.read();
                if (readResult) {
                    this.updateThumb(readResult.timestamp, readResult.thumbnail);
                } else {
                    this.updateThumb();
                }
            } catch (e) {
                setTimeout(() => {
                    throw new Error('storage-ui: failed initial read browser storage, ' + e);
                }, 0);
            }
        })();
    }

    getElement() {
        return this.element;
    }

    show() {
        // todo
    }

    hide() {
        // todo
    }

    destroy() {
        BB.destroyEl(this.infoEl);
        BB.destroyEl(this.storeButtonEl);
        BB.destroyEl(this.clearButtonEl);
        theme.removeIsDarkListener(this.updateCheckerboard);
        this.projectStore.unsubscribe(this.storeListener);
    }
}
