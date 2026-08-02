import { KlHistory } from '../history/kl-history';
import { TDeserializedKlStorageProject } from '../kl-types';
import {
    clearOldRecoveries,
    deleteRecovery,
    getRecoveryAndUpdateId,
    getRecoveryOverview,
    removeOrphans,
    storeRecovery,
} from './kl-recovery-storage';
import { deserializeRecovery } from './kl-recovery-serialization';
import { css, sleep } from '../../bb/base/base';
import { CrossTabChannel } from '../../bb/base/cross-tab-channel';
import { KL_INDEXED_DB } from './kl-indexed-db';
import loadingImg from 'url:/src/app/img/ui/loading.gif';

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
export const DEBUG_SYNC: boolean = false;

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

export type TRecoveryMetaData = {
    id: string;
    timestamp: number;
    thumbnail: HTMLImageElement | HTMLCanvasElement;
    memoryEstimateBytes: number;
};

export type TKlRecoveryListener = (
    // recoveries in closed tabs
    metas: TRecoveryMetaData[],
    // total memory also includes opened tabs
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
    private noRecoveryReason: 'noTabIdHash' | 'alreadyOpened' | 'idNotFound' | undefined;
    private updateTimeout: ReturnType<typeof setTimeout> | undefined;

    private setIsStoring(isStoring: boolean): void {
        this.isStoring = isStoring;
        DEBUG_SYNC && showSyncIndicator(isStoring);
    }

    private announceTabId(): void {
        this.crossTabChannel.postMessage({ type: 'new-tab' });
    }

    private delayedUpdate(): void {
        clearTimeout(this.updateTimeout);
        // timeout makes it more likely it can register that a tab was closed
        this.updateTimeout = setTimeout(() => {
            this.updateTimeout = undefined;
            this.update();
        }, 500);
    }

    private initListeners(): void {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                return;
            }
            // changes may have happened since tab last visible

            this.delayedUpdate();
        });

        window.addEventListener('focus', () => {
            // Imagine you have two windows with the app open. You work in one, then focus the other window
            // and work there. Changes may have happened.
            this.delayedUpdate();
        });

        this.crossTabChannel.subscribe((message) => {
            if (message.type === 'new-tab') {
                if (document.hidden) {
                    // we'll update when tab visible. noop.
                    return;
                }
                this.delayedUpdate();
            }
            if (message.type === 'request-ids') {
                if (this.tabId !== undefined) {
                    this.crossTabChannel.postMessage({ type: 'response-ids', id: this.tabId });
                }
            }
        });
    }

    private async emitUpdate(): Promise<void> {
        if (!KL_INDEXED_DB.getIsAvailable()) {
            return;
        }

        const otherTabIds = await this.getIdsFromTabs();
        const idsToExclude = DEBUG_RETURN_ALL_RECOVERIES
            ? []
            : [...otherTabIds, ...(this.tabId === undefined ? [] : [this.tabId])];
        const { metas, totalMemoryUsedBytes } = await getRecoveryOverview(idsToExclude);
        this.listeners.forEach((listener) => {
            listener(metas, totalMemoryUsedBytes);
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

    // ----------------------------------- public -----------------------------------
    constructor(p: TKlRecoveryManagerParams) {
        this.initListeners();
    }

    async getRecovery(signal?: AbortSignal): Promise<TDeserializedKlStorageProject | undefined> {
        try {
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

            const recoveryResult = await getRecoveryAndUpdateId(initialTabId, signal);
            if (recoveryResult.status === 'not-found') {
                this.noRecoveryReason = 'idNotFound';
                this.setHash(undefined);
                return undefined;
            }

            this.setHash(recoveryResult.newId);
            const result = await deserializeRecovery(recoveryResult.data, signal);

            // Everything ready at this point. So we can ignore abort signal.
            this.tabId = recoveryResult.newId;
            return result;
        } finally {
            if (!signal?.aborted) {
                // don't disrupt loading
                setTimeout(() => {
                    // Older versions of the app didn't have atomized transactions, leading to orphans sometimes.
                    // Also, you never know if the current code has bugs, which could also create orphans.
                    removeOrphans();
                }, 2000);
            }
        }
    }

    setKlHistory(klHistory: KlHistory) {
        this.klHistory = klHistory;
        let startTime = Date.now();
        let lastStoredChangeCount = 0;

        const checkAndMaybeStore = async () => {
            if (this.isStoring) {
                return;
            }
            const changeCount = this.klHistory.getChangeCount();
            if (!DEBUG_INSTANT_RECOVERY) {
                const deltaMs = Date.now() - startTime;
                if (
                    this.tabId === undefined &&
                    (deltaMs < FIRST_RECOVERY_AFTER_MS ||
                        changeCount < FIRST_RECOVERY_AFTER_CHANGES)
                ) {
                    // initial store threshold not reached
                    return;
                }
                if (
                    this.tabId !== undefined &&
                    (deltaMs < SUBSEQUENT_RECOVERY_AFTER_MS ||
                        changeCount - lastStoredChangeCount < SUBSEQUENT_RECOVERY_AFTER_CHANGES)
                ) {
                    // subsequent store threshold not reached
                    return;
                }
            }

            // must set isStoring here, or high frequency history events may cause multiple recovery entries
            this.setIsStoring(true);
            const isFreshDrawing = this.tabId === undefined;
            try {
                this.tabId = await storeRecovery(
                    this.tabId,
                    this.klHistory.getComposed(),
                    this.getThumbnail!,
                );
                startTime = Date.now();
            } catch (e) {
                setTimeout(() => {
                    throw e;
                });
                return;
            } finally {
                this.setIsStoring(false);
            }
            if (isFreshDrawing) {
                this.setHash(this.tabId);
                await clearOldRecoveries();
            }
            startTime = Date.now();
            lastStoredChangeCount = changeCount;
        };

        this.klHistory.addListener(checkAndMaybeStore);
        setInterval(checkAndMaybeStore, 1000 * 60);
    }

    setGetThumbnail(getThumbnail: (factor: number) => HTMLCanvasElement) {
        this.getThumbnail = getThumbnail;
    }

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

const showSyncIndicator = (() => {
    let syncIndicator: HTMLImageElement | undefined;
    return (isStoring: boolean): void => {
        if (!isStoring) {
            syncIndicator?.remove();
            syncIndicator = undefined;
            return;
        }

        syncIndicator = document.createElement('img');
        syncIndicator.src = loadingImg;
        syncIndicator.alt = '';
        css(syncIndicator, {
            position: 'fixed',
            top: '8px',
            left: '8px',
            zIndex: '2147483647',
            pointerEvents: 'none',
        });
        document.body.append(syncIndicator);
    };
})();
