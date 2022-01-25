
export class BbLog {

    private static listeners: any[] = [];

    constructor() {
    }

    static subscribe(listener) {
        if (BbLog.listeners.includes(listener)) {
            return;
        }
        BbLog.listeners.push(listener);
    }

    static unsubscribe(listener) {
        for (let i = 0; i < BbLog.listeners.length; i++) {
            if (listener === BbLog.listeners[i]) {
                BbLog.listeners.splice(i, 1);
                return;
            }
        }
    }

    static emit (msg) {
        BbLog.listeners.forEach(item => {
            item(msg);
        });
    }
}