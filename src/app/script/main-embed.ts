import './polyfills/polyfills';
import { KlApp } from './app/kl-app';
import { IKlProject } from './klecks/kl-types';
import { SaveReminder } from './klecks/ui/components/save-reminder';
import { klPsdToKlProject, readPsd } from './klecks/storage/psd';
import { LANG } from './language/language';
import { loadAgPsd, TAgPsd } from './klecks/storage/load-ag-psd';
import { klConfig } from './klecks/kl-config';

export interface IEmbedParams {
    project?: IKlProject;
    psdBlob?: Blob;
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
    embedUrl: string;
    logoImg?: any;
    bottomBar?: HTMLElement;
    aboutEl?: HTMLElement;
    disableAutoFit?: boolean; // disable automatic Fit to View for small canvases
}

export interface IReadPSD {
    blob: Blob;
    callback: (k: IKlProject | null) => void;
}

/**
 * Note: Wrapped by EmbedWrapper, which quickly provides feedback for the user without having loaded everything.
 * Embed runs when the main bundle is loaded. It instantiates Klecks.
 */
export class Embed {
    private isInitialized: boolean = false;
    private klApp: KlApp | undefined;
    private readonly psdQueue: IReadPSD[] = []; // queue of psds waiting while ag-psd is loading
    private agPsd: TAgPsd | 'error' | undefined;
    private loadingScreenEl: HTMLElement | null;
    private loadingScreenTextEl: HTMLElement | null;

    onProjectReady(project: IKlProject) {
        try {
            if (this.isInitialized) {
                throw new Error('Already called openProject');
            }
            this.isInitialized = true;

            const saveReminder = new SaveReminder(
                false,
                false,
                () => {},
                () => (this.klApp ? this.klApp.isDrawing() : false),
                null,
                null,
            );
            this.klApp = new KlApp({
                project,
                saveReminder,
                bottomBar: this.p.bottomBar,
                aboutEl: this.p.aboutEl,
                embed: {
                    url: this.p.embedUrl,
                    onSubmit: this.p.onSubmit,
                },
            });
            saveReminder.init();

            this.loadingScreenEl && this.loadingScreenEl.remove();
            this.loadingScreenEl = null;
            this.loadingScreenTextEl = null;

            document.body.append(this.klApp.getEl());
        } catch (e) {
            if (this.loadingScreenTextEl) {
                this.loadingScreenTextEl.textContent = '❌ ' + e;
            }
            if (this.loadingScreenEl) {
                this.loadingScreenEl.className += 'loading-screen-error';
            }
            console.error(e);
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(private p: IEmbedParams) {
        this.loadingScreenEl = document.getElementById('loading-screen');
        this.loadingScreenTextEl = document.getElementById('loading-screen-text');
        if (this.loadingScreenTextEl) {
            this.loadingScreenTextEl.textContent = LANG('embed-init-waiting');
        }

        if (p.disableAutoFit) {
            klConfig.disableAutoFit = true;
        }
        if (p.project) {
            this.onProjectReady(p.project);
        }
    }

    openProject: Embed['onProjectReady'] = (project) => {
        this.onProjectReady(project);
    };

    initError(error: string) {
        if (this.loadingScreenTextEl) {
            this.loadingScreenTextEl.textContent = '❌ ' + error;
        }
        if (this.loadingScreenEl) {
            this.loadingScreenEl.className += 'loading-screen-error';
        }
    }

    getPNG(): Blob {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return this.klApp.getPNG();
    }

    async getPSD(): Promise<Blob> {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return await this.klApp.getPSD();
    }

    readPSDs(psds: IReadPSD[]) {
        if (psds.length === 0) {
            return;
        }

        const readItem = (item: IReadPSD) => {
            try {
                const psd = (this.agPsd as any).readPsd(item.blob as any);
                const project = klPsdToKlProject(readPsd(psd));
                item.callback(project);
            } catch (e) {
                console.error('failed to read psd', e);
                item.callback(null);
            }
        };

        // library not loaded yet
        if (!this.agPsd) {
            if (this.psdQueue.length === 0) {
                // load ag-psd
                (async () => {
                    try {
                        this.agPsd = await loadAgPsd();
                    } catch (e) {
                        this.agPsd = 'error';
                    }
                    while (this.psdQueue.length) {
                        readItem(this.psdQueue.shift()!);
                    }
                })();
            }
            psds.forEach((item) => {
                this.psdQueue.push(item);
            });
        } else {
            psds.forEach(readItem);
        }
    }
}
