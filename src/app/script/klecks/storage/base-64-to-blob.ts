
export function base64ToBlob(base64Str: string): Blob {
    let parts = base64Str.match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/);
    let binStr = atob(parts[3]);
    let buf = new ArrayBuffer(binStr.length);
    let view = new Uint8Array(buf);
    for (let i = 0; i < view.length; i++) {
        view[i] = binStr.charCodeAt(i);
    }
    return new Blob([view], {'type': parts[1]});
}