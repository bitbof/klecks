import { KL } from '../../kl';
import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { BrowserStorageUi } from './browser-storage-ui';
import { ProjectStore } from '../../storage/project-store';
import { IKlProject } from '../../kl-types';
import { KlHistory } from '../../history/kl-history';

export type TSaveReminderSetting = '20min' | '40min' | 'disabled';

const unsavedActionsLimit = 100; // number of actions user did since last save
const LS_REMINDER_KEY = 'kl-save-reminder';

/**
 * remind user of saving, keep user aware of save state
 */
export class SaveReminder {
    private setting: TSaveReminderSetting;

    private history: KlHistory = {} as KlHistory;
    private lastSavedHistoryIndex: number | undefined;
    private lastSavedAt: number = 0;

    private lastReminderShownAt: number = 0;
    private unsavedInterval: ReturnType<typeof setInterval> | undefined;
    private closeFunc: (() => void) | undefined;

    showPopup(): void {
        if (!this.projectStore || !this.getProject) {
            throw new Error('projectStore and getProject need to be set');
        }

        const min = Math.round((performance.now() - this.lastSavedAt) / 1000 / 60);

        const contentEl = BB.el();

        contentEl.append(
            BB.el({
                content: LANG('save-reminder-text', {
                    a: '<strong>' + min,
                    b: '</strong>',
                }),
                css: {
                    marginBottom: '20px',
                },
            }),
        );

        const psdWrapper = BB.el({
            css: {
                borderTop: '1px solid #aaa',
                margin: '0 -20px',
                padding: '20px',
            },
        });
        const storageWrapper = BB.el({
            css: {
                borderTop: '1px solid #aaa',
                margin: '0 -20px',
                padding: '20px',
                paddingBottom: '0',
            },
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
                },
            }),
        );

        const storageUi = new BrowserStorageUi(
            this.projectStore,
            this.getProject,
            this,
            document.body,
            () => {},
            {
                hideClearButton: true,
                isFocusable: true,
            },
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
                this.closeFunc = undefined;
                this.lastReminderShownAt = performance.now();
            },
            closeFunc: (f) => {
                this.closeFunc = f;
            },
        });
        setTimeout(() => {
            psdBtn.focus();
        }, 40);
    }

    constructor(
        private showReminder: boolean,
        private changeTitle: boolean,
        private onSaveAsPsd: () => void,
        private isDrawing: () => boolean,
        private projectStore: ProjectStore | null, // needed if showReminder
        private getProject: (() => IKlProject) | null, // needed if showReminder
        private title: string = 'Klecks',
    ) {
        this.setting =
            (localStorage.getItem(LS_REMINDER_KEY) as TSaveReminderSetting | null) ?? '20min';
    }

    init(): void {
        if (this.lastSavedHistoryIndex !== undefined) {
            // already initialized
            return;
        }
        this.lastSavedHistoryIndex = this.history.getCurrentIndex();
        this.lastReminderShownAt = performance.now();
        this.lastSavedAt = performance.now();

        if (this.showReminder) {
            setInterval(() => {
                if (document.visibilityState !== 'visible') {
                    return;
                }

                const unsavedActions = Math.abs(
                    this.history.getCurrentIndex() - this.lastSavedHistoryIndex!,
                );

                const timeLimitMs =
                    1000 *
                    60 *
                    {
                        '20min': 20,
                        '40min': 40,
                        disabled: 0,
                    }[this.setting];

                if (
                    timeLimitMs > 0 &&
                    KL.dialogCounter.get() === 0 &&
                    !this.isDrawing() &&
                    this.lastReminderShownAt + timeLimitMs < performance.now() &&
                    unsavedActions >= unsavedActionsLimit
                ) {
                    this.showPopup();
                }
            }, 1000 * 5);
        }

        // confirmation dialog when closing tab
        function onBeforeUnload(e: BeforeUnloadEvent) {
            e.preventDefault();
            e.returnValue = '';
        }

        this.history.addListener(() => {
            const historyIndex = this.history.getCurrentIndex();
            if (this.lastSavedHistoryIndex !== historyIndex) {
                window.onbeforeunload = onBeforeUnload;
            } else {
                window.onbeforeunload = null;
            }
        });

        if (this.changeTitle) {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    document.title = this.title;
                    clearInterval(this.unsavedInterval);
                } else {
                    const historyIndex = this.history.getCurrentIndex();
                    if (this.lastSavedHistoryIndex !== historyIndex) {
                        document.title = LANG('unsaved') + ' - ' + this.title;
                        let state = 0;
                        this.unsavedInterval = setInterval(
                            () => {
                                state = (state + 1) % 2;
                                if (state === 1) {
                                    document.title = LANG('unsaved') + ' · ' + this.title;
                                } else {
                                    document.title = LANG('unsaved') + ' - ' + this.title;
                                }
                            },
                            1000 * 60 * 3,
                        );
                    }
                }
            });
        }
    }

    reset(): void {
        if (this.lastSavedHistoryIndex === undefined) {
            // not initialized
            return;
        }

        this.lastSavedHistoryIndex = this.history.getCurrentIndex();
        this.lastReminderShownAt = performance.now();
        this.lastSavedAt = performance.now();
        window.onbeforeunload = null;

        if (this.closeFunc) {
            this.closeFunc();
        }
    }

    getSetting(): TSaveReminderSetting {
        return this.setting;
    }

    setSetting(setting: TSaveReminderSetting): void {
        this.setting = setting;
        localStorage.setItem(LS_REMINDER_KEY, this.setting);
    }

    setHistory(history: KlHistory): void {
        this.history = history;
    }
}
