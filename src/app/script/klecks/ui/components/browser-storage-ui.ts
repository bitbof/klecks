import {BB} from '../../../bb/bb';

// @ts-ignore
import removeLayerImg from 'url:~/src/app/img/ui/remove-layer.svg';
import {IKlProject} from '../../kl.types';
import {showIframePopup} from '../modals/show-iframe-popup';
import {SaveReminder} from './save-reminder';
import {ProjectStore} from '../../storage/project-store';
import {KL} from '../../kl';

export class BrowserStorageUi {

    private previewEl: HTMLDivElement;
    private ageEl: HTMLDivElement;
    private storeEl: HTMLButtonElement;
    private clearEl: HTMLButtonElement;

    private timestamp: number;

    private updateAge() {
        if (!this.timestamp) {
            return;
        }
        let age = new Date().getTime() - this.timestamp;
        let ageStr;
        age = Math.floor(age / 1000 / 60);
        ageStr = age + 'min ago';
        if (age > 60) {
            age = Math.floor(age / 60);
            ageStr = age + 'h ago';
            if (age > 24) {
                age = Math.floor(age / 24);
                ageStr = age + 'd ago';
                if (age > 31) {
                    ageStr = '> 1month ago';
                }
            }
        }
        this.ageEl.textContent = ageStr;
    }

    private resetButtons() {
        if (this.timestamp) {
            this.storeEl.textContent = 'Overwrite';
            this.storeEl.disabled = false;
            this.clearEl.disabled = false;
        } else {
            this.storeEl.textContent = 'Store';
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
            this.previewEl.innerHTML = 'Empty';
        }
        this.resetButtons();
    }

    private async store() {
        this.storeEl.textContent = 'Storing...';
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
                message: 'Failed to store. Possible causes:<ul><li>Out of disk space</li><li>Storage disabled in incognito tab</li><li>Browser doesn\'t support storage</li>',
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
                message: 'Failed to clear.',
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
            content: 'Browser Storage',
            css: {
                gridArea: 'title',
                display: 'flex',
                margin: '-5px 0',
                //background: '#f00',
            }
        });

        const infoEl = BB.el({
            parent: title,
            content: '?',
            title: 'About Browser Storage',
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
        });

        if (this.projectStore.isBroken()) {
            BB.el({
                parent: this.element,
                content: "🔴 Can't access",
            });
            return;
        }

        this.previewEl = BB.el({
            parent: this.element,
            title: 'Restores when reopening page',
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
            content: 'Store',
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
            content: '<img src="' + removeLayerImg + '" height="20"/> Clear',
            css: {
                gridArea: 'clear',
                //background: '#ff0',
            },
            custom: {
                tabIndex: -1,
            },
            onClick: () => this.clear(),
        }) as HTMLButtonElement;

        this.projectStore.subscribe({
            onUpdate: (timestamp, thumbnail) => {
                this.updateThumb(timestamp, thumbnail);
            },
        });

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
}