import { KlHistory } from '../history/kl-history';
import { TDeserializedKlStorageProject } from '../kl-types';
import {
    changeRecoveryId,
    clearOldRecoveries,
    deleteRecovery,
    getIdsFromRecoveryStore,
    getMetadata,
    getRecovery,
    removeOrphans,
    storeRecovery,
} from './kl-recovery-storage';
import { createArray, sleep, timeoutWrapper } from '../../bb/base/base';
import { CrossTabChannel } from '../../bb/base/cross-tab-channel';
import { KL_INDEXED_DB } from './kl-indexed-db';

export const RECOVERY_THUMB_WIDTH_PX = 300;
export const RECOVERY_THUMB_HEIGHT_PX = 180;
export const RECOVERY_AGE_LIMIT_MS = 1000 * 60 * 60 * 24 * 7; // 1 week
export const RECOVERY_MEMORY_LIMIT_BYTES = 1e9;
const FIRST_RECOVERY_AFTER_MS = 1000 * 60 * 5;
export const FIRST_RECOVERY_AFTER_CHANGES = 8;
const SUBSEQUENT_RECOVERY_AFTER_MS = 1000 * 60;
const SUBSEQUENT_RECOVERY_AFTER_CHANGES = 4;
export const DEBUG_RETURN_ALL_RECOVERIES: boolean = false;
export const DEBUG_INSTANT_RECOVERY: boolean = false;

export function setHash(value?: string) {
    if (value === undefined) {
        history.replaceState(null, '', ' ');
        return;
    }
    // avoid creating a new history state
    history.replaceState(
        null,
        '',
        window.location.origin + window.location.pathname + window.location.search + '#' + value,
    );
}
function getHash(): string | undefined {
    // returns without the "#"
    return window.location.hash ? window.location.hash.substring(1) : undefined;
}

const ignoredHashes = ['licenses'];

function hashToTabId(rawHash: string | undefined): number | undefined {
    if (rawHash === undefined || ignoredHashes.includes(rawHash)) {
        return undefined;
    }
    const num = +rawHash;
    if (isNaN(num) || num < 0 || num % 1 !== 0) {
        return undefined;
    }
    return num;
}

function genNewId(takenIds: number[]): number {
    const limit = 1000;
    if (takenIds.length >= limit) {
        throw new Error('No available IDs');
    }
    const idSet = new Set(takenIds);
    const pool = createArray(limit, 0)
        .map((_, index) => index)
        .filter((id) => !idSet.has(id));
    const index = Math.floor(Math.random() * pool.length);
    if (pool[index] === undefined) {
        throw new Error('No available IDs');
    }
    return pool[index];
}

export type TKlRecoveryListener = (
    metas: TRecoveryMetaData[],
    totalMemoryUsedBytes: number,
) => void;

export type TKlRecoveryManagerParams = object;

/**
 * handles all recovery logic.
 * - determines the tabId
 * - stores and updates the recovery automatically
 * - updates the hash in the url
 * - does cleanup (orphans, old drawings, exceeding memory)
 */
export class KlRecoveryManager {
    private klHistory: KlHistory = {} as KlHistory;
    private isStoring: boolean = false;
    private getThumbnail: ((factor: number) => HTMLCanvasElement) | undefined;
    private tabId: number | undefined; // undefined if tab without hash in URL
    private listeners: Set<TKlRecoveryListener> = new Set<TKlRecoveryListener>();
    private readonly crossTabChannel: CrossTabChannel = new CrossTabChannel('kl-tab-communication');
    private noRecoveryReason:
        | 'noTabIdHash'
        | 'alreadyOpened'
        | 'idNotFound'
        | 'idChangeFailed'
        | undefined;

    private announceTabId(): void {
        this.crossTabChannel.postMessage({ type: 'new-tab' });
    }

    private initListeners(): void {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                return;
            }
            // changes may have happened since tab last visible

            // might not register a tab is closed without timeout
            setTimeout(() => {
                this.update();
            }, 500);
        });

        window.addEventListener('focus', () => {
            setTimeout(() => {
                this.update();
            }, 500);
        });

        this.crossTabChannel.subscribe((message) => {
            if (message.type === 'new-tab') {
                if (document.hidden) {
                    // we'll update when tab visible. noop.
                    return;
                }
                setTimeout(() => {
                    this.update();
                }, 500);
            }
            if (message.type === 'request-ids') {
                if (this.tabId !== undefined) {
                    this.crossTabChannel.postMessage({ type: 'response-ids', id: this.tabId });
                }
            }
        });

        // I think this is not needed
        let debounceTimeout: ReturnType<typeof setTimeout> | undefined;
        /*KL_INDEXED_DB.addListener(async () => {
            if (document.hidden) {
                return;
            }
            console.log('indexed db change!');
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                this.update();
            }, 100);
        });*/
    }

    private async emitUpdate(): Promise<void> {
        if (!KL_INDEXED_DB.getIsAvailable()) {
            return;
        }

        const ids = await getIdsFromRecoveryStore();
        const otherTabIds = await this.getIdsFromTabs();
        const tabIds = DEBUG_RETURN_ALL_RECOVERIES
            ? ids
            : ids.filter((id) => !otherTabIds.includes(id) && id !== this.tabId);
        const drawings = await Promise.all(
            tabIds.map((id) => {
                return getMetadata('' + id, true);
            }),
        );

        const totalMemoryUsedBytes = await this.getTotalMemoryUsedBytes();
        this.listeners.forEach((listener) => {
            listener(drawings, totalMemoryUsedBytes);
        });
    }

    setHash(id: number | undefined): void {
        setHash(id === undefined ? undefined : '' + id);
        this.announceTabId();
    }

    private async getIdsFromTabs(): Promise<number[]> {
        this.crossTabChannel.postMessage({ type: 'request-ids' });
        const result: number[] = [];
        const onMessage = (message: any) => {
            if (message.type === 'response-ids') {
                result.push(+message.id);
            }
        };
        this.crossTabChannel.subscribe(onMessage);
        await sleep(100);
        this.crossTabChannel.unsubscribe(onMessage);
        return result;
    }

    private async getTotalMemoryUsedBytes(): Promise<number> {
        const ids = await getIdsFromRecoveryStore();
        let result = 0;
        for (const id of ids) {
            const meta = await getMetadata('' + id);
            result += meta.memoryEstimateBytes;
        }
        return result;
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TKlRecoveryManagerParams) {
        this.initListeners();
    }

    async getRecovery(): Promise<TDeserializedKlStorageProject | undefined> {
        // is there a tabId?
        const initialTabId: number | undefined = hashToTabId(getHash());
        if (initialTabId === undefined) {
            this.noRecoveryReason = 'noTabIdHash';
            // we get a tabId later
            return undefined;
        }

        // is there another tab with the same tabId?
        const openTabIds = await this.getIdsFromTabs();
        if (openTabIds.includes(initialTabId)) {
            this.noRecoveryReason = 'alreadyOpened';
            // Already exists -> unset tabId. Nothing to load.
            this.setHash(undefined);
            return undefined;
        }
        // is id in storage?
        const storedIds = await getIdsFromRecoveryStore();
        if (!storedIds.includes(initialTabId)) {
            this.noRecoveryReason = 'idNotFound';
            // not found -> unset tabId and abort
            this.setHash(undefined);
            return undefined;
        }

        // change id of drawing and tab
        const newId = genNewId(storedIds);
        if (!(await changeRecoveryId(initialTabId, newId))) {
            this.noRecoveryReason = 'idChangeFailed';
            this.setHash(undefined);
            return undefined;
        }
        this.setHash(newId); // update hash

        const result = await getRecovery(newId);
        if (result) {
            this.tabId = newId;
        }
        setTimeout(() => {
            // don't disrupt loading
            removeOrphans();
        });
        return result;
    }

    setKlHistory(klHistory: KlHistory) {
        this.klHistory = klHistory;
        let startTime = new Date().getTime();
        let lastStoredChangeCount = 0;

        this.klHistory.addListener(async () => {
            if (this.isStoring) {
                return;
            }
            const changeCount = this.klHistory.getChangeCount();
            if (!DEBUG_INSTANT_RECOVERY) {
                const deltaMs = new Date().getTime() - startTime;
                // initial store after 5 minutes
                if (
                    this.tabId === undefined &&
                    (deltaMs < FIRST_RECOVERY_AFTER_MS ||
                        changeCount < FIRST_RECOVERY_AFTER_CHANGES)
                ) {
                    return;
                }
                // subsequent store after 1 minutes
                if (
                    this.tabId !== undefined &&
                    (deltaMs < SUBSEQUENT_RECOVERY_AFTER_MS ||
                        changeCount - lastStoredChangeCount < SUBSEQUENT_RECOVERY_AFTER_CHANGES)
                ) {
                    return;
                }
            }

            let isFreshDrawing = false;
            if (!this.tabId) {
                const storedIds = await timeoutWrapper(
                    getIdsFromRecoveryStore(),
                    'setKlHistory.getIdsFromStore',
                );
                this.tabId = genNewId(storedIds);
                isFreshDrawing = true;
            }
            this.isStoring = true;
            try {
                await storeRecovery(this.tabId, this.klHistory.getComposed(), this.getThumbnail!);
                startTime = new Date().getTime();
            } catch (e) {
                setTimeout(() => {
                    throw e;
                });
            }
            if (isFreshDrawing) {
                this.setHash(this.tabId);
                await clearOldRecoveries();
            }
            startTime = new Date().getTime();
            lastStoredChangeCount = changeCount;
            this.isStoring = false;
        });
    }

    setGetThumbnail(getThumbnail: (factor: number) => HTMLCanvasElement) {
        this.getThumbnail = getThumbnail;
    }

    /**
     * Listener will be informed about recoveries in closed tabs.
     * totalMemoryUsesBytes includes recoveries in open tabs
     */
    subscribe(listener: TKlRecoveryListener): void {
        this.listeners.add(listener);
    }

    unsubscribe(listener: TKlRecoveryListener): void {
        this.listeners.delete(listener);
    }

    // re-checks what recoveries exist
    async update(): Promise<void> {
        if (this.listeners.size > 0) {
            await this.emitUpdate();
        }
    }

    async remove(recoveryId: number): Promise<void> {
        await deleteRecovery('' + recoveryId);
        this.update();
    }

    getTabId(): number | undefined {
        return this.tabId;
    }

    getNoRecoveryReason(): KlRecoveryManager['noRecoveryReason'] {
        return this.noRecoveryReason;
    }

    destroy(): void {
        // todo
    }
}

export type TRecoveryMetaData = {
    id: string;
    width: number;
    height: number;
    timestamp: number;
    thumbnail?: HTMLImageElement | HTMLCanvasElement;
    memoryEstimateBytes: number;
};
