type FilePickerAcceptType = {
    description?: string;
    accept: Record<string, string[]>;
};

const types: Record<string, FilePickerAcceptType> = {
    png: {
        description: 'PNG Image',
        accept: { 'image/png': ['.png'] },
    },
    psd: {
        description: 'Adobe Photoshop Document',
        accept: { 'image/vnd.adobe.photoshop': ['.psd'] },
    },
} as const;

// https://github.com/eligrey/FileSaver.js/issues/774
// stripped down & modified version of https://github.com/eligrey/FileSaver.js/blob/master/src/FileSaver.js#L81-L108
// todo redesign when also support jpg, etc.
export async function saveAs(
    blob: Blob,
    name: string,
    showDialog: boolean = false,
    type?: 'png' | 'psd',
): Promise<void> {
    if (showDialog && 'showSaveFilePicker' in window) {
        let fileHandle: FileSystemFileHandle | undefined;
        try {
            fileHandle = await (window.showSaveFilePicker as any)({
                suggestedName: name,
                types: [type ? types[type] : types['png']],
            });
        } catch (e) {
            // cancelled dialog, probably.
            return;
        }
        if (!fileHandle) {
            return;
        }
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
        return;
    }

    // Namespace is used to prevent conflict w/ Chrome Poper Blocker extension (Issue https://github.com/eligrey/FileSaver.js/issues/561)
    const a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a') as HTMLAnchorElement;
    a.download = name;
    a.rel = 'noopener';
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;

    setTimeout(() => URL.revokeObjectURL(objectUrl), 40 /* sec */ * 1000);
    setTimeout(() => a.click(), 1);
}
