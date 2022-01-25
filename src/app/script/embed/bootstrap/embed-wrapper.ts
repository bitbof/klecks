import {IEmbedParams} from '../../main-embed';
import {IKlProject} from '../../klecks/kl.types';
// @ts-ignore
import logoImg from 'url:~/src/app/img/klecks-logo.png';

let embedInstance: boolean = false;

// lazy load rest of library, show a loading screen, expose Embed interface
export function EmbedWrapper(p: IEmbedParams) {
    const _this = this;
    if (embedInstance) {
        throw new Error('Already created an embed');
    }
    embedInstance = true;


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
        '<span id="loading-screen-text">Loading app</span>' +
        '</div>';
    document.body.appendChild(loadingScreen)



    let project: IKlProject;
    let errorStr: string;

    (async () => {
        const mainEmbed = await import('../../main-embed');
        const instance = new mainEmbed.Embed(p);

        _this.openProject = instance.openProject;
        _this.getPNG = instance.getPNG;
        _this.getPSD = instance.getPSD;
        _this.initError = instance.initError;

        if (project) {
            instance.openProject(project);
        }
        if (errorStr) {
            instance.initError(errorStr);
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
}