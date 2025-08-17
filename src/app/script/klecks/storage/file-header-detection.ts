// image - png, jpg, webp, whatever the browser natively supports
export type TSupportedFileType = 'image' | 'psd';

function isBufferMatch(buffer: Uint8Array, bytes: (number | undefined)[]) {
    return bytes.every((byte, index) => {
        if (byte === undefined) {
            return true;
        }
        return buffer[index] === byte;
    });
}

// undefined if unknown
export async function detectFiletype(file: File): Promise<TSupportedFileType | undefined> {
    // photoshop is sub type of image.* - so check first
    const nameSplit = file.name.split('.');
    const extension = nameSplit[nameSplit.length - 1].toLowerCase();
    if (file.type.match('image/vnd.adobe.photoshop') || extension === 'psd') {
        return 'psd';
    }

    if (file.type.match('image.*')) {
        return 'image';
    }
    // check for headers

    try {
        const arr = await new Promise<Uint8Array>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (reader.result === null) {
                    reject();
                    return;
                }
                // we did read as array buffer
                resolve(new Uint8Array(reader.result as ArrayBuffer));
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file.slice(0, 12));
        });

        // PSD: '8BPS'
        if (isBufferMatch(arr, [56, 66, 80, 83])) {
            return 'psd';
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (isBufferMatch(arr, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
            return 'image';
        }
        // JPEG: 0xFF 0xD8
        if (isBufferMatch(arr, [0xff, 0xd8])) {
            return 'image';
        }
        // WebP: 'RIFF....WEBP'
        if (
            isBufferMatch(arr, [
                0x52,
                0x49,
                0x46,
                0x46,
                undefined,
                undefined,
                undefined,
                undefined,
                0x57,
                0x45,
                0x42,
                0x50,
            ])
        ) {
            return 'image';
        }
    } catch (e) {
        // ...
    }
    return undefined;
}
