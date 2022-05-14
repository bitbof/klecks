import {BB} from '../../../bb/bb';

// @ts-ignore
import removeLayerImg from 'url:~/src/app/img/ui/remove-layer.svg';
import {IKlProject} from '../../kl.types';
import {showIframePopup} from '../modals/show-iframe-popup';
import {SaveReminder} from './save-reminder';
import {IProjectStoreListener, ProjectStore} from '../../storage/project-store';
import {KL} from '../../kl';
import {LANG} from '../../../language/language';

export class BrowserStorageUi {

    private previewEl: HTMLDivElement;
    private infoEl: HTMLDivElement;
    private ageEl: HTMLDivElement;
    private storeEl: HTMLButtonElement;
    private clearEl: HTMLButtonElement;
    private storeListener: IProjectStoreListener;

    private timestamp: number;

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
            this.storeEl.textContent = LANG('file-storage-overwrite');
            this.storeEl.disabled = false;
            this.clearEl.disabled = false;
        } else {
            this.storeEl.textContent = LANG('file-storage-store');
            this.storeEl.disabled = false;
            this.clearEl.disabled = true;
        }
    }

    private updateThumb(timestamp?: number, thumbnail?: HTMLImageElement | HTMLCanvasElement) {
        this.timestamp = timestamp;
        if (this.timestamp) {
            BB.css(thumbnail, {
                display: 'block',
                maxWidth: 'calc(100% - 2px)',
                maxHeight: 'calc(100% - 2px)',
                margin: '0 auto',
                background: "url('" + BB.createCheckerCanvas(4).toDataURL('image/png') + "')",
                boxShadow: '0 0 0 1px #aaa',
                pointerEvents: 'none',
            });
            this.previewEl.innerHTML = '';
            this.updateAge();
            this.previewEl.append(thumbnail, this.ageEl);
        } else {
            this.previewEl.innerHTML = LANG('file-storage-empty');
        }
        this.resetButtons();
    }

    private async store() {
        this.storeEl.textContent = LANG('file-storage-storing');
        this.storeEl.disabled = true;
        this.clearEl.disabled = true;
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
                    `</ul>`,
                ].join(''),
                buttons: ['Ok'],
            });
            setTimeout(() => {
                throw new Error('storage-ui: failed to store browser storage, ' + e);
            }, 0);
        }
    }

    private async clear() {
        this.storeEl.disabled = true;
        this.clearEl.disabled = true;
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

    constructor (
        private projectStore: ProjectStore,
        private getProject: () => IKlProject,
        private saveReminder: SaveReminder,
        private klRootEl: HTMLDivElement,
        private options?: { hideClearButton?: boolean },
    ) {
        this.element = BB.el({
            css: {
                display: 'grid',
                gridTemplateColumns: '1fr 0fr',
                gridTemplateRows: '0fr 0fr 0fr',
                gap: '0 0',
                gridTemplateAreas: '"title title" "preview store" "preview clear"',
            }
        }) as HTMLDivElement;


        const title = BB.el({
            parent: this.element,
            content: LANG('file-storage'),
            css: {
                gridArea: 'title',
                display: 'flex',
                margin: '-5px 0',
                //background: '#f00',
            }
        });

        this.infoEl = BB.el({
            parent: title,
            content: '?',
            title: LANG('file-storage-about'),
            css: {
                cursor: 'pointer',
                marginLeft: '5px',
                width: '19px',
                height: '19px',
                borderRadius: '100%',
                textAlign: 'center',
                lineHeight: '19px',
                fontWeight: 'bold',
                boxShadow: 'inset 0 0 0 1px #000',
            },
            onClick: () => {
                showIframePopup('./help/#help-browser-storage', false);
            }
        }) as HTMLDivElement;

        if (this.projectStore.isBroken()) {
            BB.el({
                parent: this.element,
                content: "🔴 " + LANG('file-storage-cant-access'),
                css: {
                    marginTop: '10px',
                }
            });
            return;
        }

        this.previewEl = BB.el({
            parent: this.element,
            title: LANG('file-storage-thumb-title'),
            css: {
                gridArea: 'preview',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '10px',
                position: 'relative',
                boxShadow: 'inset 0 0 0 1px #aaa',
                background: '#cdcdcd',
                color: '#545454',
                colorScheme: 'only light',
                minHeight: '67px',
            }
        }) as HTMLDivElement;
        this.ageEl = BB.el({
            css: {
                position: 'absolute',
                right: '0',
                bottom: '0',
                width: '100%',
                textAlign: 'center',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                textSize: '13px',
            }
        }) as HTMLDivElement;
        this.storeEl = BB.el({
            parent: this.element,
            tagName: 'button',
            className: 'gridButton',
            content: LANG('file-storage-store'),
            css: {
                gridArea: 'store',
                //background: '#00f',
            },
            custom: {
                tabIndex: -1,
            },
            onClick: () => this.store(),
        }) as HTMLButtonElement;
        this.storeEl.tabIndex = -1;
        this.clearEl = BB.el({
            parent: this.element,
            tagName: 'button',
            className: 'gridButton',
            content: '<img src="' + removeLayerImg + '" height="20"/> ' + LANG('file-storage-clear'),
            css: {
                gridArea: 'clear',
                //background: '#ff0',
            },
            custom: {
                tabIndex: -1,
            },
            onClick: () => this.clear(),
        }) as HTMLButtonElement;

        if (this.options?.hideClearButton) {
            this.clearEl.style.display = 'none';
        }

        this.storeListener = {
            onUpdate: (timestamp, thumbnail) => {
                this.updateThumb(timestamp, thumbnail);
            },
        };
        this.projectStore.subscribe(this.storeListener);

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

    show () {
        // todo
    }

    hide () {
        // todo
    }

    destroy() {
        BB.destroyEl(this.infoEl);
        BB.destroyEl(this.storeEl);
        BB.destroyEl(this.clearEl);
        this.projectStore.unsubscribe(this.storeListener);
    }
}