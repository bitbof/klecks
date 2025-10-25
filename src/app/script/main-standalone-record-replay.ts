/**
 * by bitbof (bitbof.com)
 * and dela (colormari.art)
 */

import './polyfills/polyfills';
import { getDefaultProjectOptions } from './app/default-project';
import { KlApp } from './app/kl-app';
import { randomUuid } from './bb/base/base';
import { TKlProject } from './klecks/kl-types';
import {
    getKlIndexedDbName,
    KL_INDEXED_DB,
    KL_INDEXED_DB_STORES, KL_INDEXED_DB_UPGRADER,
    KL_INDEXED_DB_VERSION
} from './klecks/storage/kl-indexed-db';
import { initLANG, LANG } from './language/language';
import '../script/theme/theme';
import { TRecorderConfig } from './klecks/history/kl-event-types';
import { BrowserEventStorageProvider } from './klecks/history/kl-event-storage-provider';

function showInitError(e: Error): void {
    const el = document.createElement('div');
    el.style.textAlign = 'center';
    el.style.background = '#fff';
    el.style.padding = '20px';
    el.innerHTML = '<h1>App failed to initialize</h1>';
    const errorMsg = document.createElement('div');
    errorMsg.textContent = 'Error: ' + (e.message ? e.message : '' + e);
    el.append(errorMsg);
    document.body.append(el);
    console.error(e);
}


async function getEventsFromBrowserStorage(projectId: string) {
    const storageProvider = new BrowserEventStorageProvider(projectId);
    const hasEvents = await storageProvider.getEvents();
    if (hasEvents && hasEvents.length > 0) {
        return hasEvents;
    } else {
        return null;
    }
}

(async () => {
    try {
        const outQueue: string[] = [];
        await initLANG();

        KL_INDEXED_DB.init(
            getKlIndexedDbName(),
            KL_INDEXED_DB_STORES,
            KL_INDEXED_DB_VERSION,
            KL_INDEXED_DB_UPGRADER,
        );
        if (!(await KL_INDEXED_DB.testConnection())) {
            outQueue.push(LANG('file-storage-cant-access'));
        }

        let project: TKlProject | undefined = undefined;

        // Get project id from query
        const queryParams = new URLSearchParams(window.location.search);
        let projectId: string = randomUuid();
        if (queryParams.has('project')) {
            projectId = queryParams.get('project') as string;

            // Try event-recorder-specific browserstorage
            const hasEvents = await getEventsFromBrowserStorage(projectId);
            if (hasEvents) {
                project = getDefaultProjectOptions(projectId);
                outQueue.push('LOAD FROM BROWSER STORAGE');
            }
        } else {
            // Set the query
            window.history.replaceState({}, '', `?project=${projectId}`);
        }

        if (!project) {
            // New
            project = getDefaultProjectOptions(projectId, 500, 500);
            outQueue.push('NEU');
        }


        // in case an extension manipulated the page
        const loadingScreenEl = document.getElementById('loading-screen');
        loadingScreenEl?.remove();

        // Create storage provider for event recording
        const storageProvider = new BrowserEventStorageProvider(projectId);

        // Create history recorder configuration
        const eventRecorderConfig = {
            onEvent: (evnt) => {
                // TODO REC  send to server
                // Or, provide a StorageProvider

                // console.log('[main-standalone] event', evnt);
            },
        } as TRecorderConfig;

        /* TODO
         * Bei meinem 500 Linien langen Test gab es jetzt ein Bug mit den Chunks.
         * Die Animation wurde korrekt gemacht, aber die History-Chunks hatten noch
         * alte Daten (etwa von dem Stand index=100)
         *
         *
         * l-select wird scheinbar nicht angewandt.
         *
         * http://localhost:1234/?project=c4167054-f6f4-410d-a021-c3cc4a4a59b7
         */

        const klApp = new KlApp({ project, eventRecorderConfig, storageProvider });
        document.body.append(klApp.getElement());

        setTimeout(() => {
            outQueue.forEach((msg) => {
                klApp.out(msg);
            });
        }, 100);
    } catch (e) {
        showInitError(e as Error);
    }
})();
