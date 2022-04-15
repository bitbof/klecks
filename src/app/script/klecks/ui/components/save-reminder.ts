import {KL} from '../../kl';
import {BB} from '../../../bb/bb';
import {KlHistoryInterface} from '../../history/kl-history';
import {LANG} from '../../../language/language';


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
    private popupIsOpen = false;
    private closeFunc: () => void;

    showPopup (): void {
        this.popupIsOpen = true;
        const min = Math.round((performance.now() - this.lastSavedAt) / 1000 / 60);

        const saveBtn = BB.el({
            tagName: 'button',
            className: 'kl-button-primary',
            content: LANG('save-reminder-save-psd'),
            onClick: () => this.onSaveAsPsd(),
        });
        KL.popup({
            target: document.body,
            message: `<b>${LANG('save-reminder-title')}</b>`,
            div: BB.el({
                content: [
                    BB.el({
                        content: LANG(
                            'save-reminder-text',
                            {
                                a: '<strong>' + min,
                                b: '</strong>',
                            }
                        ) + '<br><br>',
                    }),
                    saveBtn,
                    BB.el({content:'<br>' + LANG('save-reminder-psd-layers')}),
                ]
            }),
            ignoreBackground: true,
            callback: () => {
                BB.destroyEl(saveBtn);
                this.popupIsOpen = false;
                this.closeFunc = null;
                this.lastReminderShownAt = performance.now();
            },
            closefunc: (f) => {
                this.closeFunc = f;
            }
        });
        setTimeout(() => {
            saveBtn.focus();
        }, 40);
    }

    constructor (
        private history: KlHistoryInterface,
        private showReminder: boolean,
        private changeTitle: boolean,
        private onSaveAsPsd: () => void,
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
                    !this.popupIsOpen &&
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
