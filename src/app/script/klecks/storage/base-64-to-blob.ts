export function base64ToBlob(base64Str: string): Blob {
    const parts = base64Str.match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/) as [
        string,
        string,
        string,
        string,
    ];
    const binStr = atob(parts[3]);
    const buf = new ArrayBuffer(binStr.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < view.length; i++) {
        view[i] = binStr.charCodeAt(i);
    }
    return new Blob([view], { type: parts[1] });
}
