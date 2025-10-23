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
import { TRecordedEvent, TRecorderConfig } from './klecks/history/kl-event-types';

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
        let eventsToReplay: TRecordedEvent[] | undefined = undefined;

        // Get project id from query
        const queryParams = new URLSearchParams(window.location.search);
        let projectId: string = randomUuid();
        if (queryParams.has('project')) {
            projectId = queryParams.get('project') as string;

            // Try event-recorder-specific browserstorage
            const readEvents = localStorage.getItem(`kl-rec-${projectId}`);
            if (readEvents) {
                try {
                    eventsToReplay = JSON.parse(readEvents) as TRecordedEvent[];
                    project = getDefaultProjectOptions(projectId);
                    outQueue.push('LOAD FROM BROWSER STORAGE');
                } catch (e) {
                    console.error('Failed to parse recorded events from browser storage', e);
                }
            }
        }

        if (!project) {
            // New
            project = getDefaultProjectOptions(projectId, 500, 500);
        }


        // in case an extension manipulated the page
        const loadingScreenEl = document.getElementById('loading-screen');
        loadingScreenEl?.remove();

        // Create history recorder configuration
        const eventRecorderConfig = {
            enableMemoryStorage: true,
            enableBrowserStorage: true,
            onEvent: (evnt) => {
                // TODO REC send to server
                // console.log('[main-standalone] event', evnt);
            },
        } as TRecorderConfig;

        // TODO von anfang an muss "replaying" gesetzt sein, sonst werden neue reset-events erstellt

        const klApp = new KlApp({
            project,
            eventRecorderConfig
        });
        document.body.append(klApp.getElement());

        setTimeout(() => {
            outQueue.forEach((msg) => {
                klApp.out(msg);
            });

            // Play animation
            if (!!eventsToReplay) {
                klApp.loadProjectFromEvents(eventsToReplay!); // replay instantly
            }

        }, 100);
    } catch (e) {
        showInitError(e as Error);
    }
})();
