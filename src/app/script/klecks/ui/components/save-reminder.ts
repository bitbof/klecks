import {KL} from '../../kl';
import {BB} from '../../../bb/bb';

/**
 * remind user of saving, keep user aware of save state
 */
export class SaveReminder {
    private oldActionNumber: [number, number];
    private remindersShowed: number = 0;
    private unsavedInterval;
    private lastReminderResetAt: number;

    constructor(private history, private showReminder: boolean, private changeTitle: boolean, private title: string = 'Klecks') { }

    init() {
        if (this.oldActionNumber) { // already initialized
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
                let historyDist = actionNumber[0] !== this.oldActionNumber[0] ? actionNumber[1] : Math.abs(actionNumber[1] - this.oldActionNumber[1]);

                if(this.lastReminderResetAt + reminderTimelimitMs < (performance.now()) && historyDist >= 30) {
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
            if(0 !== actionNumber && this.oldActionNumber.join('.') !== actionNumber.join('.')) {
                BB.setEventListener(window, 'onbeforeunload', onBeforeUnload);
            } else {
                BB.setEventListener(window, 'onbeforeunload', null);
            }
        });

        if (this.changeTitle) {
            document.addEventListener("visibilitychange", () => {
                if(document.visibilityState === 'visible') {
                    document.title = this.title;
                    clearInterval(this.unsavedInterval);
                } else {
                    let actionNumber = this.history.getActionNumber();
                    if(0 !== actionNumber && this.oldActionNumber.join('.') !== actionNumber.join('.')) {
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

    reset(isSoft?) {
        if (!this.oldActionNumber) { // not initialized
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
