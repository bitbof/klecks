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
import { LOG_STYLE_RECORDER, TRecordedEvent, TRecorderConfig } from './klecks/history/kl-event-types';

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


function loadFromBrowserStorage(projectId: string) {
    const readEvents = localStorage.getItem(`kl-rec-${projectId}`);
    if (readEvents) {
        return JSON.parse(readEvents) as TRecordedEvent[];
    } else {
        return null;
    }
}

function appendToBrowserStorage(projectId: string, newEvents: TRecordedEvent[] | null) {
    if (newEvents === null) {
        localStorage.removeItem(`kl-rec-${projectId}`);
        return;
    }

    try {
        let allEvents: TRecordedEvent[] = [];
        const lsEvents = localStorage.getItem(`kl-rec-${projectId}`);
        if (lsEvents) {
            allEvents = JSON.parse(lsEvents) as TRecordedEvent[];
        }
        allEvents.push(...newEvents);
        localStorage.setItem(`kl-rec-${projectId}`, JSON.stringify(allEvents));
        console.log('Event Storage: ', allEvents.length, ' - ', (new Blob([JSON.stringify(allEvents)]).size / 1024).toFixed(3), 'KB');
    } catch (error) {
        console.error('%c[REC]', LOG_STYLE_RECORDER, 'Failed to save events to browser storage. Error:', error);
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
        let eventsToReplay: TRecordedEvent[] | null = null;
        let isLoaded = false;

        // Get project id from query
        const queryParams = new URLSearchParams(window.location.search);
        let projectId: string = randomUuid();
        if (queryParams.has('project')) {
            projectId = queryParams.get('project') as string;

            // Try event-recorder-specific browserstorage
            eventsToReplay = loadFromBrowserStorage(projectId);
            if (eventsToReplay) {
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
            isLoaded = true; // no need to wait for the events to restore
        }


        // in case an extension manipulated the page
        const loadingScreenEl = document.getElementById('loading-screen');
        loadingScreenEl?.remove();

        // Create history recorder configuration
        const eventRecorderConfig = {
            onEvent: (evnt) => {
                if (!isLoaded)
                    return; // Not yet finished loading

                // TODO REC send to server

                // console.log('[main-standalone] event', evnt);


                appendToBrowserStorage(projectId, [evnt]);
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

        const klApp = new KlApp({ project, eventRecorderConfig });
        document.body.append(klApp.getElement());

        setTimeout(() => {
            outQueue.forEach((msg) => {
                klApp.out(msg);
            });

            // Load all events instantly
            if (!!eventsToReplay) {
                klApp.loadProjectFromEvents(eventsToReplay)
                     .then(() => {
                         isLoaded = true;
                     });
            }

        }, 100);
    } catch (e) {
        showInitError(e as Error);
    }
})();
