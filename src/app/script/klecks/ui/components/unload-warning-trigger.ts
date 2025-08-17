import { KlHistory } from '../../history/kl-history';

export type TUnloadWarningTriggerParams = {
    klHistory: KlHistory;
    getLastSavedHistoryIndex: () => number;
};

export class UnloadWarningTrigger {
    private readonly klHistory: KlHistory;
    private readonly getLastSavedHistoryIndex: () => number;
    private readonly onBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
    };

    // ----------------------------------- public -----------------------------------
    constructor(p: TUnloadWarningTriggerParams) {
        this.klHistory = p.klHistory;
        this.getLastSavedHistoryIndex = p.getLastSavedHistoryIndex;
        p.klHistory.addListener(() => this.update());
    }

    update(): void {
        const historyIndex = this.klHistory.getTotalIndex();
        if (this.getLastSavedHistoryIndex() !== historyIndex) {
            window.addEventListener('beforeunload', this.onBeforeUnload);
        } else {
            window.removeEventListener('beforeunload', this.onBeforeUnload);
        }
    }

    destroy(): void {
        //...
    }
}
