/**
 * track how many modals are opened
 */
export class DialogCounter {
    private listeners: ((v: number) => void)[] = [];
    private count = 0;

    private emit(): void {
        this.listeners.forEach((item) => {
            item(this.count);
        });
    }
    // ----------------------------------- public -----------------------------------

    increase(v?: number): void {
        if (v !== undefined) {
            this.count += v;
        } else {
            this.count++;
        }
        this.emit();
    }
    decrease(v?: number): void {
        if (v !== undefined) {
            this.count -= v;
        } else {
            this.count--;
        }
        this.emit();
    }
    get(): number {
        return this.count;
    }
    subscribe(listener: (v: number) => void): void {
        this.listeners.push(listener);
    }
}

export const DIALOG_COUNTER = new DialogCounter();
