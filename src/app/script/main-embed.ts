import './polyfills';
import {KlApp} from './app/kl-app';
import {IKlProject} from './klecks/kl.types';
import {SaveReminder} from './klecks/ui/components/save-reminder';
import {klHistory} from './klecks/history/kl-history';

export interface IEmbedParams {
    project?: IKlProject,
    psdBlob?: Blob,
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
    embedUrl: string;
    logoImg?: any;
    bottomBar?: HTMLElement;
}

export function Embed(p: IEmbedParams) {

    let isInitialized: boolean = false;
    let klApp;

    let loadingScreenEl = document.getElementById("loading-screen");
    let loadingScreenTextEl = document.getElementById("loading-screen-text");
    if (loadingScreenTextEl) {
        loadingScreenTextEl.textContent = 'Waiting for image';
    }

    function onProjectReady(project: IKlProject) {
        if (isInitialized) {
            throw new Error('Already called openProject');
        }
        isInitialized = true;

        if (loadingScreenEl && loadingScreenEl.parentNode) {
            loadingScreenEl.parentNode.removeChild(loadingScreenEl);
        }
        loadingScreenEl = null;
        loadingScreenTextEl = null;

        const saveReminder = new SaveReminder(klHistory, false, false);
        klApp = new KlApp(
            project,
            {
                saveReminder,
                bottomBar: p.bottomBar,
                embed: {
                    url: p.embedUrl,
                    onSubmit: p.onSubmit,
                }
            }
        );
        saveReminder.init();

        document.body.appendChild(klApp.getEl());
    }

    if (p.project) {
        onProjectReady(p.project);
    }
    this.openProject = onProjectReady;
    this.initError = (error: string) => {
        if (loadingScreenTextEl) {
            loadingScreenTextEl.textContent = '❌ ' + error;
        }
        if (loadingScreenEl) {
            loadingScreenEl.className += 'loading-screen-error';
        }
    };
    this.getPNG = (): Blob => {
        if (!klApp) {
            throw new Error('App not initialized');
        }
        return klApp.getPNG();
    };
    this.getPSD = async (): Promise<Blob> => {
        if (!klApp) {
            throw new Error('App not initialized');
        }
        return await klApp.getPSD();
    };
}