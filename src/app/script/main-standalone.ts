/**
 * by bitbof (bitbof.com)
 */

import './polyfills';
import {BB} from './bb/bb';
import {KL} from './klecks/kl';
import {klHistory} from './klecks/history/kl-history';
import {KlApp} from './app/kl-app';
import {IKlProject} from './klecks/kl.types';
import {ProjectStore} from './klecks/storage/project-store';

let klApp;


function onProjectLoaded(project: IKlProject, projectStore: ProjectStore) {
    if (klApp) {
        throw 'onKlProjectObjLoaded called more than once';
    }
    let loadingScreenEl = document.getElementById("loading-screen");
    try {
        // in case an extension screwed with the page
        loadingScreenEl.parentNode.removeChild(loadingScreenEl);
    } catch(e) {}

    const saveReminder = new KL.SaveReminder(klHistory, true, true);
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
            klApp.out('Restored from Browser Storage');
        }, 100);
    }

    document.body.appendChild(klApp.getEl());
}

async function onDomLoaded() {
    BB.removeEventListener(window, 'DOMContentLoaded', onDomLoaded);
    let projectStore = new KL.ProjectStore();
    let project: IKlProject = null;
    try {
        const readResult = await projectStore.read();
        if (readResult) {
            project = readResult.project;
        }
    } catch(e) {
        let message;
        if (e.message === 'db-error') {
            message = 'Failed to access Browser Storage';
        } else if (e.message === 'format-error') {
            message = 'Failed to restore from Browser Storage';
        }
        if (message) {
            setTimeout(function() {
                klApp.out(message);
                throw new Error('Initial browser storage error, ' + e);
            }, 100);
        }
    }
    onProjectLoaded(project, projectStore);
}
BB.addEventListener(window, 'DOMContentLoaded', onDomLoaded);

