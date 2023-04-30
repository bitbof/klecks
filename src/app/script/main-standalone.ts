/**
 * by bitbof (bitbof.com)
 */

import './polyfills/polyfills';
import {KL} from './klecks/kl';
import {klHistory} from './klecks/history/kl-history';
import {KlApp} from './app/kl-app';
import {IKlProject} from './klecks/kl-types';
import {ProjectStore} from './klecks/storage/project-store';
import {initLANG, LANG} from './language/language';
import '../script/theme/theme';

function initError (e): void {
    const el = document.createElement('div');
    el.style.textAlign = 'center';
    el.style.background = '#fff';
    el.style.padding = '20px';
    el.innerHTML = '<h1>App failed to initialize</h1>';
    const errorMsg = document.createElement('div');
    errorMsg.textContent = 'Error: ' + (e.message ? e.message : ('' + e));
    el.append(errorMsg);
    document.body.append(el);
    console.error(e);
}

(async () => {
    let klApp;
    let domIsLoaded = false;

    try {
        window.addEventListener('DOMContentLoaded', () => {
            domIsLoaded = true;
        });
        await initLANG();
    } catch (e) {
        initError(e);
        return;
    }

    function onProjectLoaded (project: IKlProject, projectStore: ProjectStore) {
        if (klApp) {
            throw 'onKlProjectObjLoaded called more than once';
        }
        const loadingScreenEl = document.getElementById('loading-screen');
        try {
            // in case an extension screwed with the page
            loadingScreenEl.parentNode.removeChild(loadingScreenEl);
        } catch(e) {}

        const saveReminder = new KL.SaveReminder(
            klHistory,
            true,
            true,
            () => klApp.saveAsPsd(),
            () => {
                return klApp ? klApp.isDrawing() : false;
            },
            null,
            null,
        );
        klApp = new KlApp(
            project,
            {
                saveReminder,
                projectStore,
            }
        );
        saveReminder.init();
        if (project) {
            setTimeout(() => {
                klApp.out(LANG('file-storage-restored'));
            }, 100);
        }

        document.body.append(klApp.getEl());
    }

    async function onDomLoaded () {
        try {
            window.removeEventListener('DOMContentLoaded', onDomLoaded);
            const projectStore = new KL.ProjectStore();
            let project: IKlProject = null;
            try {
                const readResult = await projectStore.read();
                if (readResult) {
                    project = readResult.project;
                }
            } catch(e) {
                let message;
                if (e.message.indexOf('db-error') === 0) {
                    message = 'Failed to access Browser Storage';
                } else if (e.message.indexOf('format-error') === 0) {
                    message = 'Failed to restore from Browser Storage';
                } else {
                    message = 'Failed to restore from Browser Storage';
                }
                if (message) {
                    setTimeout(function () {
                        klApp && klApp.out(message);
                        throw new Error('Initial browser storage error, ' + e);
                    }, 100);
                }
            }
            onProjectLoaded(project, projectStore);
        } catch (e) {
            initError(e);
        }

    }
    if (domIsLoaded) {
        onDomLoaded();
    } else {
        window.addEventListener('DOMContentLoaded', onDomLoaded);
    }
})();

