export type TAgPsd = Awaited<typeof import('./ag-psd')>;
let agPsdLazy: TAgPsd;

export async function loadAgPsd(): Promise<TAgPsd> {
    agPsdLazy ??= await import('./ag-psd');
    return agPsdLazy;
}
