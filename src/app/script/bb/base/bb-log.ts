type TLogListener = (msg: any) => void;

export class BbLog {
    private static listeners: TLogListener[] = [];

    constructor() {}

    static subscribe(listener: TLogListener): void {
        if (BbLog.listeners.includes(listener)) {
            return;
        }
        BbLog.listeners.push(listener);
    }

    static unsubscribe(listener: TLogListener): void {
        for (let i = 0; i < BbLog.listeners.length; i++) {
            if (listener === BbLog.listeners[i]) {
                BbLog.listeners.splice(i, 1);
                return;
            }
        }
    }

    static emit(msg: any): void {
        BbLog.listeners.forEach((item) => {
            item(msg);
        });
    }
}
