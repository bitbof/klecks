import {getEmbedUrl} from './get-embed-url';

export function initEmbedStyle () {
    // disable other styles
    const linkArr = document.getElementsByTagName('link');
    for (let i = 0; i < linkArr.length; i++) {
        if (linkArr[i].rel === 'stylesheet') {
            linkArr[i].disabled = true;
        }
    }

    // init style
    const styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = getEmbedUrl() + 'embed.css';
    document.head.appendChild(styles);
}