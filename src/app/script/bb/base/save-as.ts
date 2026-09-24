import { asyncThrow, attempt, AttemptError } from './base';

const pickerTypes = {
    'image/png': {
        description: 'PNG Image',
        accept: { 'image/png': ['.png'] },
    },
    'image/jpeg': {
        description: 'JPEG Image',
        accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
    },
    'image/vnd.adobe.photoshop': {
        description: 'Adobe Photoshop Document',
        accept: { 'image/vnd.adobe.photoshop': ['.psd'] },
    },
};

export type TFileSaveResult = 'saved' | 'cancel' | 'error';

export async function saveAs(
    fileName: string,
    mimeType: keyof typeof pickerTypes,
    createBlob: () => Promise<Blob>,
    showsFilePicker: boolean = false,
): Promise<TFileSaveResult> {
    let fileHandle: FileSystemFileHandle | undefined;
    // Open the picker before creating the blob while the user gesture is still active.
    if (showsFilePicker && 'showSaveFilePicker' in window) {
        try {
            fileHandle = await (window as any).showSaveFilePicker({
                suggestedName: fileName,
                types: [pickerTypes[mimeType]],
            });
            if (!fileHandle) {
                asyncThrow(new Error('showSaveFilePicker returned no file handle'));
            }
        } catch (error) {
            const name =
                typeof error === 'object' && error !== null && 'name' in error
                    ? error.name
                    : undefined;
            if (name === 'AbortError') {
                return 'cancel';
            }
            asyncThrow(error);
        }
    }

    const blob = await attempt(createBlob);
    if (blob instanceof AttemptError) {
        asyncThrow(blob.error);
        return 'error';
    }

    if (fileHandle) {
        try {
            const writableStream = await fileHandle.createWritable();
            await writableStream.write(blob);
            await writableStream.close();
            return 'saved';
        } catch (e) {
            asyncThrow(e);
            // Still try to save the regular way now.
        }
    }

    try {
        // Namespace is used to prevent conflict w/ Chrome Poper Blocker extension (Issue https://github.com/eligrey/FileSaver.js/issues/561)
        const a = document.createElementNS(
            'http://www.w3.org/1999/xhtml',
            'a',
        ) as HTMLAnchorElement;
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
    } catch (e) {
        asyncThrow(e);
        return 'error';
    }
    return 'saved';
}
