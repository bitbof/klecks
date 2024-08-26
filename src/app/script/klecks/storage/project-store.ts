import { IKlProject, IKlStorageProject } from '../kl-types';
import { ProjectConverter, TReadStorageProjectResult } from './project-converter';
import { clear, getKlProjectObj, storeKlProjectObj } from './indexed-db';
import { LocalStorage } from '../../bb/base/local-storage';

export interface IProjectStoreListener {
    onUpdate: (timestamp?: number, thumbnail?: HTMLImageElement | HTMLCanvasElement) => void;
}

function makeAsync<T>(
    nonAsyncFunc: (
        resolveCallback: (value: T) => void,
        rejectCallback: (reason?: unknown) => void,
    ) => void,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        nonAsyncFunc(resolve, reject);
    });
}

/**
 * simplified interface for storing projects into browser storage
 */
export class ProjectStore {
    private listeners: IProjectStoreListener[] = [];
    private accessHasFailed: boolean = false;

    async lowLevelStore(project: IKlStorageProject): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            storeKlProjectObj(project, resolve, reject);
        });
    }

    async lowLevelRead(): Promise<IKlStorageProject> {
        return (await makeAsync(getKlProjectObj)) as IKlStorageProject;
    }

    async lowLevelClear(): Promise<void> {
        await makeAsync<void>(clear);
    }

    private emit(timestamp?: number, thumbnail?: HTMLImageElement | HTMLCanvasElement): void {
        this.listeners.forEach((item) => {
            item.onUpdate(timestamp, thumbnail);
        });
    }

    private updateTimestamp(): void {
        LocalStorage.setItem('indexedDbUpdatedAt', '' + new Date().getTime());
    }

    // ----------------------------------- public -----------------------------------

    constructor() {
        window.addEventListener('storage', (e) => {
            if (e.key !== 'indexedDbUpdatedAt' || this.listeners.length === 0) {
                return;
            }
            try {
                (async (): Promise<void> => {
                    const readResult = await this.read();
                    if (readResult) {
                        this.emit(readResult.timestamp, readResult.thumbnail);
                    } else {
                        this.emit();
                    }
                })();
            } catch (e) {
                if (e instanceof Error && e.message.indexOf('db-error') === 0) {
                    this.accessHasFailed = true;
                }
            }
        });
    }

    async read(): Promise<
        | {
              project: IKlProject;
              timestamp: number;
              thumbnail: HTMLImageElement | HTMLCanvasElement;
          }
        | undefined
    > {
        let storageProject;
        try {
            storageProject = await this.lowLevelRead();
        } catch (e) {
            this.accessHasFailed = true;
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

    async store(project: IKlProject): Promise<void> {
        try {
            const storageProject = ProjectConverter.createStorageProject(project);
            await this.lowLevelStore(storageProject);
        } catch (e) {
            this.accessHasFailed = true;
            throw new Error('db-error: ' + e);
        }
        {
            // immediately test if it can be read
            const storageProject = await this.lowLevelRead();
            let readResult: TReadStorageProjectResult;
            try {
                readResult = await ProjectConverter.readStorageProject(storageProject);
            } catch (e) {
                await this.lowLevelClear();
                this.updateTimestamp();
                setTimeout(() => this.emit(), 0);
                throw new Error('format-error: ' + e);
            }
            this.updateTimestamp();
            setTimeout(() => this.emit(readResult.timestamp, readResult.thumbnail), 0);
        }
    }

    async clear(): Promise<void> {
        await this.lowLevelClear();
        this.updateTimestamp();
        setTimeout(() => this.emit(), 0);
    }

    subscribe(listener: IProjectStoreListener): void {
        if (this.listeners.includes(listener)) {
            return;
        }
        this.listeners.push(listener);
    }

    unsubscribe(listener: IProjectStoreListener): void {
        for (let i = 0; i < this.listeners.length; i++) {
            if (listener === this.listeners[i]) {
                this.listeners.splice(i, 1);
                return;
            }
        }
    }

    isBroken(): boolean {
        return this.accessHasFailed;
    }
}
