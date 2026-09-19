import { asyncThrow, attempt, AttemptError } from './base';

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
    'image/jpeg': {
        description: 'JPEG Image',
        accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
    },
    'image/vnd.adobe.photoshop': {
        description: 'Adobe Photoshop Document',
        accept: { 'image/vnd.adobe.photoshop': ['.psd'] },
    },
} as const;

export type TFileSaveResult = 'saved' | 'cancel' | 'error';

// resolves to true if it saves via file picker (or user aborted)
async function saveViaFilePicker(blob: Blob, fileName: string): Promise<TFileSaveResult> {
    const mimeType = blob.type;
    if (!('showSaveFilePicker' in window)) {
        return 'error';
    }
    if (!types[mimeType]) {
        asyncThrow(new Error('unknown mime type' + mimeType));
        return 'error';
    }
    type TMaybeUndefined = undefined | null;
    const fileHandle: FileSystemFileHandle | TMaybeUndefined | AttemptError = await attempt(
        async () =>
            (window as any).showSaveFilePicker({
                suggestedName: fileName,
                types: [types[mimeType]],
            }),
    );
    if (fileHandle instanceof AttemptError) {
        const e = fileHandle.error;
        if (e instanceof Error && e.name === 'AbortError') {
            // canceled dialog
            return 'cancel';
        }
        asyncThrow(e);
        return 'error';
    }
    if (!fileHandle) {
        // might be impossible
        asyncThrow('fileHandle is not defined');
        return 'error';
    }
    try {
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
    } catch (e) {
        asyncThrow(e);
        return 'error';
    }
    return 'saved';
}

export async function saveAs(
    blob: Blob,
    fileName: string,
    showDialog: boolean = false,
): Promise<TFileSaveResult> {
    if (showDialog) {
        const result = await saveViaFilePicker(blob, fileName);
        if (result !== 'error') {
            // saved or canceled
            return result;
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
