import { KL } from '../../kl';
import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { ProjectStore } from '../../storage/project-store';
import { TKlProject } from '../../kl-types';
import { KlHistory } from '../../history/kl-history';
import { LocalStorage } from '../../../bb/base/local-storage';
import * as classes from './save-reminder.module.scss';
import { BrowserStorageUi } from './browser-storage-ui';

export type TSaveReminderSetting = '20min' | '40min' | 'disabled';

const DEBUG_TIME_LIMIT_MS: undefined | number = undefined;
const DEBUG_UNSAVED_ACTIONS_LIMIT: undefined | number = undefined;
// minimum number of actions required for reminder to show up (regardless of time limit)
const UNSAVED_ACTIONS_LIMIT = DEBUG_UNSAVED_ACTIONS_LIMIT ?? 100;
const LS_REMINDER_KEY = 'kl-save-reminder';

export type TSaveReminderParams = {
    onSaveAsPsd: () => void;
    isDrawing: () => boolean;
    projectStore: ProjectStore; // needed if showReminder
    getProject: () => TKlProject; // needed if showReminder
    onStored: () => void;
    applyUncommitted: () => void;
    klHistory: KlHistory;
};

/**
 * remind user of saving, keep user aware of save state
 */
export class SaveReminder {
    private readonly onSaveAsPsd: () => void;
    private readonly isDrawing: () => boolean;
    private readonly projectStore: ProjectStore;
    private readonly getProject: () => TKlProject;
    private readonly onStored: () => void;
    private readonly applyUncommitted: () => void;
    private klHistory: KlHistory = {} as KlHistory;

    private setting: TSaveReminderSetting;
    private lastSavedHistoryIndex: number | undefined;
    private lastSavedAt: number = 0;

    private lastReminderShownAt: number = 0;
    private closeFunc: (() => void) | undefined;

    showPopup(): void {
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
            className: classes.psdWrapper,
        });
        const storageWrapper = BB.el({
            css: {
                margin: '0 -20px',
                padding: '20px',
                paddingBottom: '0',
            },
        });
        contentEl.append(psdWrapper, storageWrapper);

        const psdBtn = BB.el({
            tagName: 'button',
            className: 'kl-button kl-button-primary kl-button--extra-focus',
            content: LANG('save-reminder-save-psd'),
            onClick: () => {
                this.applyUncommitted();
                this.onSaveAsPsd();
            },
            css: { padding: '14px' },
            noRef: true,
        });
        psdWrapper.append(
            psdBtn,
            BB.el({
                content: '✔ ' + LANG('save-reminder-psd-layers'),
                css: {
                    marginTop: '10px',
                },
            }),
        );

        const storageUi = new BrowserStorageUi({
            projectStore: this.projectStore,
            getProject: this.getProject,
            klRootEl: document.body,
            applyUncommitted: this.applyUncommitted,
            options: {
                hideClearButton: true,
                isFocusable: true,
            },
            onStored: () => this.onStored(),
        });
        storageUi.show();
        storageWrapper.append(storageUi.getElement());

        KL.popup({
            type: 'warning',
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

    // ----------------------------------- public -----------------------------------
    constructor(p: TSaveReminderParams) {
        this.onSaveAsPsd = p.onSaveAsPsd;
        this.isDrawing = p.isDrawing;
        this.projectStore = p.projectStore;
        this.getProject = p.getProject;
        this.onStored = p.onStored;
        this.applyUncommitted = p.applyUncommitted;
        this.klHistory = p.klHistory;

        this.setting =
            (LocalStorage.getItem(LS_REMINDER_KEY) as TSaveReminderSetting | null) ?? '40min';
    }

    init(): void {
        if (this.lastSavedHistoryIndex !== undefined) {
            // already initialized
            return;
        }
        this.lastSavedHistoryIndex = this.klHistory.getTotalIndex();
        this.lastReminderShownAt = performance.now();
        this.lastSavedAt = performance.now();

        setInterval(() => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            const unsavedActions = Math.abs(
                this.klHistory.getTotalIndex() - this.lastSavedHistoryIndex!,
            );

            const timeLimitMs =
                DEBUG_TIME_LIMIT_MS ??
                1000 *
                    60 *
                    {
                        '20min': 20,
                        '40min': 40,
                        disabled: 0,
                    }[this.setting];

            if (
                timeLimitMs > 0 &&
                KL.DIALOG_COUNTER.get() === 0 &&
                !this.isDrawing() &&
                this.lastReminderShownAt + timeLimitMs < performance.now() &&
                unsavedActions >= UNSAVED_ACTIONS_LIMIT
            ) {
                this.showPopup();
            }
        }, 1000 * 5);
    }

    reset(): void {
        if (this.lastSavedHistoryIndex === undefined) {
            // not initialized
            return;
        }

        this.lastSavedHistoryIndex = this.klHistory.getTotalIndex();
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
        LocalStorage.setItem(LS_REMINDER_KEY, this.setting);
    }
}
