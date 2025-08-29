type TFilePickerAcceptType = {
    description?: string;
    accept: Record<string, string[]>;
};

type TMimeType = string;
const types: Record<TMimeType, TFilePickerAcceptType> = {
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

// resolves to true if it saves via file picker (or user aborted)
async function saveViaFilePicker(blob: Blob, fileName: string): Promise<boolean> {
    const mimeType = blob.type;
    if ('showSaveFilePicker' in window) {
        let fileHandle: FileSystemFileHandle | undefined;
        if (!types[mimeType]) {
            console.error('unknown mime type:', mimeType);
            return false;
        }
        try {
            fileHandle = await (window.showSaveFilePicker as any)({
                suggestedName: fileName,
                types: [types[mimeType]],
            });
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                // cancelled dialog
                return true;
            }
            console.log('unpredicted error', e);
            return false;
        }
        if (!fileHandle) {
            return false;
        }
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
        return true;
    } else {
        return false;
    }
}

export async function saveAs(
    blob: Blob,
    fileName: string,
    showDialog: boolean = false,
): Promise<void> {
    if (showDialog && (await saveViaFilePicker(blob, fileName))) {
        return;
    }

    // Namespace is used to prevent conflict w/ Chrome Poper Blocker extension (Issue https://github.com/eligrey/FileSaver.js/issues/561)
    const a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a') as HTMLAnchorElement;
    a.download = fileName;
    a.rel = 'noopener';
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;

    setTimeout(() => URL.revokeObjectURL(objectUrl), 40 /* sec */ * 1000);
    setTimeout(() => {
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, 1);
}
