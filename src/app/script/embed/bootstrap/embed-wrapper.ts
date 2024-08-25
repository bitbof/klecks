import { Embed, IEmbedParams, IReadPSD } from '../../main-embed';
import { IKlProject } from '../../klecks/kl-types';
import logoImg from '/src/app/img/klecks-logo.png';
import { getEmbedUrl } from './get-embed-url';
import { initLANG, LANG } from '../../language/language';
import { theme } from '../../theme/theme';
import { loadAgPsd } from '../../klecks/storage/load-ag-psd';

// only one instance can exist
let wrapperCreated = false;

// add missing props. modifies project object
function processProject(project: IKlProject | undefined): void {
    if (!project) {
        return;
    }
    project.layers.forEach((layer) => {
        layer.isVisible = layer.isVisible === undefined ? true : layer.isVisible;
    });
}

/**
 * Starting point for the Embed. Quickly available due to lazy loading.
 * (Which is why it had to be separated from main-embed.ts > Embed)
 *
 * Lazy loads rest of library, shows a loading screen, exposes Embed interface
 */
export class EmbedWrapper {
    private project: IKlProject | undefined;
    private errorStr: string | undefined;
    private psds: IReadPSD[] = []; // if instance not loaded yet, these are psds to be read

    private instance: Embed | undefined; // instance of loaded Embed

    // ----------------------------------- public -----------------------------------
    constructor(p: IEmbedParams) {
        if (wrapperCreated) {
            throw new Error('Already created an embed');
        }
        wrapperCreated = true;

        processProject(p.project);
        p = {
            ...p,
            embedUrl: p.embedUrl ? p.embedUrl : getEmbedUrl(),
        };

        (async () => {
            await initLANG();

            // loading screen
            const loadingScreen = document.createElement('div');
            const loadingStyleArr = [
                ['position', 'fixed'],
                ['left', '0'],
                ['top', '0'],
                ['width', '100vw'],
                ['height', '100vh'],

                ['display', 'flex'],
                ['alignItems', 'center'],
                ['justifyContent', 'center'],
                ['flexDirection', 'column'],

                ['background', theme.isDark() ? 'rgb(33, 33, 33)' : 'rgb(158,158,158)'],

                ['fontFamily', 'system-ui, sans-serif'],
                ['fontSize', '30px'],
                ['color', '#e3e3e3'],
            ];
            for (let i = 0; i < loadingStyleArr.length; i++) {
                loadingScreen.style[loadingStyleArr[i][0] as any] = loadingStyleArr[i][1];
            }
            loadingScreen.id = 'loading-screen';
            const logoStyle = theme.isDark() && !p.logoImg ? ' style="filter: invert(1)"' : '';
            loadingScreen.innerHTML =
                '<img width="150" height="54"' +
                logoStyle +
                ' src="' +
                (p.logoImg ? p.logoImg : logoImg) +
                '" alt="Logo"/>\n' +
                '<div style="margin: 15px 0 0 0; display: flex; align-items: center">\n' +
                '<div class="spinner"></div>\n' +
                '<span id="loading-screen-text">' +
                LANG('embed-init-loading') +
                '</span>' +
                '</div>';
            document.body.appendChild(loadingScreen);

            const mainEmbed = await import('../../main-embed');
            this.instance = new mainEmbed.Embed(p);

            this.getPNG = () => this.instance!.getPNG();
            this.getPSD = () => this.instance!.getPSD();

            if (this.project) {
                this.instance.openProject(this.project);
            }
            if (this.errorStr) {
                this.instance.initError(this.errorStr);
            }
            if (this.psds.length) {
                this.instance.readPSDs(this.psds);
            }
        })();

        // needed for uploading. load here to prevent possible timeouts due to server cold-start
        loadAgPsd();
    }

    openProject(project: IKlProject) {
        processProject(project);
        if (this.instance) {
            this.instance.openProject(project);
        } else {
            if (this.project) {
                throw new Error('Already called openProject');
            }
            this.project = project;
        }
    }

    initError(error: string) {
        if (this.instance) {
            this.instance.initError(error);
        } else {
            this.errorStr = error;
        }
    }

    async readPSD(blob: Blob) {
        return new Promise((resolve, reject) => {
            const item: IReadPSD = {
                blob,
                callback: (loadedProject: IKlProject | null) => {
                    this.psds.splice(this.psds.indexOf(item), 1);
                    if (loadedProject) {
                        resolve(loadedProject);
                    } else {
                        reject();
                    }
                },
            };
            if (this.instance) {
                this.instance.readPSDs([item]);
            } else {
                this.psds.push(item);
            }
        });
    }

    getPNG: (() => Blob) | undefined = undefined;
    getPSD: (() => Promise<Blob>) | undefined = undefined;
}
