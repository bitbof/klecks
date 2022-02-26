import './polyfills';
import {KlApp} from './app/kl-app';
import {IKlProject} from './klecks/kl.types';
import {SaveReminder} from './klecks/ui/components/save-reminder';
import {klHistory} from './klecks/history/kl-history';
import {readPsd} from './klecks/storage/psd';

export interface IEmbedParams {
    project?: IKlProject,
    psdBlob?: Blob,
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
    embedUrl: string;
    logoImg?: any;
    bottomBar?: HTMLElement;
}

export interface IReadPSD {
    blob: Blob;
    callback: (k: IKlProject) => void;
}

export function Embed(p: IEmbedParams) {

    let isInitialized: boolean = false;
    let klApp;
    const psdQueue: IReadPSD[] = []; // queue of psds waiting while ag-psd is loading
    let agPsd: any | 'error';

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
    this.readPSDs = (psds: IReadPSD[]) => {
        if (psds.length === 0) {
            return;
        }

        const readItem = (item: IReadPSD) => {
            try {
                const psd = agPsd.readPsd(item.blob);
                const project = readPsd(psd);
                if (project) {
                    // convert to KlekiProjectObj
                    for (let i = 0; i < project.layerArr.length; i++) {
                        project.layerArr[i].image = project.layerArr[i].canvas;
                        delete project.layerArr[i].canvas;
                    }
                    project.layers = project.layerArr;
                    delete project.layerArr;
                }
                item.callback(project);
            } catch (e) {
                console.error('failed to read psd', e);
                item.callback(null);
            }
        };

        if (!agPsd) {
            if (psdQueue.length === 0) {
                // load ag-psd
                (async () => {
                    try {
                        agPsd = await import('ag-psd');
                    } catch (e) {
                        agPsd = 'error';
                    }
                    while (psdQueue.length) {
                        readItem(psdQueue.shift());
                    }
                })();
            }
            psds.forEach(item => {
                psdQueue.push(item);
            });
        } else {
            psds.forEach(readItem);
        }
    };
}