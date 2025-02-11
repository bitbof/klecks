type FilePickerAcceptType = {
    description?: string;
    accept: Record<string, string[]>;
};

type TMimeType = string;
const types: Record<TMimeType, FilePickerAcceptType> = {
    'image/png': {
        description: 'PNG Image',
        accept: { 'image/png': ['.png'] },
    },
    'image/vnd.adobe.photoshop': {
        description: 'Adobe Photoshop Document',
        accept: { 'image/vnd.adobe.photoshop': ['.psd'] },
    },
    // jpg etc
} as const;

export async function saveAs(
    blob: Blob,
    fileName: string,
    showDialog: boolean = false,
): Promise<void> {
    const mimeType = blob.type;
    if (showDialog && 'showSaveFilePicker' in window) {
        let fileHandle: FileSystemFileHandle | undefined;
        if (!types[mimeType]) {
            console.error('unknown mime type:', mimeType);
        }
        try {
            fileHandle = await (window.showSaveFilePicker as any)({
                suggestedName: fileName,
                types: types[mimeType],
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
    a.download = fileName;
    a.rel = 'noopener';
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;

    setTimeout(() => URL.revokeObjectURL(objectUrl), 40 /* sec */ * 1000);
    setTimeout(() => a.click(), 1);
}
