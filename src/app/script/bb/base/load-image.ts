export type TLoadImageOptions = {
    crossOrigin?: 'anonymous' | 'use-credentials';
};

export function loadImage(src: string, options: TLoadImageOptions = {}): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();

        const clearHandlers = (): void => {
            image.onload = null;
            image.onabort = null;
            image.onerror = null;
        };

        image.onload = (): void => {
            clearHandlers();
            resolve(image);
        };
        image.onabort = (): void => {
            clearHandlers();
            reject(new DOMException('Image loading aborted', 'AbortError'));
        };
        image.onerror = (): void => {
            clearHandlers();
            reject(new Error('Image failed loading'));
        };

        if (options.crossOrigin !== undefined) {
            image.crossOrigin = options.crossOrigin;
        }

        image.src = src;
    });
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    const src = URL.createObjectURL(blob);
    try {
        return await loadImage(src);
    } finally {
        URL.revokeObjectURL(src);
    }
}
