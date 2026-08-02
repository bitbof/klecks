/**
 * by bitbof (bitbof.com)
 */

import './polyfills/polyfills';
import { KlApp } from './app/kl-app';
import { TKlProject } from './klecks/kl-types';
import { initLANG, LANG } from './language/language';
import '../script/theme/theme';
import { getKlIndexedDbName, KL_INDEXED_DB } from './klecks/storage/kl-indexed-db';
import { KlRecoveryManager } from './klecks/storage/kl-recovery-manager';
import { loadRecovery } from './app/recovery-loader';

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

        KL_INDEXED_DB.init(getKlIndexedDbName());
        if (!(await KL_INDEXED_DB.testConnection())) {
            outQueue.push(LANG('file-storage-cant-access'));
        }

        const klRecoveryManager: KlRecoveryManager | undefined = KL_INDEXED_DB.getIsAvailable()
            ? new KlRecoveryManager({})
            : undefined;
        const loadingScreenEl = document.getElementById('loading-screen');
        let project: TKlProject | undefined = undefined;
        try {
            const readResult = await loadRecovery(klRecoveryManager, loadingScreenEl);
            if (readResult) {
                project = readResult.project;
                outQueue.push(LANG('tab-recovery-recovered'));
            }
        } catch (e) {
            setTimeout(() => {
                throw e;
            });
            outQueue.push(LANG('tab-recovery-failed-to-recover'));
        }

        // in case an extension manipulated the page
        loadingScreenEl?.remove();

        const klApp = new KlApp({ project, klRecoveryManager });
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
