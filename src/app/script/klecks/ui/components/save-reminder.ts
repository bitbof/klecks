import {KL} from '../../kl';
import {BB} from '../../../bb/bb';
import {KlHistoryInterface} from '../../history/kl-history';

/**
 * remind user of saving, keep user aware of save state
 */
export class SaveReminder {
    private oldActionNumber: number = null;
    private remindersShowed: number = 0;
    private unsavedInterval;
    private lastReminderResetAt: number;

    constructor (
        private history: KlHistoryInterface,
        private showReminder: boolean,
        private changeTitle: boolean,
        private title: string = 'Klecks'
    ) { }

    init (): void {
        if (this.oldActionNumber !== null) { // already initialized
            return;
        }
        this.oldActionNumber = this.history.getActionNumber();

        if (this.showReminder) {
            setInterval(() => {
                if (document.visibilityState !== 'visible') {
                    return;
                }

                let reminderTimelimitMs = 1000 * 60 * 20; // 20 minutes

                let actionNumber = this.history.getActionNumber();
                //number of actions that were done since last reminder
                let historyDist = Math.abs(actionNumber - this.oldActionNumber);

                if (this.lastReminderResetAt + reminderTimelimitMs < (performance.now()) && historyDist >= 30) {
                    this.reset(true);
                    KL.showSaveReminderToast(this.remindersShowed++);
                }
            }, 1000 * 60);
        }

        // confirmation dialog when closing tab
        function onBeforeUnload(e) {
            e.preventDefault();
            e.returnValue = '';
        }

        this.history.addListener(() => {
            let actionNumber = this.history.getActionNumber();
            if (this.oldActionNumber !== actionNumber) {
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
                    if (this.oldActionNumber !== actionNumber) {
                        document.title = 'Unsaved - ' + this.title;
                        let state = 0;
                        this.unsavedInterval = setInterval(() => {
                            state = (state + 1) % 2;
                            if (state === 1) {
                                document.title = 'Unsaved · ' + this.title;
                            } else {
                                document.title = 'Unsaved - ' + this.title;
                            }
                        }, 1000 * 60 * 3);
                    }
                }
            });
        }
    }

    reset (isSoft?: boolean): void {
        if (this.oldActionNumber === null) { // not initialized
            return;
        }
        if (!isSoft) {
            this.remindersShowed = 0;
        }
        this.lastReminderResetAt = performance.now();
        this.oldActionNumber = this.history.getActionNumber();
        BB.setEventListener(window, 'onbeforeunload', null);
    }
}
