import './bb/base/polyfills';
import { KlApp } from './app/kl-app';
import { TKlEmbedProject, TKlProject } from './klecks/kl-types';
import { klPsdToKlProject, psdToKlPsd } from './klecks/storage/psd';
import { LANG } from './language/language';
import { loadAgPsd, TAgPsd } from './klecks/storage/load-ag-psd';
import { KL_CONFIG } from './klecks/kl-config';
import { asyncThrow, randomUuid } from './bb/base/base';
import { initIconCss } from './icon/icon';
import { getMixModeStr } from './klecks/canvas/get-mix-mode';

initIconCss();

export type TEmbedParams = {
    project?: TKlEmbedProject;
    onSubmit: (onSuccess: () => void, onError: () => void) => void;
    embedUrl?: string;
    logoImg?: string;
    bottomBar?: HTMLElement;
    aboutEl?: HTMLElement;
    disableAutoFit?: boolean; // disable automatic Fit to View for small canvases
    enableImageDropperImport?: boolean; // default false
};

export type TReadPSD = {
    blob: Blob | ArrayBuffer;
    callback: (k: TKlProject | null) => void;
};

export function processEmbedProject(embedProject: TKlEmbedProject): TKlProject {
    return {
        ...embedProject,
        projectId: embedProject.projectId ?? randomUuid(),
        layers: embedProject.layers.map((layer) => ({
            ...layer,
            isVisible: layer.isVisible ?? true,
            hasClipping: layer.hasClipping ?? false,
            mixModeStr: getMixModeStr(layer.mixModeStr),
        })),
    };
}

/**
 * Note: Wrapped by EmbedWrapper, which quickly provides feedback for the user without having loaded everything.
 * Embed runs when the main bundle is loaded. It instantiates Klecks.
 */
export class Embed {
    private isInitialized: boolean = false;
    private klApp: KlApp | undefined;
    private readonly psdQueue: TReadPSD[] = []; // queue of psds waiting while ag-psd is loading
    private agPsd: TAgPsd | 'error' | undefined;
    private loadingScreenEl: HTMLElement | null;
    private loadingScreenTextEl: HTMLElement | null;

    onProjectReady(embedProject: TKlEmbedProject) {
        if (this.isInitialized) {
            asyncThrow(new Error('Already called openProject'));
            return;
        }

        try {
            this.isInitialized = true;
            const project = processEmbedProject(embedProject);
            this.klApp = new KlApp({
                project,
                bottomBar: this.p.bottomBar,
                aboutEl: this.p.aboutEl,
                embed: {
                    url: this.p.embedUrl,
                    enableImageDropperImport: !!this.p.enableImageDropperImport,
                    onSubmit: this.p.onSubmit,
                },
            });

            void this.loadingScreenEl?.remove();
            this.loadingScreenEl = null;
            this.loadingScreenTextEl = null;

            document.body.append(this.klApp.getElement());
        } catch (e) {
            this.initError('' + e);
            console.error(e);
        }
    }

    // ----------------------------------- public -----------------------------------
    constructor(private p: TEmbedParams & { embedUrl: string }) {
        this.loadingScreenEl = document.getElementById('loading-screen');
        this.loadingScreenTextEl = document.getElementById('loading-screen-text');
        if (this.loadingScreenTextEl) {
            this.loadingScreenTextEl.textContent = LANG('embed-init-waiting');
        }

        if (p.disableAutoFit) {
            KL_CONFIG.disableAutoFit = true;
        }
        if (p.project) {
            this.onProjectReady(p.project);
        }
    }

    openProject = (embedProject: TKlEmbedProject) => {
        this.onProjectReady(embedProject);
    };

    initError(error: string) {
        if (this.loadingScreenTextEl) {
            this.loadingScreenTextEl.textContent = '❌ ' + error;
        }
        if (this.loadingScreenEl) {
            this.loadingScreenEl.className += 'loading-screen-error';
        }
    }

    async getPNG(): Promise<Blob> {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return await this.klApp.getPNG();
    }

    async getPSD(): Promise<Blob> {
        if (!this.klApp) {
            throw new Error('App not initialized');
        }
        return await this.klApp.getPSD();
    }

    readPSDs(psds: TReadPSD[]) {
        if (psds.length === 0) {
            return;
        }

        const readItem = (item: TReadPSD) => {
            try {
                const psd = (this.agPsd as any).readPsd(item.blob as any);
                const project = klPsdToKlProject(psdToKlPsd(psd));
                item.callback(project);
            } catch (e) {
                console.error('failed to read psd', e);
                item.callback(null);
            }
        };

        // library is not loaded yet
        if (!this.agPsd) {
            if (this.psdQueue.length === 0) {
                (async () => {
                    try {
                        this.agPsd = await loadAgPsd();
                    } catch (e) {
                        this.agPsd = 'error';
                    }
                    while (this.psdQueue.length > 0) {
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
