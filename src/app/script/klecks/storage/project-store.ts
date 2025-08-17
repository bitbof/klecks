import { TDeserializedKlStorageProject, TKlProject, TKlProjectMeta, TRawMeta } from '../kl-types';
import {
    PROJECT_STORE_THUMBNAIL_SIZE_PX,
    ProjectConverter,
    TKlStorageProjectRead,
    TKlStorageProjectWrite,
} from './project-converter';
import { LocalStorage } from '../../bb/base/local-storage';
import { BROWSER_STORAGE_STORE, IMAGE_DATA_STORE, KL_INDEXED_DB } from './kl-indexed-db';
import { isBlob, randomUuid } from '../../bb/base/base';
import { TIdb } from './kl-indexed-db.types';
import { BB } from '../../bb/bb';
import { canvasToBlob } from '../../bb/base/canvas';

export type TImageDataReference = {
    id: string; // id of imageDataStore entry
    //sizeBytes: number;
};

export function isTImageDataReference(input: unknown): input is TImageDataReference {
    return (
        typeof input === 'object' &&
        input !== null &&
        'id' in input &&
        typeof (input as any).id === 'string'
    );
}

async function createFallbackThumbnail(): Promise<Blob> {
    // very basic fallback. only affects data stored before version 0.5.1 (2022)
    return await canvasToBlob(
        BB.canvas(PROJECT_STORE_THUMBNAIL_SIZE_PX, PROJECT_STORE_THUMBNAIL_SIZE_PX),
        'image/png',
    );
}

export type TProjectStoreListener = {
    onUpdate: (meta?: TKlProjectMeta) => void;
};

/**
 * simplified interface for storing projects into browser storage
 */
export class ProjectStore {
    private listeners: TProjectStoreListener[] = [];
    private isAvailable: boolean = true;
    private currentMeta: TKlProjectMeta | undefined;

    private async lowLevelStore(project: TKlStorageProjectWrite): Promise<void> {
        // get image data ids
        const rawOld = (await KL_INDEXED_DB.get(BROWSER_STORAGE_STORE, 1)) as
            | TKlStorageProjectWrite
            | undefined;
        const deleteIds: string[] = [];
        if (rawOld) {
            if (isTImageDataReference(rawOld.thumbnail)) {
                deleteIds.push(rawOld.thumbnail.id);
            }
            for (const layer of rawOld.layers) {
                if (isTImageDataReference(layer.blob)) {
                    deleteIds.push(layer.blob.id);
                }
            }
        }

        // prepare for storing
        const imageDataList: { id: string; data: Blob }[] = [];
        const thumbnail = {
            id: randomUuid(),
        };
        imageDataList.push({
            id: thumbnail.id,
            data: project.thumbnail!,
        });
        const layers: TIdb['V2']['ProjectStore']['Write']['layers'] = [];
        for (const layer of project.layers) {
            const blob = {
                id: randomUuid(),
            };
            imageDataList.push({
                id: blob.id,
                data: layer.blob,
            });
            layers.push({
                ...layer,
                blob,
            });
        }
        const raw: TIdb['V2']['ProjectStore']['Write'] = {
            ...project,
            thumbnail,
            layers,
        };

        // store first. so nothing will be lost if something goes wrong
        for (const imageData of imageDataList) {
            await KL_INDEXED_DB.set(IMAGE_DATA_STORE, imageData.id, imageData.data);
        }

        await KL_INDEXED_DB.set(BROWSER_STORAGE_STORE, undefined, raw);

        // remove obsolete imageData
        for (const id of deleteIds) {
            await KL_INDEXED_DB.remove(IMAGE_DATA_STORE, id);
        }
    }

    private async lowLevelReadMeta(): Promise<TRawMeta | undefined> {
        const raw = (await KL_INDEXED_DB.get(
            BROWSER_STORAGE_STORE,
            1,
        )) as TIdb['V2']['ProjectStore']['Read'];
        if (!raw) {
            return undefined;
        }

        let thumbnail: Blob | undefined;
        if (isTImageDataReference(raw.thumbnail)) {
            const thumbnailReadResult = (await KL_INDEXED_DB.get(
                IMAGE_DATA_STORE,
                raw.thumbnail.id,
            )) as TIdb['V2']['ImageDataStore']['Read'] | undefined;
            if (isBlob(thumbnailReadResult)) {
                thumbnail = thumbnailReadResult;
            }
        } else {
            thumbnail = raw.thumbnail;
        }
        thumbnail = thumbnail ?? (await createFallbackThumbnail());

        return {
            projectId: raw.projectId ?? randomUuid(),
            timestamp: raw.timestamp,
            thumbnail,
        };
    }

    private async lowLevelRead(): Promise<TKlStorageProjectRead | undefined> {
        const raw = (await KL_INDEXED_DB.get(
            BROWSER_STORAGE_STORE,
            1,
        )) as TIdb['V2']['ProjectStore']['Read'];
        if (!raw) {
            return undefined;
        }

        let thumbnail: Blob | undefined;
        if (isTImageDataReference(raw.thumbnail)) {
            const thumbnailReadResult = (await KL_INDEXED_DB.get(
                IMAGE_DATA_STORE,
                raw.thumbnail.id,
            )) as TIdb['V2']['ImageDataStore']['Read'] | undefined;
            if (isBlob(thumbnailReadResult)) {
                thumbnail = thumbnailReadResult;
            }
        } else {
            thumbnail = raw.thumbnail;
        }
        thumbnail = thumbnail ?? (await createFallbackThumbnail());

        const layers: TKlStorageProjectRead['layers'] = [];
        for (const layer of raw.layers) {
            let blob: Blob | undefined;
            if (isTImageDataReference(layer.blob)) {
                const readResult = (await KL_INDEXED_DB.get(IMAGE_DATA_STORE, layer.blob.id)) as
                    | TIdb['V2']['ImageDataStore']['Read']
                    | undefined;
                if (isBlob(readResult)) {
                    blob = readResult;
                }
            } else {
                blob = layer.blob;
            }
            layers.push({
                ...layer,
                isVisible: layer.isVisible ?? true,
                mixModeStr: layer.mixModeStr ?? 'source-over',
                blob,
            });
        }
        return {
            ...raw,
            projectId: raw.projectId ?? randomUuid(),
            thumbnail,
            layers,
        };
    }

    private async lowLevelClear(): Promise<void> {
        // get image data ids
        const rawOld = (await KL_INDEXED_DB.get(BROWSER_STORAGE_STORE, 1)) as
            | TIdb['V2']['ProjectStore']['Read']
            | undefined;
        const deleteIds: string[] = [];
        if (rawOld) {
            if (isTImageDataReference(rawOld.thumbnail)) {
                deleteIds.push(rawOld.thumbnail.id);
            }
            for (const layer of rawOld.layers) {
                if (isTImageDataReference(layer.blob)) {
                    deleteIds.push(layer.blob.id);
                }
            }
        }

        await KL_INDEXED_DB.remove(BROWSER_STORAGE_STORE, 1);
        for (const id of deleteIds) {
            await KL_INDEXED_DB.remove(IMAGE_DATA_STORE, id);
        }
    }

    private emit(meta?: TKlProjectMeta): void {
        this.currentMeta = meta ? { ...meta } : undefined;
        this.listeners.forEach((item) => {
            item.onUpdate(meta);
        });
    }

    private updateTimestamp(): void {
        LocalStorage.setItem('indexedDbUpdatedAt', '' + new Date().getTime());
    }

    // ----------------------------------- public -----------------------------------

    constructor() {
        if (!KL_INDEXED_DB.getIsAvailable()) {
            this.isAvailable = false;
            return;
        }

        window.addEventListener('storage', async (e) => {
            if (e.key !== 'indexedDbUpdatedAt' || this.listeners.length === 0) {
                return;
            }
            await this.update();
        });
    }

    async update(): Promise<void> {
        try {
            this.emit(await this.readMeta());
        } catch (e) {
            if (e instanceof Error && e.message.indexOf('db-error') === 0) {
                this.isAvailable = false;
            }
        }
    }

    async read(): Promise<TDeserializedKlStorageProject | undefined> {
        let storageProject: TKlStorageProjectRead | undefined;
        try {
            storageProject = await this.lowLevelRead();
        } catch (e) {
            this.isAvailable = false;
            throw new Error('db-error: ' + e);
        }
        if (!storageProject) {
            return undefined;
        }
        let result;
        try {
            result = await ProjectConverter.readStorageProject(storageProject);
        } catch (e) {
            throw new Error('format-error: ' + e);
        }
        return result;
    }

    async readMeta(): Promise<TKlProjectMeta | undefined> {
        let blobMeta: TRawMeta | undefined;
        try {
            blobMeta = await this.lowLevelReadMeta();
        } catch (e) {
            this.isAvailable = false;
            throw new Error('db-error: ' + e);
        }
        if (!blobMeta) {
            return undefined;
        }
        let result;
        try {
            result = await ProjectConverter.readStorageMeta(blobMeta);
        } catch (e) {
            throw new Error('format-error: ' + e);
        }
        return result;
    }

    async store(project: TKlProject): Promise<void> {
        try {
            const storageProject = await ProjectConverter.createStorageProject(project);
            await this.lowLevelStore(storageProject);
        } catch (e) {
            this.isAvailable = false;
            throw new Error('db-error: ' + e);
        }
        this.updateTimestamp();
        setTimeout(async () => {
            const meta = await this.readMeta();
            this.emit(meta);
        });
    }

    async clear(): Promise<void> {
        await this.lowLevelClear();
        this.updateTimestamp();
        setTimeout(() => this.emit(), 0);
    }

    subscribe(listener: TProjectStoreListener): void {
        if (this.listeners.includes(listener)) {
            return;
        }
        this.listeners.push(listener);
    }

    unsubscribe(listener: TProjectStoreListener): void {
        for (let i = 0; i < this.listeners.length; i++) {
            if (listener === this.listeners[i]) {
                this.listeners.splice(i, 1);
                return;
            }
        }
    }

    getIsAvailable(): boolean {
        this.isAvailable = this.isAvailable && KL_INDEXED_DB.getIsAvailable();
        return this.isAvailable;
    }

    getCurrentMeta(): TKlProjectMeta | undefined {
        return this.currentMeta;
    }
}
