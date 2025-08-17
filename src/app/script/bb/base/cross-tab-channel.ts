import { LocalStorage } from './local-storage';
import { randomUuid } from './base';

export type TCrossTabChannelListener = (message: any) => void;
type TLsEntry = {
    timestamp: number;
    originId: string; // uuid of current tab
    message: any;
};

const originId = randomUuid();

/**
 * broadcast channel with local storage fallback
 */
export class CrossTabChannel {
    private readonly broadcastChannel: BroadcastChannel | undefined;
    private readonly broadcastChannelListeners: {
        preListener: (message: MessageEvent) => void; // extracts message.data
        listener: TCrossTabChannelListener;
    }[] = [];

    // for fallback
    private lastReadTimestamp: number = new Date().getTime();
    private readonly maxAgeMs = 1000 * 10;
    private readonly localStoragePrefix = 'cross-tab-channel--';
    private readonly localStorageListeners: Set<TCrossTabChannelListener> = new Set();

    private readonly onLocalStorageChange = (e: StorageEvent) => {
        if (e.key !== this.getLsKey() || e.newValue === null) {
            // case 1: irrelevant key changed
            // case 2: null means no new message
            // -> noop
            return;
        }
        try {
            const entries = JSON.parse(e.newValue) as TLsEntry[];
            entries.forEach((entry) => {
                if (entry.originId === originId || entry.timestamp <= this.lastReadTimestamp) {
                    // ignore messages from our own tab, or that aren't new
                    return;
                }
                this.lastReadTimestamp = entry.timestamp;
                this.localStorageListeners.forEach((listener) => listener(entry.message));
            });
        } catch (error) {
            // probably invalid value -> reset
            LocalStorage.removeItem(this.getLsKey());
        }
    };

    private getLsKey(): string {
        return this.localStoragePrefix + this.name;
    }

    // ----------------------------------- public ----------------------------------
    constructor(private name: string) {
        if (typeof BroadcastChannel !== 'undefined') {
            this.broadcastChannel = new BroadcastChannel(name);
        }
    }

    postMessage(message: any): void {
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
        } else {
            const now = new Date().getTime();
            let raw: string | null = null;
            try {
                raw = LocalStorage.getItem(this.getLsKey());
            } catch (error) {
                // probably invalid value -> reset
            }
            let entries: TLsEntry[] = raw === null ? [] : JSON.parse(raw);
            entries = entries.filter((entry) => {
                // delete old entries
                return entry.timestamp > now - this.maxAgeMs;
            });
            entries.push({
                timestamp: now,
                originId,
                message,
            });
            LocalStorage.setItem(this.getLsKey(), JSON.stringify(entries));
        }
    }

    subscribe(listener: TCrossTabChannelListener): void {
        if (this.broadcastChannel) {
            const preListener = (message: MessageEvent) => listener(message.data);
            this.broadcastChannelListeners.push({
                preListener,
                listener,
            });
            this.broadcastChannel.addEventListener('message', preListener);
        } else {
            if (this.localStorageListeners.size === 0) {
                window.addEventListener('storage', this.onLocalStorageChange);
            }
            this.localStorageListeners.add(listener);
        }
    }

    unsubscribe(listener: TCrossTabChannelListener): void {
        if (this.broadcastChannel) {
            const match = this.broadcastChannelListeners.find((item) => item.listener === listener);
            if (match) {
                this.broadcastChannel.removeEventListener('message', match.preListener);
            }
        } else {
            this.localStorageListeners.delete(listener);
            if (this.localStorageListeners.size === 0) {
                window.removeEventListener('storage', this.onLocalStorageChange);
            }
        }
    }

    close(): void {
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
        }
    }
}
