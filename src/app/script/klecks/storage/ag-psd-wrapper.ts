import {BB} from '../../bb/bb';

let agPsdLazy;
export async function loadAgPsd() {
    if (!agPsdLazy) {
        agPsdLazy = await import('ag-psd');
        BB.BbLog.emit({
            type: 'loaded-agpsd',
        });
    }
    return agPsdLazy;
}