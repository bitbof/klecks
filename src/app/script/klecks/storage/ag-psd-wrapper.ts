
let agPsdLazy;
export async function loadAgPsd () {
    if (!agPsdLazy) {
        agPsdLazy = await import('ag-psd');
    }
    return agPsdLazy;
}