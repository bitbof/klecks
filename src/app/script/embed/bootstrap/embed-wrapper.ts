import {IEmbedParams, IReadPSD} from '../../main-embed';
import {IKlProject} from '../../klecks/kl.types';
// @ts-ignore
import logoImg from 'url:~/src/app/img/klecks-logo.png';
import {getEmbedUrl} from './get-embed-url';
import {initLANG, LANG} from '../../language/language';

let wrapperInstance: boolean = false;

// lazy load rest of library, show a loading screen, expose Embed interface
export function EmbedWrapper(p: IEmbedParams) {
    if (wrapperInstance) {
        throw new Error('Already created an embed');
    }
    wrapperInstance = true;

    p = {
        ...p,
        embedUrl: p.embedUrl ? p.embedUrl : getEmbedUrl(),
    };

    let project: IKlProject;
    let errorStr: string;
    let psds: IReadPSD[] = []; // if instance not loaded yet, these are psds to be read
    let instance; // instance of loaded Embed

    (async () => {
        await initLANG();

        // loading screen
        let loadingScreen = document.createElement('div');
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

            ['background', 'rgb(158,158,158)'],

            ['fontFamily', 'Arial, sans-serif'],
            ['fontSize', '30px'],
            ['color', '#e3e3e3'],
        ];
        for (let i = 0; i < loadingStyleArr.length; i++) {
            loadingScreen.style[loadingStyleArr[i][0]] = loadingStyleArr[i][1];
        }
        loadingScreen.id = "loading-screen";
        loadingScreen.innerHTML = '<img width="150" height="54" src="' + (p.logoImg ? p.logoImg : logoImg) + '" alt="Logo"/>\n' +
            '<div style="margin: 15px 0 0 0; display: flex; align-items: center">\n' +
            '<div class="spinner"></div>\n' +
            '<span id="loading-screen-text">' + LANG('embed-init-loading') + '</span>' +
            '</div>';
        document.body.appendChild(loadingScreen);

        const mainEmbed = await import('../../main-embed');
        instance = new mainEmbed.Embed(p);

        this.openProject = instance.openProject;
        this.getPNG = instance.getPNG;
        this.getPSD = instance.getPSD;
        this.initError = instance.initError;

        if (project) {
            instance.openProject(project);
        }
        if (errorStr) {
            instance.initError(errorStr);
        }
        if (psds.length) {
            instance.readPSDs(psds);
        }
    })();

    this.openProject = (k: IKlProject) => {
        if (project) {
            throw new Error('Already called openProject');
        }
        project = k;
    };
    this.initError = (error: string) => {
        errorStr = error;
    };
    this.readPSD = async (blob: Blob) => {
        const promise = new Promise((resolve, reject) => {
            const item: IReadPSD = {
                blob,
                callback: (k: IKlProject) => {
                    psds.splice(psds.indexOf(item), 1);
                    if (k) {
                        resolve(k);
                    } else {
                        reject();
                    }
                },
            };
            if (instance) {
                instance.readPSDs([item]);
            } else {
                psds.push(item);
            }
        });
        return promise;
    };
}