import { BB } from '../../../bb/bb';

import removeLayerImg from 'url:/src/app/img/ui/remove-layer.svg';
import { TKlProject } from '../../kl-types';
import { ProjectStore, TProjectStoreListener } from '../../storage/project-store';
import { KL } from '../../kl';
import { LANG } from '../../../language/language';
import { showModal } from '../modals/base/showModal';
import { timestampToAge } from '../utils/timestamp-to-age';
import { BrowserStorageHeaderUi } from './browser-storage-header-ui';
import * as classes from './browser-storage-ui.module.scss';
import { makeUnfocusable } from '../../../bb/base/ui';
import { requestPersistentStorage } from '../../storage/request-persistent-storage';
import { copyCanvas } from '../../../bb/base/canvas';

export type TBrowserStorageUiParams = {
    projectStore: ProjectStore;
    getProject: () => TKlProject;
    klRootEl: HTMLElement;
    applyUncommitted: () => void;
    options?: { hideClearButton?: boolean; isFocusable?: boolean }; // isFocusable default = false
    onOpen?: () => void;
    onStored: () => void;
};

export class BrowserStorageUi {
    private readonly rootEl: HTMLDivElement;
    private readonly contentEl: HTMLDivElement;
    private readonly previewEl: HTMLDivElement = {} as HTMLDivElement;
    private readonly header: BrowserStorageHeaderUi;
    private readonly ageEl: HTMLElement = {} as HTMLElement;
    private readonly emptyEl: HTMLElement = {} as HTMLElement;
    private readonly openButtonEl: HTMLButtonElement | undefined;
    private readonly storeButtonEl: HTMLButtonElement = {} as HTMLButtonElement;
    private readonly clearButtonEl: HTMLButtonElement = {} as HTMLButtonElement;
    private readonly storeListener: TProjectStoreListener = {} as TProjectStoreListener;
    private isFirst: boolean = true;

    private timestamp: number | undefined;
    private thumbnail: HTMLImageElement | HTMLCanvasElement | undefined;
    private projectStore: ProjectStore;
    private readonly getProject: () => TKlProject;
    private readonly onStored: () => void;
    private readonly klRootEl: HTMLElement;
    private readonly applyUncommitted: () => void;
    private options: { hideClearButton?: boolean; isFocusable?: boolean } | undefined;
    private readonly onOpen: (() => void) | undefined;
    private readonly updateAgeInterval: ReturnType<typeof setInterval>;

    private updateAge(): void {
        if (!this.timestamp) {
            return;
        }
        this.ageEl.textContent = timestampToAge(this.timestamp);
    }

    private resetButtons(): void {
        this.previewEl.classList.remove('kl-storage-preview--disabled');
        if (this.timestamp) {
            if (this.openButtonEl) {
                this.openButtonEl.disabled = false;
            }
            this.storeButtonEl.textContent = LANG('file-storage-overwrite');
            this.storeButtonEl.disabled = false;
            this.clearButtonEl.disabled = false;
        } else {
            if (this.openButtonEl) {
                this.openButtonEl.disabled = true;
            }
            this.storeButtonEl.textContent = LANG('file-storage-store');
            this.storeButtonEl.disabled = false;
            this.clearButtonEl.disabled = true;
        }
    }

    private updateThumb(
        timestamp?: number,
        thumbnail?: HTMLImageElement | HTMLCanvasElement,
    ): void {
        this.timestamp = timestamp;
        this.thumbnail?.remove();
        this.thumbnail = thumbnail ? copyCanvas(thumbnail) : undefined;

        const thumbnailCanvas = this.thumbnail; // typescript being weird
        if (thumbnailCanvas && timestamp) {
            thumbnailCanvas.classList.add('kl-storage-preview__im');
            this.ageEl.remove();
            this.emptyEl.remove();
            this.updateAge();
            this.previewEl.append(thumbnailCanvas, this.ageEl);
            this.previewEl.style.pointerEvents = this.onOpen ? '' : 'none';

            if (typeof performance !== 'undefined' && timestamp > performance.timeOrigin) {
                const animEl = BB.el({
                    parent: this.previewEl,
                    className: classes.animEl,
                });
                setTimeout(() => {
                    animEl.remove();
                }, 500);
            }
        } else {
            this.ageEl.remove();
            this.previewEl.append(this.emptyEl);
            this.previewEl.style.pointerEvents = 'none'; // prevent title
        }
        this.resetButtons();
    }

    private async store(): Promise<void> {
        const meta = this.projectStore.getCurrentMeta();
        const project = this.getProject();

        if (meta && meta.projectId !== project.projectId) {
            const doOverwrite = await new Promise<boolean>((resolve, reject) => {
                showModal({
                    target: document.body,
                    type: 'warning',
                    message: LANG('file-storage-overwrite-confirm'),
                    buttons: [LANG('file-storage-overwrite'), 'Cancel'],
                    callback: async (result) => {
                        if (result === 'Cancel') {
                            resolve(false);
                            return;
                        }
                        resolve(true);
                    },
                });
            });
            if (!doOverwrite) {
                return;
            }
        }

        this.applyUncommitted();
        await requestPersistentStorage();
        if (this.openButtonEl) {
            this.openButtonEl.disabled = true;
        }
        this.storeButtonEl.textContent = LANG('file-storage-storing');
        this.storeButtonEl.disabled = true;
        this.clearButtonEl.disabled = true;
        this.previewEl.classList.add('kl-storage-preview--disabled');
        await new Promise((resolve) => {
            setTimeout(() => resolve(null), 20);
        });
        try {
            await this.projectStore.store(project);
            this.onStored();
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

    private async clear(): Promise<void> {
        showModal({
            target: document.body,
            type: 'warning',
            message: LANG('file-storage-clear-prompt'),
            buttons: [LANG('file-storage-clear'), 'Cancel'],
            deleteButtonName: LANG('file-storage-clear'),
            callback: async (result) => {
                if (result === 'Cancel') {
                    return;
                }

                if (this.openButtonEl) {
                    this.openButtonEl.disabled = true;
                }
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
            },
        });
    }

    private showError(): void {
        this.contentEl.innerHTML = '';
        BB.el({
            parent: this.contentEl,
            content: '🔴 ' + LANG('file-storage-cant-access'),
            css: {
                marginTop: '10px',
            },
        });
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TBrowserStorageUiParams) {
        this.updateAgeInterval = setInterval(() => this.updateAge(), 1000 * 60);
        this.projectStore = p.projectStore;
        this.getProject = p.getProject;
        this.onStored = p.onStored;
        this.klRootEl = p.klRootEl;
        this.applyUncommitted = p.applyUncommitted;
        this.options = p.options;
        this.onOpen = p.onOpen;

        this.rootEl = BB.el({});

        this.header = new BrowserStorageHeaderUi();
        this.rootEl.append(this.header.getElement());

        this.contentEl = BB.el({
            parent: this.rootEl,
        });

        if (!this.projectStore.getIsAvailable()) {
            this.showError();
            return;
        }

        this.previewEl = BB.el({
            className: 'kl-storage-preview',
            onClick: () => this.onOpen?.(),
            title: LANG('file-storage-open'),
            noRef: true,
        });
        this.emptyEl = BB.el({
            content: LANG('file-storage-empty'),
        });
        this.ageEl = BB.el({
            css: {
                position: 'absolute',
                right: '0',
                bottom: '0',
                width: '100%',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                fontSize: '13px',
            },
        });
        if (this.onOpen) {
            this.openButtonEl = BB.el({
                tagName: 'button',
                className: 'grid-button',
                content: LANG('file-storage-open'),
                css: {
                    margin: '0',
                },
                onClick: () => this.onOpen?.(),
                noRef: true,
            });
        }
        this.storeButtonEl = BB.el({
            tagName: 'button',
            className: 'grid-button',
            content: LANG('file-storage-store'),
            css: {
                margin: '0',
            },
            onClick: () => this.store(),
            noRef: true,
        });
        this.clearButtonEl = BB.el({
            tagName: 'button',
            className: 'grid-button kl-button-delete',
            content:
                '<img src="' + removeLayerImg + '" height="20"/> ' + LANG('file-storage-clear'),
            css: {
                margin: '0',
            },
            onClick: () => this.clear(),
            noRef: true,
        });
        if (!this.options?.isFocusable) {
            this.openButtonEl && makeUnfocusable(this.openButtonEl);
            makeUnfocusable(this.storeButtonEl);
            makeUnfocusable(this.clearButtonEl);
        }

        if (this.options?.hideClearButton) {
            this.clearButtonEl.style.visibility = 'hidden';
        }

        this.contentEl.append(
            BB.el({
                content: [
                    BB.el({
                        content: this.previewEl,
                        css: {
                            alignSelf: 'stretch',
                            flexGrow: '1',
                        },
                    }),
                    BB.el({
                        content: [this.openButtonEl, this.storeButtonEl, this.clearButtonEl],
                        css: {
                            display: 'flex',
                            gap: '10px',
                            flexDirection: 'column',
                        },
                    }),
                ],
                css: {
                    marginTop: '10px',
                    display: 'flex',
                    gap: '10px',
                },
            }),
        );

        this.storeListener = {
            onUpdate: (project) => {
                this.updateThumb(project?.timestamp, project?.thumbnail);
            },
        };
        this.projectStore.subscribe(this.storeListener);
        this.updateThumb();
    }

    getElement(): HTMLElement {
        return this.rootEl;
    }

    show(): void {
        if (this.isFirst) {
            this.isFirst = false;
            if (!this.projectStore.getIsAvailable()) {
                this.showError();
            } else {
                (async () => {
                    try {
                        await this.projectStore.update();
                        const meta = this.projectStore.getCurrentMeta();
                        if (meta) {
                            this.updateThumb(meta.timestamp, meta.thumbnail);
                        } else {
                            this.updateThumb();
                        }
                    } catch (e) {
                        this.showError();
                        throw new Error(
                            'browser-storage-ui: failed initial read browser storage, ' + e,
                        );
                    }
                })();
            }
        }
    }

    hide(): void {
        // ...
    }

    destroy(): void {
        this.header.destroy();
        BB.destroyEl(this.storeButtonEl);
        BB.destroyEl(this.clearButtonEl);
        clearInterval(this.updateAgeInterval);
        this.projectStore.unsubscribe(this.storeListener);
    }
}
