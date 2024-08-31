// https://github.com/eligrey/FileSaver.js/issues/774
// stripped down version of https://github.com/eligrey/FileSaver.js/blob/master/src/FileSaver.js#L81-L108

export function saveAs(blob: Blob, name: string): void {
    // Namespace is used to prevent conflict w/ Chrome Poper Blocker extension (Issue https://github.com/eligrey/FileSaver.js/issues/561)
    const a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a') as HTMLAnchorElement;
    a.download = name;
    a.rel = 'noopener';
    a.href = URL.createObjectURL(blob);

    setTimeout(() => URL.revokeObjectURL(a.href), 40 /* sec */ * 1000);
    setTimeout(() => a.click(), 0);
}
