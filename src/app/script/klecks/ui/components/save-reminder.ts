import {KL} from '../../kl';
import {BB} from '../../../bb/bb';
import {KlHistoryInterface} from '../../history/kl-history';
import {LANG} from '../../../language/language';
import {BrowserStorageUi} from './browser-storage-ui';
import {ProjectStore} from '../../storage/project-store';
import {IKlProject} from '../../kl.types';


const reminderTimelimitMs = 1000 * 60 * 20; // 20 minutes
const unsavedActionsLimit = 100; // number of actions user did since last save


/**
 * remind user of saving, keep user aware of save state
 */
export class SaveReminder {
    private lastSavedActionNumber: number = null;
    private lastSavedAt: number;

    private lastReminderShownAt: number;
    private unsavedInterval;
    private closeFunc: () => void;

    showPopup (): void {
        if (!this.projectStore || !this.getProject) {
            throw new Error('projectStore and getProject need to be set');
        }

        const min = Math.round((performance.now() - this.lastSavedAt) / 1000 / 60);

        const contentEl = BB.el({});

        contentEl.append(
            BB.el({
                content: LANG(
                    'save-reminder-text',
                    {
                        a: '<strong>' + min,
                        b: '</strong>',
                    }
                ),
                css: {
                    marginBottom: '20px',
                }
            }),
        );

        const psdWrapper = BB.el({
            css: {
                borderTop: '1px solid #aaa',
                margin: '0 -20px',
                padding: '20px',
            }
        });
        const storageWrapper = BB.el({
            css: {
                borderTop: '1px solid #aaa',
                margin: '0 -20px',
                padding: '20px',
                paddingBottom: '0',
            }
        });
        contentEl.append(psdWrapper, storageWrapper);


        const psdBtn = BB.el({
            tagName: 'button',
            className: 'kl-button',
            content: LANG('save-reminder-save-psd'),
            onClick: () => this.onSaveAsPsd(),
        });
        psdWrapper.append(
            psdBtn,
            BB.el({
                content: LANG('save-reminder-psd-layers'),
                css: {
                    marginTop: '10px',
                }
            }),
        );


        const storageUi = new BrowserStorageUi(
            this.projectStore,
            this.getProject,
            this,
            document.body as any,
            {
                hideClearButton: true,
            }
        );
        storageWrapper.append(storageUi.getElement());


        KL.popup({
            target: document.body,
            message: `<b>${LANG('save-reminder-title')}</b>`,
            div: contentEl,
            ignoreBackground: true,
            callback: () => {
                storageUi.destroy();
                BB.destroyEl(psdBtn);
                this.closeFunc = null;
                this.lastReminderShownAt = performance.now();
            },
            closefunc: (f) => {
                this.closeFunc = f;
            }
        });
        setTimeout(() => {
            psdBtn.focus();
        }, 40);
    }

    constructor (
        private history: KlHistoryInterface,
        private showReminder: boolean,
        private changeTitle: boolean,
        private onSaveAsPsd: () => void,
        private isDrawing: () => boolean,
        private projectStore: ProjectStore | null, // needed if showReminder
        private getProject: (() => IKlProject) | null, // needed if showReminder
        private title: string = 'Klecks',
    ) { }

    init (): void {
        if (this.lastSavedActionNumber !== null) { // already initialized
            return;
        }
        this.lastSavedActionNumber = this.history.getActionNumber();
        this.lastReminderShownAt = performance.now();
        this.lastSavedAt = performance.now();

        if (this.showReminder) {
            setInterval(() => {
                if (document.visibilityState !== 'visible') {
                    return;
                }

                let unsavedActions = Math.abs(this.history.getActionNumber() - this.lastSavedActionNumber);

                if (
                    KL.dialogCounter.get() === 0 &&
                    !this.isDrawing() &&
                    this.lastReminderShownAt + reminderTimelimitMs < performance.now() &&
                    unsavedActions >= unsavedActionsLimit
                ) {
                    this.showPopup();
                }
            }, 1000 * 5);
        }

        // confirmation dialog when closing tab
        function onBeforeUnload(e) {
            e.preventDefault();
            e.returnValue = '';
        }

        this.history.addListener(() => {
            let actionNumber = this.history.getActionNumber();
            if (this.lastSavedActionNumber !== actionNumber) {
                BB.setEventListener(window, 'onbeforeunload', onBeforeUnload);
            } else {
                BB.setEventListener(window, 'onbeforeunload', null);
            }
        });

        if (this.changeTitle) {
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === 'visible') {
                    document.title = this.title;
                    clearInterval(this.unsavedInterval);
                } else {
                    let actionNumber = this.history.getActionNumber();
                    if (this.lastSavedActionNumber !== actionNumber) {
                        document.title = LANG('unsaved') + ' - ' + this.title;
                        let state = 0;
                        this.unsavedInterval = setInterval(() => {
                            state = (state + 1) % 2;
                            if (state === 1) {
                                document.title = LANG('unsaved') + ' · ' + this.title;
                            } else {
                                document.title = LANG('unsaved') + ' - ' + this.title;
                            }
                        }, 1000 * 60 * 3);
                    }
                }
            });
        }
    }

    reset (): void {
        if (this.lastSavedActionNumber === null) { // not initialized
            return;
        }

        this.lastSavedActionNumber = this.history.getActionNumber();
        this.lastReminderShownAt = performance.now();
        this.lastSavedAt = performance.now();
        BB.setEventListener(window, 'onbeforeunload', null);

        if (this.closeFunc) {
            this.closeFunc();
        }
    }
}
